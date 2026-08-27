#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# gate_stats.sh — tally deterministic-gate BLOCK events for the Rule 5.7 weekly
# review. Turns the manual "đọc tất cả entry" step into a data-driven summary.
#
# Reads the append-only logs written by the Stop hooks:
#   .claude/audit-gate/claim_check.log   (Check A citations + Check C past-action)
#   .claude/audit-gate/review_gate.log   (.kt/.java unreviewed)
#
# Usage:  bash .claude/knowledge/gate_stats.sh [SINCE]
#   SINCE = ISO date prefix (e.g. 2026-06-03) to count only entries on/after it.
#           Default: all entries.
# Output: counts per gate/category. Read-only; never blocks anything.
# ─────────────────────────────────────────────────────────────────────────────
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GATE_DIR="${REPO_ROOT}/.claude/audit-gate"
SINCE="${1:-0000-00-00}"

CC="${GATE_DIR}/claim_check.log"
RG="${GATE_DIR}/review_gate.log"

GATE_DIR="$GATE_DIR" SINCE="$SINCE" CC="$CC" RG="$RG" python3 <<'PY'
import os, re
since = os.environ["SINCE"]
cc = os.environ["CC"]; rg = os.environ["RG"]

def rows(path):
    if not os.path.exists(path):
        return []
    out = []
    for ln in open(path):
        m = re.match(r"\[(\d{4}-\d{2}-\d{2})[T ]?[\d:]*\]\s*(.*)", ln.strip())
        if not m:
            continue
        date, body = m.group(1), m.group(2)
        if date >= since:
            out.append((date, body))
    return out

cc_rows = rows(cc); rg_rows = rows(rg)

cc_cite = sum(1 for _, b in cc_rows if "unsourced citations" in b and "[]" not in b.split("unsourced citations:")[1][:6])
cc_past = sum(1 for _, b in cc_rows if "unbacked past-actions" in b and not b.rstrip().endswith("[]"))
cc_block = sum(1 for _, b in cc_rows if b.startswith("BLOCK"))
cc_pass = sum(1 for _, b in cc_rows if "pass" in b)
rg_block = sum(1 for _, b in rg_rows if b.startswith("BLOCK") and "suppressed" not in b)
rg_pass = sum(1 for _, b in rg_rows if "pass" in b)

print(f"=== Deterministic-gate stats (since {since}) ===")
print(f"claim_check.log : {len(cc_rows)} entries")
print(f"  • BLOCK total            : {cc_block}")
print(f"      - citation (Check A)  : {cc_cite}")
print(f"      - past-action (Check C): {cc_past}")
print(f"  • pass                   : {cc_pass}")
print(f"review_gate.log : {len(rg_rows)} entries")
print(f"  • BLOCK (.kt/.java)       : {rg_block}")
print(f"  • pass                   : {rg_pass}")
print()
print("→ Mỗi BLOCK = 1 lần gate chặn fabrication/skip-review TRƯỚC khi tới User.")
print("  Ghi các BLOCK đáng chú ý vào section 3 của rule5_validation.md (Mode=A:gate).")
PY
