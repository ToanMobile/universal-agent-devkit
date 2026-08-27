#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# claim_check.sh — Stop hook: deterministic anti-fabrication gate (Rule 5).
#
# Scope (narrow on purpose — precision > recall for a BLOCKING gate):
#   Check A (BLOCK):  every `file.ext:NN` line-citation in Claude's final
#                     message must have a real source in this session —
#                     either the exact `path:line` appears in some tool output
#                     / user message (e.g. Grep), or the cited file was
#                     actually opened (Read/Edit/Write). Citing a file:line for
#                     a file never touched this session = fabrication (or a
#                     stale memory citation, Rule 5.3(e)) → block.
#   Check B (LOG):    result-phrase claims ("BUILD SUCCESSFUL", "test pass",
#                     "0 E/", "detekt clean", "logcat sạch") are logged with
#                     whether a matching tool actually ran. NEVER blocks —
#                     pattern-matching can't tell assertion from quotation
#                     (this very phrase would trip it). The gradle Stop gate is
#                     the real check for build/test claims.
#
# Does NOT catch: "function X gọi từ Y", "lỗi do Z", metrics, library-behaviour
# claims. Those stay behavioural (need subagent review + discipline).
#
# Stop hook protocol: stdin JSON; exit 2 = block (stderr shown to Claude);
# exit 0 = allow. Reads `last_assistant_message` from stdin (verified reliable;
# transcript tail can lag at Stop-fire time).
#
# Loop guard: if stop_hook_active is true we already forced one correction —
# exit 0 so Claude can stop (no infinite block loop). bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"
LOG="${LOG_DIR}/claim_check.log"

INPUT="$(cat)"

# All logic in python3 (the macOS system interpreter); emit the block message
# on fd 2 and signal block via a sentinel exit handled below.
CLAIM_INPUT="${INPUT}" CLAIM_LOG="${LOG}" CLAIM_TS="$(date +%Y-%m-%dT%H:%M:%S)" \
CLAIM_REPO="${REPO_ROOT}" \
python3 <<'PY'
import os, sys, json, re

raw = os.environ.get("CLAIM_INPUT", "")
log_path = os.environ.get("CLAIM_LOG", "/dev/null")
ts = os.environ.get("CLAIM_TS", "?")
repo_root = os.environ.get("CLAIM_REPO", "") or os.getcwd()

def logline(s):
    try:
        with open(log_path, "a") as fh:
            fh.write(s + "\n")
    except Exception:
        pass

try:
    d = json.loads(raw)
except Exception as e:
    # Can't parse stdin → fail open (never block on our own bug).
    logline(f"[{ts}] stdin parse fail: {e!r} — fail-open")
    sys.exit(0)

# Loop guard: already forced one correction this stop-chain.
if d.get("stop_hook_active"):
    sys.exit(0)

msg = d.get("last_assistant_message")
if not isinstance(msg, str) or not msg.strip():
    sys.exit(0)

# ── Strip fenced code blocks (illustrative samples) but KEEP inline `code`
#    (real citations are often inline per the file_path:line convention). ──
msg_scan = re.sub(r"```.*?```", " ", msg, flags=re.DOTALL)

# ── Extract Form-1 citations: path-ish + code extension + :line ──
CIT_RE = re.compile(
    r"(?<![\w./-])"
    r"([A-Za-z0-9_./-]*[A-Za-z0-9_-]+"
    r"\.(?:kt|kts|java|xml|gradle|py|sh|js|mjs|md|toml|ya?ml|cpp|cc|hpp|h|json|pro))"
    r":(\d+)\b"
)
citations = []  # (full, path, line)
for m in CIT_RE.finditer(msg_scan):
    path, line = m.group(1), m.group(2)
    citations.append((f"{path}:{line}", path, line))

# ── Check C — past-action claims (NARROW: tool-backed verbs only). ──
# Calibrated on full transcript history: this narrow set had 0 false positives
# (every real "đã chạy X" had a matching tool call). Deliberately excludes
# fuzzy verbs (verify / phân tích / "đã có đủ thông tin") which carry no single
# tool signature and would mis-fire. Each entry: (key, claim regex). A claim
# fires only if NO hypothetical/negation marker is in the same sentence AND no
# matching evidence exists in the session.
PA_CLAIMS = [
    ("build",  re.compile(r"đã\s+(?:chạy\s+(?:gradle\s+)?)?(?:build|biên dịch)\b", re.I)),
    ("test",   re.compile(r"đã\s+(?:chạy\s+)?test\b", re.I)),
    ("grep",   re.compile(r"đã\s+grep\b", re.I)),
    ("logcat", re.compile(r"đã\s+(?:chạy\s+)?(?:check\s+)?logcat\b", re.I)),
    ("detekt", re.compile(r"đã\s+(?:chạy\s+)?(?:detekt|lint)\b", re.I)),
]
PA_HYP = re.compile(r"(nếu|giả sử|bạn nên|\bnên\b|should|\bif\b|\bsẽ\b|\bchưa\b|\bcần\b|\bkhông\b)", re.I)

# Scrub inline-code and quoted spans for Check C ONLY: quoting the rulebook
# ("claim `đã chạy test` cần tool call") must not read as a past-action claim.
# Check A keeps inline code, because real citations live there.
msg_pa = re.sub(r"`[^`\n]*`", " ", msg_scan)
msg_pa = re.sub(r"[\"“”][^\"“”\n]*[\"“”]", " ", msg_pa)

pa_claims = []  # list of keys claimed
for sent in re.split(r"[.\n!?]", msg_pa):
    hyp_at = [m.start() for m in PA_HYP.finditer(sent)]
    for key, pat in PA_CLAIMS:
        m = pat.search(sent)
        if not m:
            continue
        # A hypothetical/negation marker disarms the claim only when it GOVERNS
        # it — i.e. stands BEFORE it ("nếu đã chạy test", "chưa chạy test").
        # A marker AFTER the claim does not: "đã chạy test và không có failure"
        # is a real past-action claim, and the old whole-sentence scan let every
        # such phrasing through (measured 2026-07-27 — the most natural wording
        # of a genuine claim was exactly the one that bypassed the gate).
        if any(h < m.start() for h in hyp_at):
            continue
        pa_claims.append(key)

if not citations and not pa_claims:
    logline(f"[{ts}] no citations / past-action claims — pass")
    sys.exit(0)

# ── Build the "valid source" evidence from the transcript ──
tp = d.get("transcript_path")
corpus_parts = []          # tool_result contents + user message texts
accessed_basenames = set() # files opened via Read/Edit/Write/NotebookEdit
evidence = set()           # tool actions actually performed (build/test/grep/…)

if tp and os.path.exists(tp):
    with open(tp) as fh:
        for raw_line in fh:
            raw_line = raw_line.strip()
            if not raw_line:
                continue
            try:
                rec = json.loads(raw_line)
            except Exception:
                continue
            m = rec.get("message") or {}
            role = m.get("role")
            content = m.get("content")
            if not isinstance(content, list):
                # user message can be a plain string
                if role == "user" and isinstance(content, str):
                    corpus_parts.append(content)
                continue
            for blk in content:
                if not isinstance(blk, dict):
                    continue
                bt = blk.get("type")
                if bt == "tool_result":
                    c = blk.get("content")
                    corpus_parts.append(
                        c if isinstance(c, str)
                        else json.dumps(c, ensure_ascii=False)
                    )
                elif bt == "text" and role == "user":
                    corpus_parts.append(blk.get("text", ""))
                elif bt == "tool_use":
                    name = blk.get("name", "")
                    inp = blk.get("input") or {}
                    if name in ("Read", "Edit", "Write", "NotebookEdit"):
                        fp = inp.get("file_path") or inp.get("notebook_path")
                        if isinstance(fp, str) and fp:
                            accessed_basenames.add(os.path.basename(fp))
                    # ── evidence for Check C (past-action) ──
                    if name == "Grep":
                        evidence.add("grep")
                    if "gradle-build" in name:
                        evidence.add("build")
                    if "gradle-test" in name:
                        evidence.add("test")
                    if "adb-logcat" in name:
                        evidence.add("logcat")
                    if name == "Bash":
                        cmd = str(inp.get("command", ""))
                        if re.search(r"gradlew?.*\b(assemble|build|compile)", cmd):
                            evidence.add("build")
                        if re.search(r"gradlew?.*test|connectedAndroidTest|\bnode\s+--test\b|\bpytest\b|python\S*\s+-m\s+pytest", cmd):
                            evidence.add("test")
                        if re.search(r"\b(?:grep|rg)\b", cmd):
                            evidence.add("grep")
                        if "logcat" in cmd:
                            evidence.add("logcat")
                        if re.search(r"\b(detekt|lint)\b", cmd):
                            evidence.add("detekt")
else:
    logline(f"[{ts}] transcript unreadable ({tp!r}) — fail-open")
    sys.exit(0)

corpus = "\n".join(corpus_parts)

# ── Check A — classify each citation ──
def line_exists(path, line):
    """Does the cited line exist in the file on disk?

    Only used to qualify the weakest pass reason (`file was opened this
    session`), which otherwise accepts ANY line number for an opened file —
    `CLAUDE.md:99999` passed before this check (measured 2026-07-27).

    LIMIT, stated plainly: this catches OUT-OF-RANGE numbers only. A wrong but
    in-range number still passes — the real 2026-07-27 miss was `:246` in a
    255-line file, which this would NOT have caught. Semantic correctness of a
    line reference stays behavioural (Rule 5.1 C1).

    Fail-open: unresolvable path / unreadable file → True.
    """
    try:
        n = int(line)
    except Exception:
        return True
    for cand in (path, os.path.join(repo_root, path)):
        if os.path.isfile(cand):
            try:
                with open(cand, "rb") as fh:
                    return n <= sum(1 for _ in fh)
            except Exception:
                return True
    return True   # cannot resolve the path → do not block on it

cite_v = []
for full, path, line in citations:
    base = os.path.basename(path)
    ok = (
        full in corpus                      # exact path:line in tool/user output
        or f"{base}:{line}" in corpus       # basename:line (Grep-style output)
        or (base in accessed_basenames      # file opened this session AND
            and line_exists(path, line))    #   the line is not out of range
    )
    if not ok:
        cite_v.append((full, base))
# De-dup preserving order.
_seen = set(); cite_uniq = []
for full, base in cite_v:
    if full not in _seen:
        _seen.add(full); cite_uniq.append((full, base))

# ── Check C — past-action claims with no matching tool evidence ──
LABEL = {"build": "đã build", "test": "đã chạy test", "grep": "đã grep",
         "logcat": "đã logcat", "detekt": "đã detekt/lint"}
pa_v = []
for key in pa_claims:
    if key not in evidence and key not in pa_v:
        pa_v.append(key)

if not cite_uniq and not pa_v:
    logline(f"[{ts}] {len(citations)} citation(s) + {len(pa_claims)} "
            f"past-action claim(s) all sourced — pass")
    sys.exit(0)

# ── BLOCK ──
logline(f"[{ts}] BLOCK — unsourced citations: {[u[0] for u in cite_uniq]} "
        f"| unbacked past-actions: {pa_v}")
lines = ["⛔ CLAIM-CHECK (Rule 5.1): claim chưa có nguồn trong session.", ""]
if cite_uniq:
    lines += [
        "[A] Line-citation không tìm thấy trong tool output / user message,",
        "    và file tương ứng CHƯA được Read/Edit/Write session này:",
        "",
    ]
    for full, base in cite_uniq:
        lines.append(f"  • {full}   (chưa mở {base}, line chưa verify)")
    lines += [
        "    → Read/Grep file để verify line; hoặc bỏ ':line'; "
        "nếu từ memory phải re-verify (Rule 5.3e).",
        "",
    ]
if pa_v:
    lines += [
        "[C] Tôi nói ĐÃ làm hành động sau nhưng KHÔNG có tool call tương ứng",
        "    thành công trong session (Rule 5.1 past-action — nghiêm trọng nhất):",
        "",
    ]
    for key in pa_v:
        lines.append(f"  • \"{LABEL.get(key, key)}\" — không thấy "
                     f"{key} tool/command trong transcript")
    lines += [
        "    → Chạy thật ("
        "gradle-build/test, Grep, adb-logcat, detekt) RỒI mới claim;",
        "      hoặc sửa câu thành 'cần chạy X để verify' nếu chưa chạy.",
    ]
sys.stderr.write("\n".join(lines) + "\n")
sys.exit(2)
PY
rc=$?

# Propagate block (exit 2) / allow (exit 0). Any other python failure → allow
# (fail-open: never block Claude because of a bug in this gate).
if [ "${rc}" -eq 2 ]; then
  exit 2
fi
exit 0
