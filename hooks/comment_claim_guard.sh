#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# comment_claim_guard.sh — PostToolUse hook: apply Rule 5 to COMMENTS/KDoc.
#
# CLAUDE.md: the no-fabrication gates apply to every text emitted, including code
# comments — and comments are where claims slip the gate most easily, because
# writing one feels like "writing code" rather than "making a statement".
# claim_check.sh only scans the final chat message, so comments had zero coverage.
# Measured 2026-07-27: three false claims reached KDoc/comments (an ungrepped
# negative claim, a wrong "covered by that other test", a runtime mechanism that
# does not exist) plus one wrong line reference.
#
# SCOPE: scans ONLY the text just written (Edit.new_string / Write.content), only
# its comment lines, in .kt/.java/.kts files. Never re-scans the whole file, so
# pre-existing comments do not fire on every edit.
#
# THREE FAMILIES ONLY (precision > recall, same policy as claim_check):
#   1. line reference inside a comment      → C1, must come from graph/source
#   2. "đã test / covered by / verified in" → C5-outcome, needs real evidence
#   3. "không dùng / not used / never called / không ảnh hưởng" → C4, needs a search
#
# WARN (exit 2 → stderr to Claude). Never blocks the edit — it already happened.
# Comments are often legitimately descriptive; this asks for evidence or softer
# wording, it does not forbid comments.
#
# WHAT IT CANNOT DO: judge whether a claim is TRUE. A grepped, correct negative
# claim trips it exactly like an invented one — answer by citing the evidence.
#
# Escape hatch: COMMENT_CLAIM_GUARD=0 (logged). Fail-open on internal error.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"

# Drain stdin before any early exit, otherwise the caller gets EPIPE.
INPUT="$(cat)"

[ "${COMMENT_CLAIM_GUARD:-1}" = "0" ] && exit 0

CC_INPUT="${INPUT}" CC_LOG="${LOG_DIR}/comment_claim_guard.log" \
CC_TS="$(date +%Y-%m-%dT%H:%M:%S)" \
python3 <<'PY'
import os, sys, json, re

raw = os.environ.get("CC_INPUT", "")
log = os.environ.get("CC_LOG", "/dev/null")
ts  = os.environ.get("CC_TS", "?")

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

inp = d.get("tool_input") or {}
if not isinstance(inp, dict):
    sys.exit(0)
path = inp.get("file_path") or ""
if not isinstance(path, str) or not path.endswith((".kt", ".java", ".kts")):
    sys.exit(0)

# Only the text written by THIS call.
written = inp.get("new_string")
if not isinstance(written, str):
    written = inp.get("content")
if not isinstance(written, str) or not written.strip():
    sys.exit(0)

# Comment lines only: //, ///, /*, *, */ — plus KDoc bodies.
COMMENT_RE = re.compile(r"^\s*(?://+|/\*+|\*+/?)\s?(.*)$")
comment_lines = []
for i, ln in enumerate(written.split("\n"), 1):
    m = COMMENT_RE.match(ln)
    if m:
        body = re.sub(r"\*+/\s*$", "", m.group(1)).strip()
        if body:
            comment_lines.append((i, body))
if not comment_lines:
    sys.exit(0)

FAMILIES = [
    ("C1 line-ref",
     re.compile(r"\b[A-Za-z0-9_]+\.(?:kt|java|kts|xml)\s*:\s*\d+", re.I),
     "line reference trong comment — phải cite từ graph/source, và số dòng sẽ lệch ngay khi file đổi"),
    ("C5 đã-test",
     re.compile(r"(?:đã\s+(?:được\s+)?(?:test|kiểm\s*tra|verify|verified)"
                r"|covered\s+by|tested\s+in|verified\s+in|already\s+tested)", re.I),
     "claim 'đã được test ở chỗ khác' — cần evidence thật, đây là ca đã lọt 2026-07-27"),
    ("C4 negative",
     re.compile(r"(?:kh[ôo]ng\s+(?:bao\s+giờ\s+)?(?:d[ùu]ng|g[ọo]i|đ[ưu]ợc\s+g[ọo]i|ảnh\s+hưởng)"
                r"|never\s+(?:called|used|invoked)"
                r"|not\s+used\s+(?:any\s*where|elsewhere)"
                r"|no\s+(?:other\s+)?(?:caller|consumer)s?\b"
                r"|only\s+(?:used|called)\s+(?:by|from|in))", re.I),
     "negative/scope claim — phải search TRƯỚC và nêu phạm vi đã search"),
]

hits = []
for lineno, text in comment_lines:
    for fam, pat, why in FAMILIES:
        m = pat.search(text)
        if m:
            hits.append((fam, lineno, text[:90], why))
            break

if not hits:
    logline(f"[{ts}] {os.path.basename(path)}: {len(comment_lines)} comment line, sạch — pass")
    sys.exit(0)

logline(f"[{ts}] WARN — {os.path.basename(path)}: {len(hits)} comment claim "
        f"({', '.join(sorted({h[0] for h in hits}))})")

out = [f"⚠️ COMMENT-CLAIM (CLAUDE.md Rule 5 áp cho CẢ comment/KDoc): "
       f"{os.path.basename(path)}", ""]
for fam, lineno, text, why in hits[:8]:
    out.append(f"  [{fam}] dòng +{lineno} của đoạn vừa ghi:")
    out.append(f"     \"{text}\"")
    out.append(f"     → {why}")
if len(hits) > 8:
    out.append(f"  … +{len(hits)-8} chỗ nữa")
out += [
    "",
    "  Comment sai nguy hơn reply sai: nó ở lại trong code và người sau đọc nó như fact.",
    "  Chọn 1: (a) cite evidence đã có ngay trong comment, (b) đi verify rồi giữ nguyên,",
    "  hoặc (c) viết lại thành mô tả hành vi thay vì khẳng định về phần code khác.",
]
sys.stderr.write("\n".join(out) + "\n")
sys.exit(2)
PY
rc=$?
[ "${rc}" -eq 2 ] && exit 2
exit 0
