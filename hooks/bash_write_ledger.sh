#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# bash_write_ledger.sh — PreToolUse/PostToolUse Hook: Concurrency-Safe Shell Ledger
#
# Records command line execution windows, session IDs, and timestamps into
# `.claude/audit-gate/bash_ledger.jsonl`. Enables post-fix verification gates to
# deterministically correlate source edits with exact tool invocation windows.
#
# Protocol: stdin JSON; exit 0 always (fail-open observability hook).
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"
LEDGER="${LOG_DIR}/bash_ledger.jsonl"

INPUT="$(cat)"
[ -z "${INPUT}" ] && exit 0

python3 <<PY
import sys, json, os, time

raw = """${INPUT}"""
ledger_path = "${LEDGER}"

try:
    data = json.loads(raw) if raw.strip() else {}
    sid = data.get("session_id") or data.get("sessionId") or "unknown_sid"
    tool = data.get("tool_name") or data.get("name") or "Bash"
    inp = data.get("tool_input") or data.get("input") or {}
    cmd = inp.get("command") or inp.get("CommandLine") or ""
    
    entry = {
        "ts": time.time(),
        "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sid": str(sid),
        "tool": str(tool),
        "cmd": str(cmd)[:500]
    }
    
    with open(ledger_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
except Exception:
    pass
PY

exit 0
