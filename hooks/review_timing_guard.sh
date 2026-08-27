#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# review_timing_guard.sh — PostToolUse hook: enforce CLAUDE.md W3 review TIMING.
#
# W3 says: review after the FIRST fix of each defect class, not at the end of the
# batch. review_gate.sh cannot enforce that — it runs at Stop, so by construction
# it only ever asks for a review once everything is already written. That is the
# exact shape W3 forbids (measured 2026-07-27: 5 fixes written then reviewed →
# the same 2 mistakes appeared in 3 of them; one review after fix #1 would have
# stopped the pattern at one instance).
#
# PROXY for "one fix", since "defect class" has no machine definition: a burst of
# .kt/.java edits CLOSED by an evidence call (build/test/logcat/graph). Landing a
# second burst with no review in between = "kept coding after fix #1".
#
# WARN (exit 2 → stderr to Claude) on the first .kt/.java edit that starts burst
# N>=2 since the last review. Warns once per burst count, never repeatedly.
# The edit already happened (PostToolUse) — this is a "go review now" signal.
#
# WHAT IT CANNOT DO: tell whether two fixes belong to the same defect class, or
# whether the review that ran actually looked at the right thing. It only stops
# fixes from stacking up unreviewed.
#
# Escape hatch: REVIEW_TIMING_GUARD=0 (logged). Fail-open on any internal error.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="${REPO_ROOT}/.claude/audit-gate"
mkdir -p "${LOG_DIR}"

# Drain stdin before any early exit, otherwise the caller gets EPIPE.
INPUT="$(cat)"

[ "${REVIEW_TIMING_GUARD:-1}" = "0" ] && exit 0

RT_INPUT="${INPUT}" RT_LOG="${LOG_DIR}/review_timing_guard.log" \
RT_TS="$(date +%Y-%m-%dT%H:%M:%S)" \
python3 <<'PY'
import os, sys, json

raw = os.environ.get("RT_INPUT", "")
log = os.environ.get("RT_LOG", "/dev/null")
ts  = os.environ.get("RT_TS", "?")

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
edited = inp.get("file_path") or inp.get("notebook_path") or "" if isinstance(inp, dict) else ""
if not isinstance(edited, str) or not edited.endswith((".kt", ".java")):
    sys.exit(0)

tp = d.get("transcript_path")
if not tp or not os.path.exists(tp):
    logline(f"[{ts}] transcript unreadable — fail-open")
    sys.exit(0)

# Mirrors review_gate.sh REVIEW_AGENTS/REVIEW_SKILLS/REVIEW_WORKFLOWS — keep in sync.
REVIEW_AGENTS = {
    "officereader-code-reviewer", "test-architect-seti", "android-principal-architect",
    "silent-failure-hunter", "code-reviewer", "pr-test-analyzer", "type-design-analyzer",
    "pr-review-toolkit:silent-failure-hunter", "pr-review-toolkit:code-reviewer",
    "pr-review-toolkit:pr-test-analyzer", "pr-review-toolkit:type-design-analyzer",
}
REVIEW_SKILLS = {"code-review", "review-pr", "pr-review-toolkit:review-pr", "review-changes"}
EVIDENCE_TOOLS = ("Bash",)
EVIDENCE_SUBSTR = ("gradle-build", "gradle-test", "adb-logcat", "adb-shell")

seen_edit = False       # an unclosed .kt/.java edit burst is open
closed_bursts = 0       # bursts closed by an evidence call since the last review

# Files whose content currently DIFFERS from HEAD. Used to tell a real change from
# the restore half of a RED-check cycle. Failure to resolve → empty set, and the
# `fp not in dirty_kt` test below then skips everything, i.e. fail-OPEN (silent),
# never a spurious block.
dirty_kt = set()
dirty_ok = False
try:
    import subprocess
    root = subprocess.run(["git", "-C", os.path.dirname(edited) or ".",
                           "rev-parse", "--show-toplevel"],
                          capture_output=True, text=True, timeout=10).stdout.strip()
    if root:
        dirty_ok = True
        for args in (["diff", "--name-only", "HEAD", "--", "*.kt", "*.java"],
                     ["ls-files", "--others", "--exclude-standard", "--", "*.kt", "*.java"]):
            r = subprocess.run(["git", "-C", root] + args,
                               capture_output=True, text=True, timeout=10)
            for line in r.stdout.splitlines():
                if line.strip():
                    dirty_kt.add(os.path.realpath(os.path.join(root, line.strip())))
except Exception as e:
    dirty_ok = False
    logline(f"[{ts}] git dirty query failed: {e!r} — bỏ qua lọc revert")

# The edit that triggered this hook: if it leaves the file identical to HEAD it is
# the restore half of a RED-check cycle, not a new fix. Nothing was added to the
# working tree, so there is nothing new to review.
if dirty_ok and os.path.realpath(edited) not in dirty_kt:
    logline(f"[{ts}] {os.path.basename(edited)}: revert về HEAD, không phải fix — pass")
    sys.exit(0)

try:
    # Pass 1 — tool_use blocks in order, plus the ids whose result errored. A
    # blocked or failed Edit landed nothing, so it must not open a burst
    # (measured 2026-07-27: a precode_gate block inflated this to "burst 4").
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

    # Pass 2 — walk the tool_use blocks in order.
    for blk in blocks:
        name = blk.get("name", "")
        binp = blk.get("input") or {}

        is_review = False
        if name in ("Agent", "Task") and binp.get("subagent_type", "") in REVIEW_AGENTS:
            is_review = True
        elif name == "Skill" and (binp.get("skill", "") or binp.get("command", "")) in REVIEW_SKILLS:
            is_review = True
        elif name == "Workflow" and ("multi-lens-audit" in (binp.get("name", "") or "")
                                     or "multi-lens-audit" in (binp.get("script", "") or "")):
            is_review = True
        if is_review:
            seen_edit = False
            closed_bursts = 0
            continue

        if name in ("Edit", "Write", "NotebookEdit"):
            if blk.get("id") in error_ids:
                continue                 # blocked/failed → nothing landed
            fp = binp.get("file_path") or binp.get("notebook_path") or ""
            if isinstance(fp, str) and fp.endswith((".kt", ".java")):
                # An edit that leaves the file identical to HEAD is a REVERT, not a
                # fix — most often the restore half of a RED-check mutation cycle,
                # which `check 2` makes mandatory. Counting it made this guard fire
                # repeatedly at someone doing the required verification (measured
                # 2026-07-27: 5 warnings during one textbook RED-check).
                if dirty_ok and os.path.realpath(fp) not in dirty_kt:
                    continue
                seen_edit = True
        elif name in EVIDENCE_TOOLS or any(s in name for s in EVIDENCE_SUBSTR):
            if seen_edit:
                closed_bursts += 1
                seen_edit = False
except Exception as e:
    logline(f"[{ts}] transcript scan fail: {e!r} — fail-open")
    sys.exit(0)

if closed_bursts < 1:
    logline(f"[{ts}] {os.path.basename(edited)}: burst 1, chưa cần review — pass")
    sys.exit(0)

# Warn only when this edit OPENS a new burst (previous one was closed by
# evidence). Mid-burst edits stay silent so a single fix is not nagged.
if seen_edit:
    logline(f"[{ts}] {os.path.basename(edited)}: đang giữa burst {closed_bursts+1} — pass")
    sys.exit(0)

logline(f"[{ts}] WARN — mở fix thứ {closed_bursts+1} mà chưa review fix trước "
        f"({os.path.basename(edited)})")
sys.stderr.write(
    f"⚠️ REVIEW-TIMING (CLAUDE.md W3): bạn vừa mở fix thứ {closed_bursts+1} trong lượt này,\n"
    f"   nhưng {closed_bursts} fix trước CHƯA qua reviewer context-sạch nào.\n"
    f"   W3: review NGAY SAU fix ĐẦU TIÊN của mỗi lớp defect — sửa hết rồi review một lần ở\n"
    f"   cuối nghĩa là kỹ thuật sai đã được nhân bản sang mọi fix trước khi có ai nhìn thấy.\n"
    f"   → Chạy officereader-code-reviewer (hoặc test-architect-seti / android-principal-architect)\n"
    f"     trên fix trước, áp bài học, RỒI mới làm tiếp.\n"
)
sys.exit(2)
PY
rc=$?
[ "${rc}" -eq 2 ] && exit 2
exit 0
