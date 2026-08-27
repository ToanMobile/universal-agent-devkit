#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# read_ledger.sh — PostToolUse hook on Read. Records "this session looked at
# <file>" the instant it happens.
#
# WHY THIS EXISTS. precode_gate.sh answers "has this session looked at the file
# I am about to edit?" by scanning the session transcript. That answer is only
# as fresh as the transcript on disk, and the transcript is flushed in batches:
# tool calls made during the CURRENTLY RUNNING turn are still buffered and
# appear nowhere on disk. Measured 2026-08-04: the string
# "CrossScreenExtendedTest.kt" appeared 0 times across all 18 transcript files
# in this project directory while an Edit of that very file was being blocked,
# moments after it had been Read. The failure mode is systematic, not a race —
# every .kt/.java file first touched inside a long turn is unreachable, which is
# exactly the Read-then-Edit sequence W0 box 2 asks for. A gate that fires
# hardest on correct behaviour teaches people to reach for PRECODE_GATE=0.
#
# The fix is to stop depending on flush timing: this hook writes the fact down
# synchronously, and precode_gate consults the ledger alongside the transcript.
# It does NOT relax the gate — a file that was genuinely never read appears in
# neither source and is still blocked.
#
# ONLY Read is recorded. Recording Edit/Write here would re-introduce the
# self-disarming bug documented in precode_gate.sh: a blind edit ATTEMPT would
# mark the file as seen and clear the way for its own retry.
#
# Always exits 0. A PostToolUse hook runs after the edit has already happened,
# so it can only ever report — never block — and a bug in bookkeeping must not
# interrupt work.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}" 2>/dev/null || true

# Drain stdin before any early exit, otherwise the caller gets EPIPE.
INPUT="$(cat)"

[ "${READ_LEDGER:-1}" = "0" ] && exit 0

RL_INPUT="${INPUT}" RL_LEDGER="${LOG_DIR}/read_ledger.tsv" python3 <<'PY' 2>/dev/null || true
import os, sys, json

raw    = os.environ.get("RL_INPUT", "")
ledger = os.environ.get("RL_LEDGER", "")

try:
    d = json.loads(raw)
except Exception:
    sys.exit(0)
if not isinstance(d, dict) or not ledger:
    sys.exit(0)

inp = d.get("tool_input")
if not isinstance(inp, dict):
    sys.exit(0)

path = inp.get("file_path") or inp.get("notebook_path") or ""
if not isinstance(path, str) or not path:
    sys.exit(0)

# Only source files matter here; precode_gate ignores everything else anyway.
if not path.endswith((".kt", ".java")):
    sys.exit(0)

session = d.get("session_id") or ""
if not isinstance(session, str):
    session = ""

base = os.path.basename(path)

try:
    with open(ledger, "a") as fh:
        fh.write(f"{session}\t{base}\n")
except Exception:
    sys.exit(0)

# Bound the file so a long-lived project cannot grow it without limit. The tail
# is what matters: entries are only ever consulted for the CURRENT session.
try:
    with open(ledger) as fh:
        lines = fh.readlines()
    if len(lines) > 5000:
        with open(ledger, "w") as fh:
            fh.writelines(lines[-2500:])
except Exception:
    pass
PY

exit 0
