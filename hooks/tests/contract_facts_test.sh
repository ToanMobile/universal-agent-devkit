#!/usr/bin/env bash
# contract_facts_test.sh — mọi FACT ĐO ĐƯỢC mà file rule khẳng định phải sinh lại được
# từ hệ thống thật. Rule 5 áp cho mọi văn bản phát ra, và file rule là văn bản.
#
# Vì sao tồn tại (ca đo 2026-07-28):
#   • `50` (CLAUDE.md) vs `40` (machine_gate_layer.md) vs `53` (thật) — lệch 3 chiều, sống nhiều ngày.
#   • `140` lần review_gate tự thả (CLAUDE.md) vs `149` (thật) — số TĂNG theo thời gian nên viết
#     dạng đẳng thức là bịa có hẹn giờ; contract phải viết dạng SÀN (`≥N`), test assert sàn ≤ thật.
#
# Contract của chính test này: nó chỉ kiểm FACT ĐO ĐƯỢC, không kiểm ý kiến/thiết kế.
# Case đỏ = rule và hệ thống đang mâu thuẫn: sửa MỘT TRONG HAI, cấm nới case cho xanh (W4).
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT" || exit 1

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  ok   %-52s %s\n' "$1" "${2:-}"; }
bad()  { FAIL=$((FAIL+1)); printf '  DEVIATING  %-46s %s\n' "$1" "${2:-}"; }

echo "contract_facts_test.sh — rule ↔ hệ thống"
echo

# ── A1. số contract point của hook harness ──────────────────────────────────
echo "A1. hook harness contract-point count"
REAL_CP=$(bash .claude/hooks/tests/hook_contract_test.sh 2>/dev/null \
          | sed -n 's/.*contract points: \([0-9]\{1,\}\) ok.*/\1/p' | tail -1)
if [ -z "$REAL_CP" ]; then
  bad "harness không trả được số" "không parse nổi 'contract points: N ok'"
else
  for f in CLAUDE.md .claude/knowledge/machine_gate_layer.md; do
    CLAIMED=$(grep -oE '[0-9]{1,4} contract' "$f" | grep -oE '^[0-9]{1,4}' | head -1)
    if [ -z "$CLAIMED" ]; then
      bad "$f không khai số contract point" "harness thật = $REAL_CP"
    elif [ "$CLAIMED" = "$REAL_CP" ]; then
      ok "$f khai $CLAIMED" "khớp harness"
    else
      bad "$f khai $CLAIMED" "harness thật = $REAL_CP"
    fi
  done
fi
echo

# ── A2/A3. wiring thật ↔ mô tả trong § TẦNG GATE MÁY ────────────────────────
echo "A2/A3. hook wiring ↔ mô tả trong CLAUDE.md § C"
python3 - "$REAL_CP" <<'PY'
import json, os, re, sys, glob

def out(okk, name, detail=""):
    print(("  ok   %-52s %s" if okk else "  DEVIATING  %-46s %s") % (name, detail))
    return 0 if okk else 1

fails = 0
wired = {}          # basename -> set(events)
for p in glob.glob(".claude/settings*.json"):
    try:
        d = json.load(open(p))
    except Exception:
        continue
    for ev, arr in (d.get("hooks") or {}).items():
        for m in arr:
            for c in m.get("hooks", []):
                cmd = c.get("command", "")
                for b in re.findall(r"([a-z0-9_\-]+\.sh)", cmd):
                    wired.setdefault(b, set()).add(ev)

rule = open("CLAUDE.md", encoding="utf-8").read()
# khối § C: dòng "CHẶN THẬT" và dòng "CHỈ CẢNH BÁO"
def names_in(marker):
    i = rule.find(marker)
    if i < 0: return None
    chunk = rule[i:i+700]
    return set(re.findall(r"`([a-z0-9_\-]+)`", chunk))

blocking_claimed = names_in("CHẶN THẬT")
warn_claimed     = names_in("CHỈ CẢNH BÁO")

blocking_real = {b[:-3] for b, evs in wired.items() if evs & {"PreToolUse", "Stop"}}
warn_real     = {b[:-3] for b, evs in wired.items() if evs & {"PostToolUse"}}

if blocking_claimed is None:
    fails += out(False, "không tìm thấy khối 'CHẶN THẬT' trong CLAUDE.md")
else:
    missing = blocking_real - blocking_claimed
    fails += out(not missing, "hook CHẶN thật đều được § C nêu tên",
                 "thiếu: " + ", ".join(sorted(missing)) if missing else
                 "%d hook" % len(blocking_real))

if warn_claimed is None:
    fails += out(False, "không tìm thấy khối 'CHỈ CẢNH BÁO' trong CLAUDE.md")
else:
    missing = warn_real - warn_claimed
    fails += out(not missing, "hook CẢNH BÁO thật đều được § C nêu tên",
                 "thiếu: " + ", ".join(sorted(missing)) if missing else
                 "%d hook" % len(warn_real))
    # chiều ngược: § C nêu tên hook CẢNH BÁO mà thực tế lại đang CHẶN → nguy hiểm hơn
    lying = (warn_claimed & blocking_real)
    fails += out(not lying, "không hook nào bị § C mô tả nhẹ hơn thực tế",
                 "mô tả sai: " + ", ".join(sorted(lying)) if lying else "")

# A4. file hook trên đĩa mà KHÔNG wire phải được tài liệu hoá là gỡ có chủ đích
docs = ""
for p in (".claude/knowledge/machine_gate_layer.md",):
    if os.path.exists(p):
        docs += open(p, encoding="utf-8").read()
for f in sorted(glob.glob(".claude/hooks/*.sh")):
    b = os.path.basename(f)
    if b in wired:
        continue
    stem = b[:-3]
    documented = re.search(re.escape(stem) + r"[^\n]{0,120}(GỠ khỏi wiring|gỡ khỏi wiring)", docs)
    fails += out(bool(documented), "hook không wire '%s' được tài liệu hoá" % stem,
                 "" if documented else "có trên đĩa, không wire, không có dòng 'GỠ khỏi wiring'")

sys.exit(1 if fails else 0)
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
echo

# ── A5. cấm citation số DÒNG trong file rule ────────────────────────────────
# Bắt CẢ HAI dạng: trần `:246` và đầy đủ `Foo.kt:412`. Mutation 2026-07-28: bản đầu chỉ
# grep dạng trần nên mù đúng dạng phổ biến nhất — test xanh vì đo nhầm thứ.
# Placeholder minh hoạ (path KHÔNG resolve, vd `Foo.kt:123`) không tính: nó không rữa được.
echo "A5. không citation số dòng trong file rule (số HIỆU là contract, số DÒNG thì không)"
python3 - <<'PY'
import os, re, sys, glob
files = ["CLAUDE.md", "AGENTS.md"] + sorted(glob.glob(".claude/commands/*.md"))
bare  = re.compile(r"`:\d+")
full  = re.compile(r"`([A-Za-z0-9_./-]+\.[A-Za-z0-9]+):(\d+)")
hits  = []
for f in files:
    if not os.path.exists(f): continue
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        for m in bare.finditer(line):
            hits.append("%s:%d dạng trần %s" % (f, n, m.group(0)))
        for m in full.finditer(line):
            p = m.group(1)
            # chỉ tính khi path trỏ tới file THẬT — placeholder minh hoạ thì không rữa
            real = os.path.exists(p) or bool(glob.glob("**/" + os.path.basename(p), recursive=True))
            if real:
                hits.append("%s:%d trỏ file thật %s:%s" % (f, n, p, m.group(2)))
if hits:
    print("  DEVIATING  %-46s %s" % ("còn citation số dòng", hits[0]))
    for h in hits[1:3]: print("  %54s %s" % ("", h))
    sys.exit(1)
print("  ok   %-52s %s" % ("0 citation số dòng (cả 2 dạng)", "placeholder minh hoạ được miễn"))
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
echo

# ── A6. counter TĂNG THEO THỜI GIAN phải viết dạng SÀN và sàn phải đúng ─────
echo "A6. counter dạng sàn (≥N) ↔ log thật"
LOG=".claude/audit-gate/review_gate.log"
CLAIM=$(grep -oE 'tự thả sau [0-9]+ lần nhắc \(đã xảy ra ≥?[0-9]+ lần' CLAUDE.md | grep -oE '≥?[0-9]+ lần$' | grep -oE '[0-9]+')
FLOOR_FORM=$(grep -cE 'đã xảy ra ≥[0-9]+ lần' CLAUDE.md)
if [ ! -f "$LOG" ]; then
  ok "review_gate.log chưa tồn tại" "bỏ qua (không có log để đối chiếu)"
elif [ -z "$CLAIM" ]; then
  bad "không parse được counter review_gate trong CLAUDE.md"
else
  REAL=$(grep -c "BLOCK suppressed after" "$LOG")
  if [ "$FLOOR_FORM" -eq 0 ]; then
    bad "counter viết dạng đẳng thức ($CLAIM)" "số tăng theo thời gian PHẢI viết '≥N'; thật = $REAL"
  elif [ "$CLAIM" -le "$REAL" ]; then
    ok "sàn ≥$CLAIM ≤ thật $REAL"
  else
    bad "sàn ≥$CLAIM > thật $REAL" "contract nói quá"
  fi
fi
echo

# ── A7. mã hiệu được cite phải TỒN TẠI ──────────────────────────────────────
echo "A7. mã hiệu B*/W* được cite đều có định nghĩa"
python3 - <<'PY'
import re, sys
rule = open("CLAUDE.md", encoding="utf-8").read()
defined_b = set(re.findall(r"^\*\*(B\d+)\.", rule, re.M))
defined_w = set(re.findall(r"^### (W\d+)", rule, re.M))
cited_b   = set(re.findall(r"`(B\d+)`", rule))
cited_w   = set(re.findall(r"`(W\d+)`", rule))
fails = 0
for kind, cited, defined in (("B", cited_b, defined_b), ("W", cited_w, defined_w)):
    miss = cited - defined
    if miss:
        print("  DEVIATING  %-46s %s" % ("mã %s cite nhưng không định nghĩa" % kind, ", ".join(sorted(miss))))
        fails += 1
    else:
        print("  ok   %-52s %d mã" % ("mọi mã %s được cite đều tồn tại" % kind, len(cited)))
# legend phải phủ hết dải B đã định nghĩa
m = re.search(r"`B1-B(\d+)`", rule)
hi = max(int(x[1:]) for x in defined_b) if defined_b else 0
if not m or int(m.group(1)) != hi:
    print("  DEVIATING  %-46s %s" % ("legend B1-B? lệch dải thật", "legend=%s, cao nhất=B%d" % (m.group(0) if m else "?", hi)))
    fails += 1
else:
    print("  ok   %-52s %s" % ("legend khớp dải B thật", m.group(0)))
sys.exit(1 if fails else 0)
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
echo

# ── A8. anti-loop đổi đường tấn công, không kết thúc task sớm ─────────────────
echo "A8. anti-loop không biến hai lần thất bại thành kết thúc task"
python3 - <<'PY'
import pathlib, re, sys

checks = [
    (
        pathlib.Path(".claude/rulebook/44-systematic-debugging.md"),
        re.compile(r"2 failed fix attempts[\s\S]{0,180}(?:đổi|abandon).{0,80}(?:hypothesis|đường tấn công)", re.I),
        re.compile(r"2 failed fix attempts[\s\S]{0,180}(?:ask for human insight|kết thúc lượt|end the task)", re.I),
    ),
    (
        pathlib.Path(".claude/hooks/test_evidence_gate.sh"),
        re.compile(r"2 lần fix thất bại[\s\S]{0,220}đổi.{0,80}đường tấn công", re.I),
        re.compile(r"2 lần fix thất bại[\s\S]{0,120}STOP \+ escalate User, đừng fix tiếp", re.I),
    ),
]

failed = []
for path, required, forbidden in checks:
    text = path.read_text(encoding="utf-8")
    if not required.search(text):
        failed.append(f"{path}: thiếu nghĩa vụ đổi đường tấn công")
    if forbidden.search(text):
        failed.append(f"{path}: còn semantic kết thúc/hỏi User sau hai lần")

if failed:
    for item in failed:
        print(f"  DEVIATING  {item}")
    sys.exit(1)

print("  ok   hai lần thất bại chỉ đổi đường tấn công; task vẫn theo B9")
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
echo

# ── A9. bug-fix proof luôn là paired executable oracle ───────────────────────
echo "A9. bug fix không có waiver cho paired executable RED→GREEN"
python3 - <<'PY'
import pathlib, re, sys

required_files = [
    pathlib.Path("AGENTS.md"),
    pathlib.Path("CLAUDE.md"),
    pathlib.Path(".claude/commands/fix.md"),
    pathlib.Path(".claude/commands/plan.md"),
    pathlib.Path(".claude/rulebook/23-ai-workflow.md"),
    pathlib.Path(".claude/rulebook/42-qa-test-cases.md"),
    pathlib.Path(".claude/rulebook/44-systematic-debugging.md"),
    pathlib.Path(".claude/rulebook/45-tdd-enforcement.md"),
    pathlib.Path(".claude/skills/tdd-workflow/SKILL.md"),
    pathlib.Path(".claude/skills/verification-before-completion/SKILL.md"),
    pathlib.Path(".claude/skills/triage-crashlytics-bug/SKILL.md"),
]
marker = re.compile(r"PAIRED EXECUTABLE ORACLE", re.I)
mandatory = re.compile(r"\bmandatory\b|bắt buộc", re.I)
no_waiver = re.compile(r"(?:\bno\b|không(?:\s+có)?)\s+(?:RED\s+)?waiver", re.I)
contradiction = re.compile(
    r"PAIRED EXECUTABLE ORACLE[\s\S]{0,160}(?:optional|tùy chọn|waiver allowed|được phép waiver|có thể waive)",
    re.I,
)
waiver_contradiction = re.compile(
    r"(?:ngoại lệ|exception)[^.\n]{0,120}(?:RED|oracle)[^.\n]{0,80}(?:miễn|waive)"
    r"|(?:RED|oracle)[^.\n]{0,120}(?:có thể|được phép)[^.\n]{0,40}(?:miễn|waive)"
    r"|(?:ngoại lệ|exception)[^.\n]{0,120}(?:bỏ qua|skip)[^.\n]{0,40}(?:RED|oracle)"
    r"|(?:RED|oracle)[^.\n]{0,100}(?:không bắt buộc|not mandatory|may be skipped|can be skipped|có thể bỏ qua)",
    re.I,
)
forbidden = {
    pathlib.Path("AGENTS.md"): [r"write a RED test where feasible"],
    pathlib.Path(".claude/commands/fix.md"): [
        r"RED[^.\n]{0,100}khi feasible",
        r"waive automated RED",
        r"regressionProofs:[^\n]*waiver",
        r"Không có RED an toàn phải dùng waiver",
    ],
    pathlib.Path(".claude/rulebook/23-ai-workflow.md"): [r"test first where feasible"],
    pathlib.Path(".claude/rulebook/42-qa-test-cases.md"): [r"automation where feasible"],
    pathlib.Path(".claude/rulebook/45-tdd-enforcement.md"): [
        r"failing test/report/log/device repro hoặc baseline revision",
    ],
    pathlib.Path(".claude/skills/tdd-workflow/SKILL.md"): [
        r"failing test, report, log, device repro hoặc baseline revision",
    ],
    pathlib.Path(".claude/skills/triage-crashlytics-bug/SKILL.md"): [
        r"failure mechanism khi feasible",
        r"report/log/device/baseline evidence",
    ],
}
compile_red_blanket = re.compile(
    r"RED[^.\n]{0,160}(?:compile|biên dịch)[^.\n]{0,100}(?:không tính|does not count)"
    r"|(?:compiler|compile|biên dịch)[^.\n]{0,100}(?:never valid|không bao giờ hợp lệ)[^.\n]{0,80}RED",
    re.I,
)
compile_acceptance_exception = re.compile(
    r"(?:acceptance|tiêu chí)[^.\n]{0,120}(?:compile|build|biên dịch)[^.\n]{0,100}(?:lỗi|failure)",
    re.I,
)

failed = []
for path in required_files:
    text = path.read_text(encoding="utf-8")
    match = marker.search(text)
    if not match:
        failed.append(f"{path}: thiếu PAIRED EXECUTABLE ORACLE")
    else:
        window = text[max(0, match.start() - 80):match.end() + 700]
        if not mandatory.search(window):
            failed.append(f"{path}: paired oracle không được ghi là mandatory/bắt buộc")
        if not no_waiver.search(window):
            failed.append(f"{path}: paired oracle thiếu semantic no-waiver")
    if contradiction.search(text):
        failed.append(f"{path}: paired oracle bị nới thành optional/waivable")
    if waiver_contradiction.search(text):
        failed.append(f"{path}: còn ngoại lệ miễn/waive RED hoặc oracle")
    for pattern in forbidden.get(path, []):
        if re.search(pattern, text, re.I):
            failed.append(f"{path}: còn loophole `{pattern}`")
    for match in compile_red_blanket.finditer(text):
        window = text[max(0, match.start() - 240):match.end() + 240]
        if not compile_acceptance_exception.search(window):
            failed.append(f"{path}: blanket loại compile RED dù acceptance có thể là compile/build failure")

for mutant in (
    "PAIRED EXECUTABLE ORACLE is optional; waiver allowed.",
    "PAIRED EXECUTABLE ORACLE bắt buộc khi tiện; có thể waive.",
    "PAIRED EXECUTABLE ORACLE bắt buộc.",
    "PAIRED EXECUTABLE ORACLE bắt buộc, không có waiver. Ngoại lệ: RED có thể được miễn cho bug khó tái hiện.",
    "PAIRED EXECUTABLE ORACLE bắt buộc, không có waiver. Ngoại lệ: có thể bỏ qua RED cho bug khó tái hiện.",
    "PAIRED EXECUTABLE ORACLE bắt buộc, không có waiver. RED không bắt buộc với bug khó tái hiện.",
):
    window = mutant
    if (marker.search(mutant) and mandatory.search(window) and no_waiver.search(window)
            and not contradiction.search(mutant) and not waiver_contradiction.search(mutant)):
        failed.append(f"semantic checker chấp nhận mutant: {mutant}")

for mutant in (
    "RED phải đúng symptom; compile failure không tính.",
    "RED must match the symptom; compile failure does not count.",
    "Compiler errors are never valid RED evidence.",
):
    match = compile_red_blanket.search(mutant)
    window = mutant if match else ""
    if not match or compile_acceptance_exception.search(window):
        failed.append(f"compile checker chấp nhận blanket mutant: {mutant}")

if failed:
    for item in failed:
        print(f"  DEVIATING  {item}")
    sys.exit(1)

print("  ok   mọi bug fix bind cùng executable oracle trước/sau; không có RED waiver")
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
echo

# ── A10. progress/checkpoint không được biến thành điểm kết thúc ─────────────
echo "A10. agent tự tiếp tục đến terminal hợp lệ"
python3 - <<'PY'
import pathlib, re, sys

paths = [
    pathlib.Path("AGENTS.md"),
    pathlib.Path("CLAUDE.md"),
    pathlib.Path(".claude/commands/fix.md"),
    pathlib.Path(".claude/rulebook/23-ai-workflow.md"),
]
required = re.compile(r"không bao giờ yêu cầu User gõ `continue`/`làm tiếp`", re.I)
contradiction = re.compile(
    r"(?:luôn|(?<!không )phải|hãy|cần)[^.\n]{0,80}yêu cầu User gõ `?(?:continue|làm tiếp)`?"
    r"|(?:chỉ tiếp tục|continue only)[^.\n]{0,80}(?:sau khi|khi)[^.\n]{0,50}(?:User|người dùng)[^.\n]{0,30}`?(?:continue|làm tiếp)`?"
    r"|(?:sau checkpoint|after checkpoint)[^.\n]{0,80}(?:chờ|wait)[^.\n]{0,50}(?:User|người dùng)[^.\n]{0,30}`?(?:continue|làm tiếp)`?",
    re.I,
)
failed = []
for path in paths:
    text = path.read_text(encoding="utf-8")
    if not required.search(text):
        failed.append(f"{path}: thiếu lệnh cấm dừng giữa chừng/hỏi gõ tiếp")
    if contradiction.search(text):
        failed.append(f"{path}: còn lệnh yêu cầu User gõ tiếp sau checkpoint")

for mutant in (
    "không bao giờ yêu cầu User gõ `continue`/`làm tiếp`. Nhưng sau mỗi checkpoint, luôn yêu cầu User gõ `continue` để làm tiếp.",
    "không bao giờ yêu cầu User gõ `continue`/`làm tiếp`. Khi progress xong, phải yêu cầu User gõ `làm tiếp`.",
    "không bao giờ yêu cầu User gõ `continue`/`làm tiếp`. Agent chỉ tiếp tục sau khi User gõ `continue`.",
    "không bao giờ yêu cầu User gõ `continue`/`làm tiếp`. Sau checkpoint, chờ User nhắn `làm tiếp` rồi mới tiếp tục.",
):
    if required.search(mutant) and not contradiction.search(mutant):
        failed.append(f"semantic checker chấp nhận mutant: {mutant}")

if failed:
    for item in failed:
        print(f"  DEVIATING  {item}")
    sys.exit(1)

print("  ok   progress/checkpoint không terminal; agent tiếp tục tới B9 terminal")
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
echo

echo "─────────────────────────────────────────────"
echo "contract facts: ${PASS} ok, ${FAIL} deviating"
[ "$FAIL" -eq 0 ] || {
  echo "Sửa RULE hoặc sửa HỆ THỐNG — cấm nới case cho xanh (CLAUDE.md W4)."
  exit 1
}
