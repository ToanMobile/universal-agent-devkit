#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# churn_guard.sh — PostToolUse hook: enforce CLAUDE.md 6.4b (churn guard).
#
# Rule 6.4b: editing the same file a third time in one task with NO new evidence
# in between means you are coding on guesswork — go back to W0 box 4 (failure
# mechanism) instead of patching again.
#
# Prose alone cannot enforce it: 6.4/6.4b ask the agent to count its own failed
# attempts, and nothing persists that count. This hook counts instead.
#
# WHAT COUNTS AS "NO NEW EVIDENCE": no evidence-producing tool call between the
# edits — Bash, gradle-build/test, adb-logcat, Grep, or any codebase-memory-mcp
# query. Reading/writing files is NOT evidence: re-reading the file you are
# editing is exactly the guesswork loop this guard targets.
#
# WARN (exit 2 → stderr goes to Claude) when: the Nth consecutive edit of one
# file lands with no evidence call since the first of that run. The edit has
# ALREADY happened (PostToolUse) — this is a stop-and-think signal, not a block.
# It fires once per threshold crossing per file, not on every subsequent edit.
#
# Escape hatch: CHURN_GUARD=0 (logged). Fail-open on any internal error.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"

# Drain stdin before any early exit, otherwise the caller gets EPIPE.
INPUT="$(cat)"

[ "${CHURN_GUARD:-1}" = "0" ] && exit 0

CHURN_INPUT="${INPUT}" CHURN_LOG="${LOG_DIR}/churn_guard.log" \
CHURN_TS="$(date +%Y-%m-%dT%H:%M:%S)" CHURN_MAX="${CHURN_GUARD_MAX:-3}" \
python3 <<'PY'
import os, sys, json, re

raw    = os.environ.get("CHURN_INPUT", "")
log    = os.environ.get("CHURN_LOG", "/dev/null")
ts     = os.environ.get("CHURN_TS", "?")
try:
    THRESHOLD = max(2, int(os.environ.get("CHURN_MAX", "3")))
except Exception:
    THRESHOLD = 3

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

edited = ""
inp = d.get("tool_input") or {}
if isinstance(inp, dict):
    edited = inp.get("file_path") or inp.get("notebook_path") or ""
if not isinstance(edited, str) or not edited:
    sys.exit(0)
edited_base = os.path.basename(edited)

tp = d.get("transcript_path")
if not tp or not os.path.exists(tp):
    logline(f"[{ts}] transcript unreadable — fail-open")
    sys.exit(0)

# Evidence = a tool call that can produce NEW information about the code's
# behaviour. Deliberately excludes Read/Edit/Write/Glob: re-reading the file you
# keep editing is the guesswork loop, not an escape from it.
EVIDENCE_TOOLS = ("Bash", "Grep", "Task", "Agent")
EVIDENCE_SUBSTR = ("gradle-build", "gradle-test", "adb-logcat", "adb-shell",
                   "search_graph", "trace_path", "query_graph", "get_code_snippet",
                   "detect_changes", "search_code", "get_file_problems")

edits_since_evidence = 0   # LANDED edits of THIS file since the last evidence call

try:
    # Pass 1 — collect tool_use ids whose result was an error. An edit that was
    # blocked (by another hook) or that failed ("String to replace not found")
    # changed nothing, so counting it inflates the churn number and makes the
    # warning state a count that never happened. Measured 2026-07-27: this hook
    # reported "2/3" when exactly one edit had landed, because a precode_gate
    # block counted as an edit. A gate that reports a wrong number is the defect
    # class W4 exists to stop.
    blocks = []
    error_ids = set()
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
                if not isinstance(blk, dict):
                    continue
                if blk.get("type") == "tool_use":
                    blocks.append(blk)
                elif blk.get("type") == "tool_result" and blk.get("is_error"):
                    tid = blk.get("tool_use_id")
                    if tid:
                        error_ids.add(tid)

    # Pass 2 — count only landed edits.
    for blk in blocks:
        name = blk.get("name", "")
        binp = blk.get("input") or {}
        if name in EVIDENCE_TOOLS or any(s in name for s in EVIDENCE_SUBSTR):
            edits_since_evidence = 0     # new evidence → run resets
            continue
        if name in ("Edit", "Write", "NotebookEdit"):
            if blk.get("id") in error_ids:
                continue                 # blocked/failed → nothing landed
            fp = binp.get("file_path") or binp.get("notebook_path") or ""
            if isinstance(fp, str) and os.path.basename(fp) == edited_base:
                edits_since_evidence += 1
except Exception as e:
    logline(f"[{ts}] transcript scan fail: {e!r} — fail-open")
    sys.exit(0)

# The transcript may not yet contain the edit that triggered this hook.
if edits_since_evidence == 0:
    edits_since_evidence = 1

if edits_since_evidence < THRESHOLD:
    logline(f"[{ts}] {edited_base}: {edits_since_evidence}/{THRESHOLD} — pass")
    sys.exit(0)

# Warn only on the exact threshold crossing, not on every later edit, so a long
# deliberate editing run does not turn into a nag loop.
if edits_since_evidence > THRESHOLD:
    logline(f"[{ts}] {edited_base}: {edits_since_evidence} (>threshold) — already warned, pass")
    sys.exit(0)

logline(f"[{ts}] WARN — {edited_base}: {edits_since_evidence} edits, no evidence call in between")
sys.stderr.write(
    f"⚠️ CHURN-GUARD (CLAUDE.md 6.4b): {edited_base} — lần sửa thứ "
    f"{edits_since_evidence} liên tiếp mà KHÔNG có tool call sinh evidence nào xen giữa "
    f"(Bash/test/logcat/grep/graph).\n"
    f"   Đây là dấu hiệu đang code theo phỏng đoán, không theo failure mechanism.\n"
    f"   Trước khi sửa tiếp, trả lời W0 ô 4: cái gì SET giá trị đang gate vào, và nó có\n"
    f"   chạy trong kịch bản bug không? Chưa trả lời được → dừng sửa, đi lấy evidence.\n"
    f"   (2 lần fix hỏng cùng root cause → 6.4: bỏ và đổi đường tấn công; tiếp tục task theo B9.)\n"
)
sys.exit(2)
PY
rc=$?
[ "${rc}" -eq 2 ] && exit 2
exit 0
