#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# security_gate.sh — Stop hook: CLAUDE.md `check 4c` (security review by trigger).
#
# `check 4c` says a diff touching an attack surface MUST get `/scan` or the
# security-checklist on that scope, and may NOT be waved through as NOT
# APPLICABLE. It was the only MANDATORY check in the Deep Audit Loop with no
# machine behind it — and the repo's own incident memory is mostly this class:
# an API key committed in a fixture, per-keystroke search text shipped to
# analytics, a permission-shaped file-open bug, WebView file access.
#
# BLOCK (exit 2) when BOTH hold:
#   • this session edited a file that touches an attack surface (path or the
#     text just written), AND
#   • no security review ran AFTER that edit — /scan, the security-checklist
#     skill, or a security sub-agent.
#
# WHAT COUNTS AS ATTACK SURFACE — deliberately NARROW (precision > recall, the
# same policy as claim_check/comment_claim_guard). A gate that cries on ordinary
# UI work gets switched off, and CLAUDE.md is explicit that a false positive is
# worse than a miss. Broad-but-common surfaces (`getIntent()`, `openInputStream`)
# are NOT triggers: in a document reader they appear in nearly every diff.
#
# NOT attack surface, by design:
#   • anything under `.claude/` — rules, hooks, this gate, the harness. They are
#     stuffed with the trigger words BECAUSE they describe them.
#   • `*.md`, `plans/` — prose.
#   • `/src/test/` — JVM unit tests have no runtime surface.
#
# WHAT IT CANNOT DO: judge whether the review was any good, or whether it covered
# the right scope. It only knows that something ran after the edit.
#
# Loop guard: MAX_ATTEMPTS reminders per session, then it releases with a logged
# warning — the duty falls back on you, exactly as with review_gate.
# Escape hatch: SECURITY_GATE=0 (logged). Fail-open on any internal error.
# Stop hook protocol: stdin JSON; exit 2 blocks (stderr→Claude); exit 0 allows.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"

INPUT="$(cat)"

[ "${SECURITY_GATE:-1}" = "0" ] && exit 0

SG_INPUT="${INPUT}" SG_LOG="${LOG_DIR}/security_gate.log" SG_DIR="${LOG_DIR}" \
SG_TS="$(date +%Y-%m-%dT%H:%M:%S)" SG_MAX="${SECURITY_GATE_MAX_ATTEMPTS:-3}" \
python3 <<'PY'
import os, sys, json, re

raw   = os.environ.get("SG_INPUT", "")
log   = os.environ.get("SG_LOG", "/dev/null")
sdir  = os.environ.get("SG_DIR", "/tmp")
ts    = os.environ.get("SG_TS", "?")
maxatt = int(os.environ.get("SG_MAX", "3") or "3")

def logline(s):
    try:
        with open(log, "a") as fh:
            fh.write(s + "\n")
    except Exception:
        pass

try:
    d = json.loads(raw)
except Exception as e:
    logline(f"[{ts}] stdin parse fail: {e!r} — fail-open")
    sys.exit(0)

if d.get("stop_hook_active"):
    sys.exit(0)

# ── what is out of scope ────────────────────────────────────────────────────
EXCLUDE_SUBSTR = ("/.claude/", "/plans/", "/src/test/", "/build/", "/.git/")
EXCLUDE_SUFFIX = (".md", ".txt")

def excluded(path):
    p = path.replace(os.sep, "/")
    if p.endswith(EXCLUDE_SUFFIX):
        return True
    if any(s in p for s in EXCLUDE_SUBSTR):
        return True
    return p.startswith(".claude/") or "/.claude" in p

# ── triggers: path shape, then text just written ────────────────────────────
PATH_TRIGGERS = [
    (re.compile(r"AndroidManifest\.xml$", re.I),            "AndroidManifest"),
    (re.compile(r"network_security_config[^/]*\.xml$", re.I), "network security config"),
    (re.compile(r"\.keystore$|\.jks$", re.I),               "keystore"),
    (re.compile(r"google-services\.json$", re.I),           "Firebase config"),
    (re.compile(r"/(security|auth)/", re.I),                "security/auth package"),
]
TEXT_TRIGGERS = [
    (re.compile(r"<uses-permission|android:permission=", re.I),        "permission"),
    (re.compile(r"android:exported\s*=|<intent-filter", re.I),          "exported component / intent-filter"),
    (re.compile(r"javaScriptEnabled|addJavascriptInterface|"
                r"setAllowFileAccess|allowFileAccess|loadDataWithBaseURL", re.I), "WebView surface"),
    (re.compile(r"usesCleartextTraffic|CLEARTEXT|trustAllCerts|"
                r"HostnameVerifier", re.I),                             "cleartext / TLS trust"),
    (re.compile(r"storePassword|keyPassword|keyAlias|signingConfig", re.I), "signing / keystore"),
    (re.compile(r"apiKey|api_key|Bearer\s|accessToken|client_secret", re.I), "credential / token"),
    (re.compile(r"logEvent\(|setUserProperty\(|recordException\(", re.I),  "telemetry payload"),
]

def triggers_for(path, text):
    hits = []
    for rx, label in PATH_TRIGGERS:
        if rx.search(path):
            hits.append(label)
    if text:
        for rx, label in TEXT_TRIGGERS:
            if rx.search(text):
                hits.append(label)
    return hits

REVIEW_SKILLS = {"security-checklist", "scan", "/scan", "security-review"}
REVIEW_AGENTS_RX = re.compile(r"security", re.I)
REVIEW_BASH_RX = re.compile(r"/scan\b|security[-_]check|security[-_]review|"
                            r"scripts/qa[^\n]*security", re.I)

# ── one transcript pass ─────────────────────────────────────────────────────
tp = d.get("transcript_path")
idx = 0
last_review_idx = -1
flagged = {}          # path -> (idx, [labels])
if tp and os.path.exists(tp):
    try:
        with open(tp) as fh:
            for rawline in fh:
                rawline = rawline.strip()
                if not rawline:
                    continue
                try:
                    rec = json.loads(rawline)
                except Exception:
                    continue
                content = (rec.get("message") or {}).get("content")
                if not isinstance(content, list):
                    continue
                for blk in content:
                    if not isinstance(blk, dict) or blk.get("type") != "tool_use":
                        continue
                    idx += 1
                    name = blk.get("name", "")
                    inp = blk.get("input") or {}
                    if not isinstance(inp, dict):
                        continue
                    if name in ("Edit", "Write", "NotebookEdit"):
                        fp = inp.get("file_path") or inp.get("notebook_path") or ""
                        if not isinstance(fp, str) or not fp or excluded(fp):
                            continue
                        text = inp.get("new_string") or inp.get("content") or ""
                        if not isinstance(text, str):
                            text = ""
                        hits = triggers_for(fp, text)
                        if hits:
                            flagged[fp] = (idx, sorted(set(hits)))
                    elif name == "Skill":
                        sk = str(inp.get("skill", "") or inp.get("command", "")).lstrip("/")
                        if sk in REVIEW_SKILLS:
                            last_review_idx = idx
                    elif name in ("Agent", "Task"):
                        if REVIEW_AGENTS_RX.search(str(inp.get("subagent_type", ""))):
                            last_review_idx = idx
                    elif name == "SlashCommand":
                        if REVIEW_BASH_RX.search(str(inp.get("command", ""))):
                            last_review_idx = idx
                    elif name == "Bash":
                        if REVIEW_BASH_RX.search(str(inp.get("command", ""))):
                            last_review_idx = idx
    except Exception as e:
        logline(f"[{ts}] transcript scan fail: {e!r} — fail-open")
        sys.exit(0)

# Only edits that came AFTER the last review still need one — same
# "reviewed, then kept coding" hole review_gate closes.
unreviewed = {p: v for p, v in flagged.items() if v[0] > last_review_idx}

sid = re.sub(r"[^A-Za-z0-9_-]", "_", str(d.get("session_id", "default")))[:64] or "default"
att_path = os.path.join(sdir, f"security_gate_attempts_{sid}")

if not unreviewed:
    try:
        if os.path.exists(att_path):
            os.remove(att_path)
    except Exception:
        pass
    logline(f"[{ts}] flagged={len(flagged)} unreviewed=0 — pass")
    sys.exit(0)

try:
    attempts = int(open(att_path).read().strip() or "0") if os.path.exists(att_path) else 0
except Exception:
    attempts = 0
attempts += 1
try:
    open(att_path, "w").write(str(attempts))
except Exception:
    pass

if attempts > maxatt:
    logline(f"[{ts}] RELEASE after {attempts} reminders — duty falls back to the model")
    sys.exit(0)

out = ["⛔ SECURITY (CLAUDE.md check 4c): diff chạm attack surface nhưng chưa có security review.", ""]
for p, (_, labels) in sorted(unreviewed.items())[:8]:
    out.append(f"  • {p}")
    out.append(f"      trigger: {', '.join(labels)}")
out += ["",
        "  check 4c là MANDATORY, không được ghi NOT APPLICABLE cho đúng các trigger này.",
        "  Chạy `/scan` hoặc skill `security-checklist` trên ĐÚNG scope trên, rồi kết luận.",
        "  Không chạy được (thiếu quyền/tool/device) → ghi BLOCKED + residual, đừng lờ đi.",
        f"  (nhắc {attempts}/{maxatt}; sau đó gate tự thả và nghĩa vụ rơi về bạn — W4 cấm lờ.)"]
logline(f"[{ts}] BLOCK — unreviewed={sorted(unreviewed)} attempt={attempts}")
sys.stderr.write("\n".join(out) + "\n")
sys.exit(2)
PY
rc=$?
[ "${rc}" -eq 2 ] && exit 2
exit 0
