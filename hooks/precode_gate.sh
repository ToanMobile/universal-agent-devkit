#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# precode_gate.sh — PreToolUse hook: the only gate that runs BEFORE code is written.
#
# Everything else in this repo fires after the edit (PostToolUse) or at the end
# of the turn (Stop), so W0 — the pre-code gate — had zero enforcement: all five
# of its boxes were prose only.
#
# BLOCK (exit 2) when: about to Edit/Write a .kt/.java file that this session has
# never looked at — no Read of it, no Edit of it, and its name never appeared in
# any tool output (Grep hit, graph result, gradle/logcat line). That is editing
# blind, the crudest form of skipping W0 box 2.
#
# "Has this session looked at it?" is answered from TWO sources, in this order:
#   1. the read ledger written by read_ledger.sh (PostToolUse on Read) — the only
#      source that can see the turn currently running;
#   2. the session transcript — covers earlier turns, and also counts a name that
#      merely surfaced in tool output.
# Source 1 exists because the transcript is flushed in batches: without it, every
# file first Read inside a long turn was blocked on its very first Edit. See the
# header of read_ledger.sh for the measurement.
#
# WHAT IT CANNOT DO: judge whether you UNDERSTAND the failure mechanism (W0 box
# 4). No machine can. It only blocks touching a file you have not once looked at.
#
# ALLOWED without any prior look:
#   • creating a genuinely new file (nothing on disk to read)
#   • a file already edited earlier this session (you have engaged with it)
#   • anything that is not .kt/.java
#
# Escape hatch: PRECODE_GATE=0 (logged). Fail-open on any internal error — a bug
# in this gate must never stop work.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"

# Drain stdin before any early exit, otherwise the caller gets EPIPE.
INPUT="$(cat)"

[ "${PRECODE_GATE:-1}" = "0" ] && exit 0

PG_INPUT="${INPUT}" PG_LOG="${LOG_DIR}/precode_gate.log" \
PG_LEDGER="${LOG_DIR}/read_ledger.tsv" \
PG_TS="$(date +%Y-%m-%dT%H:%M:%S)" \
python3 <<'PY'
import os, sys, json

raw = os.environ.get("PG_INPUT", "")
log = os.environ.get("PG_LOG", "/dev/null")
ts  = os.environ.get("PG_TS", "?")

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
if not isinstance(path, str) or not path.endswith((".kt", ".java")):
    sys.exit(0)

base = os.path.basename(path)

# Creating a genuinely new file: nothing exists to have read.
if not os.path.exists(path):
    logline(f"[{ts}] {base}: file mới — pass")
    sys.exit(0)

looked = False

# ── Source 1: the read ledger (read_ledger.sh, PostToolUse on Read) ──────────
# Checked BEFORE the transcript because it is the only source that can see the
# turn currently running. The transcript is flushed in batches, so a Read made
# moments ago during this same turn is still buffered and invisible on disk —
# measured 2026-08-04, when an Edit was blocked while the file's name appeared
# 0 times across every transcript file in the project. Consulting the ledger
# does not widen what counts as "looked at": it is written only by Read, and a
# file that was never read appears in neither source and is still blocked.
ledger = os.environ.get("PG_LEDGER", "")
session = d.get("session_id") or ""
if ledger and os.path.exists(ledger):
    try:
        want = f"{session}\t{base}"
        with open(ledger) as fh:
            for entry in fh:
                if entry.rstrip("\n") == want:
                    looked = True
                    break
    except Exception as e:
        logline(f"[{ts}] ledger scan fail: {e!r} — falling through to transcript")

if looked:
    logline(f"[{ts}] {base}: đã Read trong phiên (ledger) — pass")
    sys.exit(0)

tp = d.get("transcript_path")
if not tp or not os.path.exists(tp):
    logline(f"[{ts}] transcript unreadable — fail-open")
    sys.exit(0)
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
                if not isinstance(blk, dict):
                    continue
                t = blk.get("type")
                if t == "tool_use":
                    # ONLY a Read counts as "looked at". Counting Edit/Write here
                    # was a self-disarming bug (measured 2026-07-27): a blind Edit
                    # ATTEMPT — even one that errored with "string not found" —
                    # marked the file as seen, so the gate could never block the
                    # retry. The action the gate exists to stop was disarming it.
                    # A legitimate prior edit needs no special case: the harness
                    # requires a Read before Edit, so that Read is in the transcript.
                    if blk.get("name") != "Read":
                        continue
                    binp = blk.get("input") or {}
                    fp = binp.get("file_path") or binp.get("notebook_path") or ""
                    if isinstance(fp, str) and os.path.basename(fp) == base:
                        looked = True
                elif t == "tool_result":
                    c = blk.get("content")
                    text = c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)
                    if base in text:
                        looked = True          # surfaced in grep/graph/gradle/logcat output
            if looked:
                break
except Exception as e:
    logline(f"[{ts}] transcript scan fail: {e!r} — fail-open")
    sys.exit(0)

if looked:
    logline(f"[{ts}] {base}: đã xem trong phiên — pass")
    sys.exit(0)

logline(f"[{ts}] BLOCK — {base}: sửa file chưa từng xem trong phiên")
sys.stderr.write(
    f"⛔ PRE-CODE GATE (CLAUDE.md W0 ô 2): sắp sửa {base} mà phiên này CHƯA HỀ xem nó.\n"
    f"   Không có Read, không có Edit, tên file cũng chưa xuất hiện trong bất kỳ tool output nào\n"
    f"   (grep / graph / gradle / logcat). Đây là sửa mù.\n"
    f"\n"
    f"   Trước khi sửa, điền W0:\n"
    f"     ô 2 — Read đúng vùng sẽ sửa (file dirty thì Read, đừng tin graph)\n"
    f"     ô 3 — nếu đụng signature/base member/public API: liệt kê consumer, GỒM src/test\n"
    f"     ô 4 — failure mechanism + cách chứng minh fix đổi observable behavior\n"
    f"\n"
    f"   Gate này chỉ chặn được 'chưa từng xem'; nó KHÔNG kiểm được bạn có hiểu bug hay không.\n"
    f"   Tạo file mới thì không bị chặn. Escape hatch có chủ đích: PRECODE_GATE=0.\n"
)
sys.exit(2)
PY
rc=$?
[ "${rc}" -eq 2 ] && exit 2
exit 0
