#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# hook_contract_test.sh — regression harness for the gate layer.
#
# CLAUDE.md § TẦNG GATE MÁY listed as residual #1: "không có harness test nào
# được commit cho bất kỳ hook nào — regression ở 5 gate chặn thật hiện không
# phát hiện được". This is that harness. Measured 2026-07-28: a false positive
# in test_evidence_gate.sh (a quoted PROHIBITION read as a test-pass claim)
# reached a live turn and blocked a documentation answer; nothing would have
# caught it before a human did.
#
# The expectations below are derived from each hook's own documented contract
# (its header block), NOT from observing what the code currently does — a test
# written to match current behaviour proves nothing. When a case fails, either
# the hook or its documented contract is wrong; both are findings.
#
# ISOLATION: every case runs with CLAUDE_PROJECT_DIR pointed at a fresh temp
# sandbox, so hooks write their logs/state there and read fixture files from
# there. The real repo's .claude/audit-gate is never touched. No gradle, no
# network, no device.
#
# WHAT THIS CANNOT DO:
#   • prove a gate catches every case of its rule — these are contract points,
#     not a proof of coverage;
#   • test testsourceset_gate's real compile path (it shells out to ./gradlew);
#     only its documented SKIP paths are covered here;
#   • say anything about whether the RULE behind a gate is the right rule.
#
# Usage: bash .claude/hooks/tests/hook_contract_test.sh
# Exit 0 = every contract point holds. Exit 1 = at least one deviation.
# bash 3.2 compatible.
# ─────────────────────────────────────────────────────────────────────────────
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
HOOKS="$(cd "${HERE}/.." && pwd)"

SANDBOX="$(mktemp -d "${TMPDIR:-/tmp}/hookharness.XXXXXX")"
trap 'rm -rf "${SANDBOX}"' EXIT
mkdir -p "${SANDBOX}/.claude/audit-gate"

PASS=0; FAIL=0; FAILED_CASES=""

# run_case <name> <hook.sh> <expected_exit> <stdin-json> [ENV=VAL ...]
run_case() {
  name="$1"; hook="$2"; want="$3"; payload="$4"; shift 4
  out="$(printf '%s' "${payload}" | env CLAUDE_PROJECT_DIR="${SANDBOX}" "$@" \
        bash "${HOOKS}/${hook}" 2>&1)"
  got=$?
  if [ "${got}" -eq "${want}" ]; then
    PASS=$((PASS + 1))
    printf '  ok   %-46s exit=%s\n' "${name}" "${got}"
  else
    FAIL=$((FAIL + 1))
    FAILED_CASES="${FAILED_CASES}
  ✗ ${name}
      hook=${hook} want exit=${want}, got=${got}
      output: $(printf '%s' "${out}" | head -3 | tr '\n' ' ')"
    printf '  FAIL %-46s want=%s got=%s\n' "${name}" "${want}" "${got}"
  fi
}

# ── fixtures ────────────────────────────────────────────────────────────────
KT_UNSEEN="${SANDBOX}/Unseen.kt"
KT_SEEN="${SANDBOX}/Seen.kt"
printf 'class Unseen\n' > "${KT_UNSEEN}"
printf 'class Seen\n'   > "${KT_SEEN}"

EMPTY_TR="${SANDBOX}/empty.jsonl"
: > "${EMPTY_TR}"

# read ledger: what read_ledger.sh writes at PostToolUse:Read, and the source
# precode_gate consults for the turn currently running (the transcript on disk
# lags a whole turn behind). Seeded for session SESS-A only, so the same file
# under a different session must still be treated as unseen.
LEDGER_DIR="${SANDBOX}/.claude/audit-gate"
mkdir -p "${LEDGER_DIR}"
LEDGER="${LEDGER_DIR}/read_ledger.tsv"
printf 'SESS-A\tSeen.kt\n' > "${LEDGER}"

# transcript: a Read of Seen.kt (satisfies precode_gate box 2)
SEEN_TR="${SANDBOX}/seen.jsonl"
python3 - "$SEEN_TR" "$KT_SEEN" <<'PY'
import json, sys
path, kt = sys.argv[1], sys.argv[2]
rec = {"message": {"content": [
    {"type": "tool_use", "name": "Read", "input": {"file_path": kt}}]}}
open(path, "w").write(json.dumps(rec) + "\n")
PY

# transcript: 3 consecutive edits of one file, no evidence-producing call between
CHURN_TR="${SANDBOX}/churn.jsonl"
python3 - "$CHURN_TR" "$KT_SEEN" <<'PY'
import json, sys
path, kt = sys.argv[1], sys.argv[2]
lines = []
for _ in range(3):
    lines.append(json.dumps({"message": {"content": [
        {"type": "tool_use", "name": "Edit",
         "input": {"file_path": kt, "old_string": "a", "new_string": "b"}}]}}))
open(path, "w").write("\n".join(lines) + "\n")
PY

# transcript: edits of one file WITH an evidence call (Bash) in between
EVID_TR="${SANDBOX}/evidence.jsonl"
python3 - "$EVID_TR" "$KT_SEEN" <<'PY'
import json, sys
path, kt = sys.argv[1], sys.argv[2]
edit = {"type": "tool_use", "name": "Edit",
        "input": {"file_path": kt, "old_string": "a", "new_string": "b"}}
bash = {"type": "tool_use", "name": "Bash",
        "input": {"command": "./gradlew :app:testDebugUnitTest"}}
lines = [json.dumps({"message": {"content": [c]}}) for c in (edit, bash, edit, bash, edit)]
open(path, "w").write("\n".join(lines) + "\n")
PY

DEVICE_ONLY_TR="${SANDBOX}/device-only.jsonl"
python3 - "$DEVICE_ONLY_TR" <<'PY'
import json, sys
path = sys.argv[1]
record = {"message": {"content": [{
    "type": "tool_use",
    "name": "Bash",
    "input": {"command": "adb devices"},
}]}}
open(path, "w").write(json.dumps(record) + "\n")
PY

ANONYMOUS_FIX_PROOF_TR="${SANDBOX}/anonymous-fix-proof.jsonl"
BASH_FIX_PROOF_TR="${SANDBOX}/bash-fix-proof.jsonl"
ERROR_FIX_PROOF_TR="${SANDBOX}/error-fix-proof.jsonl"
MISSING_PROVENANCE_TR="${SANDBOX}/missing-provenance.jsonl"
STALE_FIX_PROOF_TR="${SANDBOX}/stale-fix-proof.jsonl"
FAILED_EDIT_AFTER_PROOF_TR="${SANDBOX}/failed-edit-after-proof.jsonl"
UNKNOWN_EDIT_AFTER_PROOF_TR="${SANDBOX}/unknown-edit-after-proof.jsonl"
WRITER_AFTER_PROOF_TR="${SANDBOX}/writer-after-proof.jsonl"
ERROR_WRITER_AFTER_PROOF_TR="${SANDBOX}/error-writer-after-proof.jsonl"
ERROR_WRITE_AFTER_PROOF_TR="${SANDBOX}/error-write-after-proof.jsonl"
INTERLEAVED_WRITE_PROOF_TR="${SANDBOX}/interleaved-write-proof.jsonl"
OPEN_WRITE_BEFORE_PROOF_TR="${SANDBOX}/open-write-before-proof.jsonl"
LATE_WRITE_RESULT_PROOF_TR="${SANDBOX}/late-write-result-proof.jsonl"
CORRELATED_FIX_PROOF_TR="${SANDBOX}/correlated-fix-proof.jsonl"
CORRELATED_SCRIPT_PROOF_TR="${SANDBOX}/correlated-script-proof.jsonl"
FORGED_SCRIPT_PROOF_TR="${SANDBOX}/forged-script-proof.jsonl"
MIXED_LOCATOR_PROOF_TR="${SANDBOX}/mixed-locator-proof.jsonl"
CORRELATED_SKILL_PROOF_TR="${SANDBOX}/correlated-skill-proof.jsonl"
UNRELATED_RED_GREEN_TR="${SANDBOX}/unrelated-red-green.jsonl"
python3 - \
  "$ANONYMOUS_FIX_PROOF_TR" \
  "$BASH_FIX_PROOF_TR" \
  "$ERROR_FIX_PROOF_TR" \
  "$MISSING_PROVENANCE_TR" \
  "$STALE_FIX_PROOF_TR" \
  "$FAILED_EDIT_AFTER_PROOF_TR" \
  "$UNKNOWN_EDIT_AFTER_PROOF_TR" \
  "$WRITER_AFTER_PROOF_TR" \
  "$ERROR_WRITER_AFTER_PROOF_TR" \
  "$ERROR_WRITE_AFTER_PROOF_TR" \
  "$INTERLEAVED_WRITE_PROOF_TR" \
  "$OPEN_WRITE_BEFORE_PROOF_TR" \
  "$LATE_WRITE_RESULT_PROOF_TR" \
  "$CORRELATED_FIX_PROOF_TR" \
  "$CORRELATED_SCRIPT_PROOF_TR" \
  "$FORGED_SCRIPT_PROOF_TR" \
  "$MIXED_LOCATOR_PROOF_TR" \
  "$CORRELATED_SKILL_PROOF_TR" \
  "$UNRELATED_RED_GREEN_TR" \
  "$KT_SEEN" <<'PY'
import json, sys
(
    anonymous,
    bash_path,
    error_path,
    missing_provenance,
    stale,
    failed_edit_after_proof,
    unknown_edit_after_proof,
    writer_after_proof,
    error_writer_after_proof,
    error_write_after_proof,
    interleaved_write_proof,
    open_write_before_proof,
    late_write_result_proof,
    correlated,
    correlated_script,
    forged_script,
    mixed_locator,
    correlated_skill,
    unrelated_red_green,
    kt,
) = sys.argv[1:]
fixed_key = "reader|logic.wrong_branch|open|empty-input"
scope = "sha256:" + "a" * 64
current = "sha256:" + "b" * 64
content_hash = "sha256:" + "c" * 64
proof = {
    "schemaVersion": 3,
    "auditVerdict": "CLEAR",
    "terminalRecommendation": "AUDIT_CLEAR_NEEDS_EXTERNAL_GATES",
    "scopeFingerprint": scope,
    "verificationVerdict": "ASSERTED_ONLY",
    "fixedKeys": [fixed_key],
    "runId": "run-hook-contract",
    "runNonce": "nonce-hook-contract",
    "currentId": current,
    "contentHash": content_hash,
}

def write(path, blocks):
    with open(path, "w") as fh:
        for block in blocks:
            fh.write(json.dumps({"message": {"content": [block]}}) + "\n")

edit = {
    "type": "tool_use",
    "name": "Edit",
    "input": {"file_path": kt, "old_string": "a", "new_string": "b"},
}
workflow_use = {
    "type": "tool_use",
    "id": "toolu-proof",
    "name": "Workflow",
    "input": {"name": "multi-lens-audit"},
}
workflow_result = {
    "type": "tool_result",
    "tool_use_id": "toolu-proof",
    "is_error": False,
    "content": json.dumps(proof),
}

write(anonymous, [{"type": "tool_result", "content": json.dumps(proof)}])
write(bash_path, [
    {"type": "tool_use", "id": "toolu-proof", "name": "Bash",
     "input": {"command": "printf forged-proof"}},
    workflow_result,
])
write(error_path, [
    workflow_use,
    {**workflow_result, "is_error": True},
])
proof_without_provenance = dict(proof)
proof_without_provenance.pop("contentHash")
write(missing_provenance, [
    edit,
    workflow_use,
    {**workflow_result, "content": json.dumps(proof_without_provenance)},
])
write(stale, [workflow_use, workflow_result, edit])
failed_edit = {
    "type": "tool_use",
    "id": "toolu-failed-edit",
    "name": "Edit",
    "input": {"file_path": kt, "old_string": "missing", "new_string": "unused"},
}
failed_edit_result = {
    "type": "tool_result",
    "tool_use_id": "toolu-failed-edit",
    "is_error": True,
    "content": "old_string not found",
}
write(failed_edit_after_proof, [
    workflow_use,
    workflow_result,
    failed_edit,
    failed_edit_result,
])
write(unknown_edit_after_proof, [
    workflow_use,
    workflow_result,
    {**failed_edit, "id": "toolu-unknown-edit"},
])
writer_use = {
    "type": "tool_use",
    "id": "toolu-writer",
    "name": "Bash",
    "input": {"command": "python3 rewrite_scoped_file.py"},
}
writer_result = {
    "type": "tool_result",
    "tool_use_id": "toolu-writer",
    "is_error": False,
    "content": "rewrote scoped file",
}
write(writer_after_proof, [workflow_use, workflow_result, writer_use, writer_result])
write(error_writer_after_proof, [
    workflow_use,
    workflow_result,
    writer_use,
    {**writer_result, "is_error": True, "content": "writer changed bytes then exited nonzero"},
])
partial_write_use = {
    "type": "tool_use",
    "id": "toolu-partial-write",
    "name": "Write",
    "input": {"file_path": kt, "content": "partial"},
}
partial_write_result = {
    "type": "tool_result",
    "tool_use_id": "toolu-partial-write",
    "is_error": True,
    "content": "write failed after partial output",
}
write(error_write_after_proof, [
    workflow_use,
    workflow_result,
    partial_write_use,
    partial_write_result,
])
write(interleaved_write_proof, [
    workflow_use,
    {**partial_write_use, "id": "toolu-interleaved-write"},
    {
        **partial_write_result,
        "tool_use_id": "toolu-interleaved-write",
        "is_error": False,
        "content": "write completed",
    },
    workflow_result,
])
open_write = {**partial_write_use, "id": "toolu-open-write"}
write(open_write_before_proof, [open_write, workflow_use, workflow_result])
late_write_result = {
    **partial_write_result,
    "tool_use_id": "toolu-late-write",
    "is_error": False,
    "content": "write completed after audit result",
}
write(late_write_result_proof, [
    {**partial_write_use, "id": "toolu-late-write"},
    workflow_use,
    workflow_result,
    late_write_result,
])
write(correlated, [edit, workflow_use, workflow_result])
script_workflow_use = {
    "type": "tool_use",
    "id": "toolu-script-proof",
    "name": "Workflow",
    "input": {"script": ".claude/workflows/multi-lens-audit.js"},
}
script_workflow_result = {**workflow_result, "tool_use_id": "toolu-script-proof"}
write(correlated_script, [edit, script_workflow_use, script_workflow_result])
forged_script_use = {
    **script_workflow_use,
    "id": "toolu-forged-script-proof",
    "input": {"script": "/tmp/forged-multi-lens-audit-copy.js"},
}
forged_script_result = {**workflow_result, "tool_use_id": "toolu-forged-script-proof"}
write(forged_script, [edit, forged_script_use, forged_script_result])
mixed_locator_use = {
    **workflow_use,
    "id": "toolu-mixed-locator",
    "input": {
        "name": "multi-lens-audit",
        "script": "/tmp/forged-multi-lens-audit-copy.js",
    },
}
mixed_locator_result = {**workflow_result, "tool_use_id": "toolu-mixed-locator"}
write(mixed_locator, [edit, mixed_locator_use, mixed_locator_result])
skill_use = {
    "type": "tool_use",
    "id": "toolu-skill-proof",
    "name": "Skill",
    "input": {"skill": "multi-lens-audit"},
}
skill_result = {
    **workflow_result,
    "tool_use_id": "toolu-skill-proof",
    "content": [{"type": "text", "text": json.dumps(proof)}],
}
skill_result.pop("is_error")
write(correlated_skill, [edit, skill_use, skill_result])
write(unrelated_red_green, [{
    "type": "tool_result",
    "tool_use_id": "toolu-unrelated-test",
    "is_error": False,
    "content": "OtherFeatureTest FAILED\nOtherFeatureTest PASSED",
}])
PY

# mk_tr <out.jsonl> <tool> <file_path> <written-text> [WITH_SCAN]
# One-edit transcript; WITH_SCAN appends a security-checklist Skill call after it.
mk_tr() {
  python3 - "$1" "$2" "$3" "$4" "${5:-}" <<'PY'
import json, sys
out, tool, path, text, scan = sys.argv[1:6]
key = "content" if tool == "Write" else "new_string"
blocks = [{"type": "tool_use", "name": tool, "input": {"file_path": path, key: text}}]
if scan == "WITH_SCAN":
    blocks.append({"type": "tool_use", "name": "Skill", "input": {"skill": "security-checklist"}})
with open(out, "w") as fh:
    for b in blocks:
        fh.write(json.dumps({"message": {"content": [b]}}) + "\n")
PY
}

# Gradle test-results layout the gates glob for: <module>/build/test-results/<task>/
RED_XML_DIR="${SANDBOX}/app/build/test-results/testDebugUnitTest"
mkdir -p "${RED_XML_DIR}"

# mk_xml <dir> <suite> <tests> <failures> <errors> <skipped>
mk_xml() {
  cat > "$1/TEST-${2}.xml" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.${2}" tests="${3}" failures="${4}" errors="${5}" skipped="${6}">
  <testcase classname="com.example.${2}" name="doesSomething"/>
</testsuite>
XML
  touch "$1/TEST-${2}.xml"
}

echo "sandbox: ${SANDBOX}"
echo

# ── block-dangerous-git.sh — PreToolUse Bash ────────────────────────────────
echo "block-dangerous-git.sh"
run_case "destructive reset --hard blocked" block-dangerous-git.sh 2 \
  '{"tool_name":"Bash","tool_input":{"command":"git reset --hard HEAD~1"}}'
run_case "git clean -fd blocked"            block-dangerous-git.sh 2 \
  '{"tool_name":"Bash","tool_input":{"command":"git clean -fd"}}'
run_case "plain push allowed by design"     block-dangerous-git.sh 0 \
  '{"tool_name":"Bash","tool_input":{"command":"git push origin trunk"}}'
run_case "read-only git status allowed"     block-dangerous-git.sh 0 \
  '{"tool_name":"Bash","tool_input":{"command":"git status --short"}}'
# Quoted-but-EXECUTED must stay blocked — these pin the fail-closed half of the
# prose exemption added 2026-07-28. Before that change nothing tested them.
run_case "destructive cmd inside bash -c blocked" block-dangerous-git.sh 2 \
  '{"tool_name":"Bash","tool_input":{"command":"bash -c \"git reset --hard HEAD~1\""}}'
run_case "destructive cmd inside ssh blocked"     block-dangerous-git.sh 2 \
  '{"tool_name":"Bash","tool_input":{"command":"ssh buildbox \"git clean -fd\""}}'
run_case "destructive cmd in \$() blocked"        block-dangerous-git.sh 2 \
  '{"tool_name":"Bash","tool_input":{"command":"echo $(git reset --hard)"}}'
# Prose that merely mentions the command is not the command.
run_case "prose mentioning the phrase allowed"    block-dangerous-git.sh 0 \
  '{"tool_name":"Bash","tool_input":{"command":"echo \"đừng bao giờ chạy git reset --hard trên trunk\""}}'
run_case "commit message mentioning it allowed"   block-dangerous-git.sh 0 \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"docs: explain why git reset --hard is banned\""}}'
echo

# ── precode_gate.sh — PreToolUse Edit|Write ─────────────────────────────────
echo "precode_gate.sh"
run_case "edit unseen .kt blocked" precode_gate.sh 2 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_UNSEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
run_case "edit .kt read earlier allowed" precode_gate.sh 0 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${SEEN_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
run_case "brand-new file allowed" precode_gate.sh 0 \
  "{\"tool_name\":\"Write\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${SANDBOX}/BrandNew.kt\",\"content\":\"class BrandNew\"}}"
run_case "non-kotlin file allowed" precode_gate.sh 0 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${SANDBOX}/notes.md\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
run_case "escape hatch honoured" precode_gate.sh 0 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_UNSEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}" \
  PRECODE_GATE=0
# Ledger branch: the transcript is EMPTY in all three cases below, which is what
# the running turn actually looks like on disk. Without the ledger the first case
# is the false positive that blocked correct Read-then-Edit work (2026-08-04).
run_case "ledger hit allows edit despite empty transcript" precode_gate.sh 0 \
  "{\"tool_name\":\"Edit\",\"session_id\":\"SESS-A\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
run_case "ledger entry from another session does not count" precode_gate.sh 2 \
  "{\"tool_name\":\"Edit\",\"session_id\":\"SESS-B\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
run_case "ledger does not cover a file never read" precode_gate.sh 2 \
  "{\"tool_name\":\"Edit\",\"session_id\":\"SESS-A\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_UNSEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
echo

# ── read_ledger.sh — PostToolUse Read ───────────────────────────────────────
echo "read_ledger.sh"
run_case "records a Read of a .kt" read_ledger.sh 0 \
  "{\"tool_name\":\"Read\",\"session_id\":\"SESS-C\",\"tool_input\":{\"file_path\":\"${KT_UNSEEN}\"}}"
run_case "ignores a non-kotlin Read" read_ledger.sh 0 \
  "{\"tool_name\":\"Read\",\"session_id\":\"SESS-C\",\"tool_input\":{\"file_path\":\"${SANDBOX}/notes.md\"}}"
run_case "malformed payload never blocks" read_ledger.sh 0 "not json at all"
run_case "escape hatch honoured" read_ledger.sh 0 \
  "{\"tool_name\":\"Read\",\"session_id\":\"SESS-C\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\"}}" \
  READ_LEDGER=0
# End-to-end: the Read that read_ledger.sh just recorded (SESS-C / Unseen.kt)
# must be what unblocks the very next edit — the exact sequence W0 box 2 asks for.
run_case "recorded Read unblocks the next edit" precode_gate.sh 0 \
  "{\"tool_name\":\"Edit\",\"session_id\":\"SESS-C\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_UNSEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
# ...and the escape-hatch case above must have recorded NOTHING, so Seen.kt is
# still unseen for SESS-C even though a Read of it was issued.
run_case "escape-hatched Read records nothing" precode_gate.sh 2 \
  "{\"tool_name\":\"Edit\",\"session_id\":\"SESS-C\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
echo

# ── claim_check.sh — Stop ───────────────────────────────────────────────────
echo "claim_check.sh"
run_case "unsourced file:line citation blocked" claim_check.sh 2 \
  "{\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Lỗi nằm ở Ghost.kt:4211 trong nhánh cleanup.\"}"
run_case "message without citations allowed" claim_check.sh 0 \
  "{\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã đọc qua module và chưa thấy vấn đề nào đáng báo.\"}"
run_case "loop guard releases on 2nd pass" claim_check.sh 0 \
  "{\"transcript_path\":\"${EMPTY_TR}\",\"stop_hook_active\":true,\"last_assistant_message\":\"Lỗi nằm ở Ghost.kt:4211.\"}"
echo

# ── test_evidence_gate.sh — Stop ────────────────────────────────────────────
echo "test_evidence_gate.sh"
run_case "test-pass claim with zero XML blocked" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h1\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 12/12 test pass.\"}"
run_case "quoted PROHIBITION is not a claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h2\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Luật 5.5 nói rõ: **cấm sửa test cho xanh** khi chưa chứng minh expectation cũ sai.\"}"
run_case "imperative dừng/đừng is not a claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h3\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đừng gọi test là pass khi XML chưa tươi hơn edit cuối.\"}"
run_case "conditional 'thì' is not a claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h4\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Test chuyển xanh thì streak reset về 0.\"}"
run_case "verify question is not a test result claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h4-verify-question\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Verify: tests pass?\"}"
run_case "test modal is not a result claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h4-test-modal\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Test should pass after the fix.\"}"
run_case "khi transition is not a result claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h4-khi-transition\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Khi test xanh thì streak reset.\"}"
run_case "canonical task verify is not a result claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h4-task-verify\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"T003 implement tối thiểu → verify: test GREEN\"}"
run_case "quoted test result assertion needs evidence" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-quoted-result\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Result: \\\"12/12 tests passed\\\".\"}"
run_case "pending bug A cannot hide test pass for bug B" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-test-pending\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A chưa verify nhưng 12/12 test pass cho bug B.\"}"
run_case "negative smoke clause cannot hide unit test pass" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-test-negative\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Không chạy smoke, nhưng unit tests passed.\"}"
run_case "later deploy conditional cannot hide test pass" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-test-suffix\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"12/12 test pass, còn deploy thì chưa.\"}"
run_case "later deploy advice cannot hide test pass" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-test-advice\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Test pass 6/6; nếu deploy thì chạy smoke.\"}"
run_case "Vietnamese all-checks-pass phrase needs evidence" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-test-vietnamese\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Toàn bộ kiểm thử đều đạt.\"}"
run_case "unrelated guidance cannot hide later test pass" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-test-guidance-scope\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Cần kiểm tra B nhưng 12/12 test pass cho A.\"}"
run_case "first conditional test cannot hide second test pass" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h4-test-two-claims\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Test A pass thì deploy, còn test B pass.\"}"
run_case "no claim, no XML, nothing to say" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã đọc xong file rule, chưa sửa gì.\"}"
run_case "plain fixed claim without proof blocked" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-fixed\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã fix bug.\"}"
run_case "unrelated device command cannot prove fixed" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-device\",\"transcript_path\":\"${DEVICE_ONLY_TR}\",\"last_assistant_message\":\"Đã fix bug.\"}"
run_case "anonymous proof cannot authorize fixed outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-anon\",\"transcript_path\":\"${ANONYMOUS_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.\"}"
run_case "Bash-produced proof cannot authorize fixed outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-bash\",\"transcript_path\":\"${BASH_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.\"}"
run_case "error result cannot authorize fixed outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-error\",\"transcript_path\":\"${ERROR_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "proof missing postimage provenance cannot authorize outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-provenance\",\"transcript_path\":\"${MISSING_PROVENANCE_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:0000000000000000000000000000000000000000000000000000000000000000.\"}"
run_case "proof before the final edit is stale" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-stale\",\"transcript_path\":\"${STALE_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.\"}"
run_case "failed edit after proof does not make proof stale" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-failed-edit\",\"transcript_path\":\"${FAILED_EDIT_AFTER_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "edit with id but no result makes prior proof stale" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-unknown-edit\",\"transcript_path\":\"${UNKNOWN_EDIT_AFTER_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "successful tool after proof makes prior proof non-final" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-writer\",\"transcript_path\":\"${WRITER_AFTER_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "mutation-capable failed Bash after proof is non-final" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-error-writer\",\"transcript_path\":\"${ERROR_WRITER_AFTER_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "failed Write after proof is non-final" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-error-write\",\"transcript_path\":\"${ERROR_WRITE_AFTER_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "write between workflow use and result makes proof non-final" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-interleaved-write\",\"transcript_path\":\"${INTERLEAVED_WRITE_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "open write before workflow makes proof non-final" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-open-write\",\"transcript_path\":\"${OPEN_WRITE_BEFORE_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "write result after workflow result makes proof non-final" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-late-write\",\"transcript_path\":\"${LATE_WRITE_RESULT_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "correlated final workflow proof permits its exact fixed claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-proof\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "Workflow script shape permits exact fixed claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-script-proof\",\"transcript_path\":\"${CORRELATED_SCRIPT_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "lookalike Workflow script cannot authorize outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-forged-script\",\"transcript_path\":\"${FORGED_SCRIPT_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "conflicting Workflow name and script cannot authorize" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-mixed-locator\",\"transcript_path\":\"${MIXED_LOCATOR_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "correlated final Skill proof permits its exact fixed claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-skill-proof\",\"transcript_path\":\"${CORRELATED_SKILL_PROOF_TR}\",\"last_assistant_message\":\"Đã fix \`reader|logic.wrong_branch|open|empty-input\`; scope \`sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\`, current \`sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\`, content \`sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\`.\"}"
run_case "wrong currentId cannot authorize fixed outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-current\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "wrong contentHash cannot authorize fixed outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-content\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.\"}"
run_case "proof for another key and scope cannot authorize claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-unrelated\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix writer|logic.wrong_branch|save|empty-output; scope sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.\"}"
run_case "fixed key substring cannot authorize a longer key" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-key-collision\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input-extra; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "fixed key cannot authorize at-sign suffix collision" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-key-at-collision\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input@extra; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "fixed key cannot authorize dotted suffix collision" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-key-dot-collision\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input.extra; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "fixed key cannot authorize comma suffix collision" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-key-comma-collision\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input,extra; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "fixed key cannot authorize prefixed collision" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-key-prefix-collision\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix xreader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "scope digest suffix cannot authorize outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-scope-suffix\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-extra, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "current digest suffix cannot authorize outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-current-suffix\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-extra, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "content digest suffix cannot authorize outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-content-suffix\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc-extra.\"}"
run_case "every outcome sentence needs its own bound proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-multi-outcome\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc. Đã fix bug thứ hai.\"}"
run_case "every outcome occurrence in one clause needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-multi-clause\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix reader|logic.wrong_branch|open|empty-input và đã fix bug thứ hai; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "one fixed key cannot authorize two clauses in one sentence" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-key-reuse\",\"transcript_path\":\"${CORRELATED_FIX_PROOF_TR}\",\"last_assistant_message\":\"Đã fix bug A; Đã fix reader|logic.wrong_branch|open|empty-input; scope sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, current sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, content sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.\"}"
run_case "unrelated RED-GREEN text cannot authorize fixed outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-redgreen\",\"transcript_path\":\"${UNRELATED_RED_GREEN_TR}\",\"last_assistant_message\":\"Đã fix bug.\"}"
run_case "quoted fixed phrase is not an outcome claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-quoted\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Không được viết \\\"đã fix\\\" khi chưa có paired proof.\"}"
run_case "quoted outcome assertion still needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-quoted-assertion\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Kết luận: \\\"Đã fix bug A\\\".\"}"
run_case "inline-code outcome assertion still needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-code-assertion\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Trạng thái: \`fixed\`.\"}"
run_case "metalinguistic quoted outcome is not a claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-meta-quote\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Cụm từ \\\"đã fix\\\" là outcome claim cần proof.\"}"
run_case "acceptance text is not an outcome result" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-acceptance\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed.\"}"
run_case "acceptance prefix cannot hide independent outcome" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-independent\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed, nhưng đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome after em dash" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-em-dash\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed — đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome after ASCII dash" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-ascii-dash\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed - đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome after en dash" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-en-dash\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed – đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome after conjunction" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-conjunction\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed nhưng thực tế đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome after and in fact" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-and-fact\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed and in fact fixed bug B.\"}"
run_case "acceptance prefix cannot hide outcome after và thực tế" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-va-fact\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed và thực tế đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome after rồi" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-roi\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed rồi đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome after semicolon" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-semicolon\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed; đã fix bug B.\"}"
run_case "acceptance prefix cannot hide outcome on next line" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-acceptance-newline\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed\\nĐã fix bug B.\"}"
run_case "additive English acceptance remains non-assertive" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-acceptance-additive-en\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A is fixed and bug B is fixed.\"}"
run_case "additive Vietnamese acceptance remains non-assertive" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-acceptance-additive-vi\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Acceptance: bug A đã fix và bug B đã fix.\"}"
run_case "verify imperative is not an outcome result" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-verify-imperative\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Verify that bug A is fixed.\"}"
run_case "outcome modal is not a result claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-outcome-modal\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A must be fixed before release.\"}"
run_case "prohibition containing fixed phrase is not an outcome claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-prohibition\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Cấm nói đã fix khi chưa có paired proof.\"}"
run_case "conditional fixed phrase is not an outcome claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-conditional\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Nếu đã fix thì paired proof phải chuyển xanh.\"}"
run_case "definite outcome before trailing thì still needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-trailing-thi\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã fix bug A rồi thì tiếp tục kiểm tra B.\"}"
run_case "unrelated negative clause before outcome cannot hide it" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-negative-prefix\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Không còn blocker, đã fix bug A.\"}"
run_case "unrelated pending clause before outcome cannot hide it" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-pending-prefix\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Chưa thấy regression, đã khắc phục bug A.\"}"
run_case "negative conjunction before outcome cannot hide it" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-negative-conjunction\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Không còn blocker và đã fix bug A.\"}"
run_case "pending conjunction before outcome cannot hide it" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-pending-conjunction\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Chưa thấy regression nhưng đã khắc phục bug A.\"}"
run_case "unverified bug A cannot hide fixed bug B without comma" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-exact-conjunction\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A chưa verify nhưng đã fix bug B.\"}"
run_case "dash connector cannot hide fixed bug B" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-dash-connector\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A chưa verify — đã fix bug B.\"}"
run_case "tuy nhiên cannot hide fixed bug B" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-tuy-nhien\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A chưa verify tuy nhiên đã fix bug B.\"}"
run_case "không chỉ does not negate a fixed claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-khong-chi\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Không chỉ đã fix bug A.\"}"
run_case "còn connector cannot hide fixed bug B" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-con-connector\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A chưa verify còn bug B đã fix.\"}"
run_case "song connector cannot hide fixed bug A" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-song-connector\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Chưa thấy regression song đã khắc phục bug A.\"}"
run_case "mà connector cannot hide fixed bug B" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-ma-connector\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A chưa verify mà bug B đã được sửa.\"}"
run_case "English fix works outcome needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-fix-works\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"The fix works for bug A.\"}"
run_case "đã xử lý outcome needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-handled\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã xử lý bug A.\"}"
run_case "đã giải quyết outcome needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-solved\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã giải quyết xong lỗi A.\"}"
run_case "no longer reproduces outcome needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-no-repro\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Lỗi A không còn tái hiện.\"}"
run_case "Vietnamese no-repro synonym needs proof" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-no-repro-synonym\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A không tái hiện nữa.\"}"
run_case "advice conjunction before outcome cannot hide it" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-advice-conjunction\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Cần kiểm tra thêm nhưng bug A đã được sửa.\"}"
run_case "prohibition governing reported fixed phrase is not a claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h5-reported-prohibition\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Không được đoán và nói đã fix bug A.\"}"
run_case "unrelated prohibition cannot hide later fixed claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-prohibition-scope\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Không được đoán nhưng đã fix bug A.\"}"
run_case "pending bug A cannot hide fixed bug B" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-two-bugs-prefix\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Bug A chưa verify, nhưng đã fix bug B.\"}"
run_case "pending bug B after comma cannot hide fixed bug A" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-two-bugs-suffix\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã fix bug A, còn bug B thì chưa verify.\"}"
run_case "pending marker in another sentence cannot hide fixed claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-pending-scope\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã fix bug A. Bug B chưa verify.\"}"
run_case "pending marker in another clause cannot hide fixed claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h5-pending-clause\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã fix bug A; bug B BLOCKED.\"}"
# The branch that fires most often in practice: XML EXISTS and is fresh, but red.
# Found by mutation 2026-07-28 — with an empty sandbox every case landed on the
# "no XML at all" branch, so deleting the failures/errors check killed nothing.
mk_xml "${RED_XML_DIR}" "RedSuite" 6 1 0 0
run_case "fresh XML with failures>0 blocks claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h7\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass.\"}"
rm -f "${RED_XML_DIR}"/TEST-*.xml
mk_xml "${RED_XML_DIR}" "GreenSuite" 6 0 0 0
run_case "fresh green XML backs the claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h8\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass.\"}"
rm -f "${RED_XML_DIR}"/TEST-*.xml
# `gradle-test` returning total=0/UP-TO-DATE is the project's oldest false-green
# (memory: gradle-test-false-green-and-test-sourceset). An XML with tests=0 means
# NOTHING RAN, so it must not back a pass claim.
mk_xml "${RED_XML_DIR}" "EmptySuite" 0 0 0 0
run_case "tests=0 XML does not back the claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h11\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass.\"}"
rm -f "${RED_XML_DIR}"/TEST-*.xml
mk_xml "${RED_XML_DIR}" "SkipSuite" 6 0 0 2
run_case "unmentioned skipped>0 blocks claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h9\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass.\"}"
run_case "skipped>0 stated explicitly is fine" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h10\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass, có 2 case skipped do @Ignore.\"}"
rm -f "${RED_XML_DIR}"/TEST-*.xml
# Past tense is an assertion: "đã chạy lại" used to disarm the whole check.
run_case "past-tense 'đã chạy lại' still a claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h12\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Đã chạy lại, 12/12 test pass.\"}"
run_case "advice 'cần chạy lại' is not a claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h13\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"Cần chạy lại test cho module đã sửa rồi mới nói được là pass.\"}"
run_case "escape hatch honoured" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h6\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"12/12 test pass.\"}" \
  TEST_EVIDENCE_GATE=0
# Scoping to the modules edited this session. A repo can hold suites that are red for reasons
# this turn did not cause (measured 2026-07-28: :app's Roborazzi suites fail on any machine
# without the gitignored baselines). Summing across every module made a truthful per-suite
# report unstatable. Red outside the touched module is still not free: it blocks unless named.
mkdir -p "${SANDBOX}/core/data/src/main/java" "${SANDBOX}/core/data/build/test-results/x" \
         "${SANDBOX}/other/build/test-results/x"
TOUCH_KT="${SANDBOX}/core/data/src/main/java/Touched.kt"
echo "object Touched" > "${TOUCH_KT}"
TOUCH_TR="${SANDBOX}/touched.jsonl"
mk_tr "${TOUCH_TR}" Edit "${TOUCH_KT}" "object Touched"
mk_xml "${SANDBOX}/core/data/build/test-results/x" "TouchedSuite" 6 0 0 0
mk_xml "${SANDBOX}/other/build/test-results/x" "ForeignRedSuite" 4 2 0 0
run_case "red suite outside touched module, unnamed, blocks" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h14\",\"transcript_path\":\"${TOUCH_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass.\"}"
run_case "red outside touched module, named, allowed" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h15\",\"transcript_path\":\"${TOUCH_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass. ForeignRedSuite vẫn đỏ 2 case, có sẵn từ trước, ngoài phạm vi sửa.\"}"
# The teeth that must NOT be lost: red INSIDE the touched module blocks even when named.
mk_xml "${SANDBOX}/core/data/build/test-results/x" "TouchedSuite" 6 1 0 0
run_case "red suite inside touched module blocks even if named" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h16\",\"transcript_path\":\"${TOUCH_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 6/6 test pass. TouchedSuite đỏ 1 case.\"}"
rm -f "${SANDBOX}/core/data/build/test-results/x"/TEST-*.xml \
      "${SANDBOX}/other/build/test-results/x"/TEST-*.xml

# ── RED-check: a mutate/restore pair must keep the red it produced ───────────
# check 2 REQUIRES mutating a load-bearing line, running it red, then putting the line back. The
# restore is ALWAYS the last edit, so counting it moved the expiry marker past the red every time:
# the better someone followed the protocol, the surer the gate was to reject them. Only an EXACT
# inverse of the most recent un-undone edit is forgiven — the third case is the teeth.
mkdir -p "${SANDBOX}/app/src/test/java" "${SANDBOX}/app/build/test-results/mut"
MUT_KT="${SANDBOX}/app/src/test/java/MutSuite.kt"
echo "class MutSuite" > "${MUT_KT}"
MUT_RESTORED_TR="${SANDBOX}/mutate-restored.jsonl"
MUT_OTHEREDIT_TR="${SANDBOX}/mutate-otheredit.jsonl"
python3 - "${MUT_RESTORED_TR}" "${MUT_OTHEREDIT_TR}" "${MUT_KT}" <<'PYX'
import json, sys
restored, otheredit, kt = sys.argv[1:]
red = '<testsuite name="com.example.MutSuite" tests="2" failures="1" errors="0" skipped="0">'
def edit(old, new):
    return {"type": "tool_use", "name": "Edit",
            "input": {"file_path": kt, "old_string": old, "new_string": new}}
def result(text):
    return {"type": "tool_result", "content": [{"type": "text", "text": text}]}
mutate = edit("POLLS = 20", "POLLS = 0")
plans = {
    restored:  [mutate, result(red), edit("POLLS = 0", "POLLS = 20")],
    otheredit: [mutate, result(red), edit("assertTrue(a)", "assertTrue(b)")],
}
for out, blocks in plans.items():
    with open(out, "w") as fh:
        for b in blocks:
            fh.write(json.dumps({"message": {"content": [b]}}) + "\n")
PYX
mk_xml "${SANDBOX}/app/build/test-results/mut" "MutSuite" 2 0 0 0
run_case "mutate/restore pair keeps its RED-check" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h-mut-restored\",\"transcript_path\":\"${MUT_RESTORED_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 2/2 test pass.\"}"
run_case "non-inverse edit after RED still expires it" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h-mut-otheredit\",\"transcript_path\":\"${MUT_OTHEREDIT_TR}\",\"last_assistant_message\":\"Đã chạy targeted test, 2/2 test pass.\"}"
rm -f "${SANDBOX}/app/build/test-results/mut"/TEST-*.xml

# Instrumented results live OUTSIDE build/test-results/ (glob widened 2026-08-07).
# connectedAndroidTest writes build/outputs/androidTest-results/connected/<variant>/.
# Before the widening the gate found no XML for a device run and blocked the claim
# as "tests never ran" — which is every release-QA claim in this repo.
# Every unit-test XML is cleared first ON PURPOSE: with a green unit XML lying
# around both cases below would pass through the OLD globs and prove nothing.
# Mutation: drop the three androidTest patterns from test_evidence_gate.sh and
# the first case goes red.
rm -f "${SANDBOX}"/*/build/test-results/*/TEST-*.xml \
      "${SANDBOX}"/*/*/build/test-results/*/TEST-*.xml 2>/dev/null || true
INSTR_DIR="${SANDBOX}/app/build/outputs/androidTest-results/connected/release"
INSTR_KT="${SANDBOX}/app/src/main/java/Instr.kt"
mkdir -p "${INSTR_DIR}" "$(dirname "${INSTR_KT}")"
echo "object Instr" > "${INSTR_KT}"
INSTR_TR="${SANDBOX}/instr.jsonl"
mk_tr "${INSTR_TR}" Edit "${INSTR_KT}" "object Instr"
mk_xml "${INSTR_DIR}" "InstrSuite" 1 0 0 0
run_case "green instrumented XML backs a pass claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h40\",\"transcript_path\":\"${INSTR_TR}\",\"last_assistant_message\":\"Đã chạy instrumented test trên máy thật, 1/1 test pass.\"}"
mk_xml "${INSTR_DIR}" "InstrSuite" 1 1 0 0
run_case "red instrumented XML blocks a pass claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h41\",\"transcript_path\":\"${INSTR_TR}\",\"last_assistant_message\":\"Đã chạy instrumented test trên máy thật, 1/1 test pass.\"}"
rm -f "${INSTR_DIR}"/TEST-*.xml

# The two cases above use mk_xml, whose root element is <testsuite> — the UNIT
# test layout. Real connectedAndroidTest output wraps suites in a <testsuites>
# root, and the gate's parser rejected that outright until 2026-08-07. A fixture
# in the wrong shape is why the glob fix alone still left the gate blind, so
# these two cases use the AGP shape verbatim.
# mk_xml_suites <dir> <suite> <tests> <failures> <errors> <skipped>
mk_xml_suites() {
  cat > "$1/TEST-${2}.xml" <<XML
<?xml version='1.0' encoding='UTF-8' ?>
<testsuites tests="${3}" failures="${4}" errors="${5}" skipped="${6}" time="1.5" hostname="localhost">
  <testsuite name="com.example.${2}" tests="${3}" failures="${4}" errors="${5}" skipped="${6}" time="1.5" hostname="localhost">
    <testcase name="doesSomething" classname="com.example.${2}" time="0.7"/>
  </testsuite>
</testsuites>
XML
  touch "$1/TEST-${2}.xml"
}
mk_xml_suites "${INSTR_DIR}" "WrappedSuite" 1 0 0 0
run_case "green <testsuites>-wrapped XML backs a pass claim" test_evidence_gate.sh 0 \
  "{\"session_id\":\"h42\",\"transcript_path\":\"${INSTR_TR}\",\"last_assistant_message\":\"Đã chạy instrumented test trên máy thật, 1/1 test pass.\"}"
mk_xml_suites "${INSTR_DIR}" "WrappedSuite" 1 1 0 0
run_case "red <testsuites>-wrapped XML blocks a pass claim" test_evidence_gate.sh 2 \
  "{\"session_id\":\"h43\",\"transcript_path\":\"${INSTR_TR}\",\"last_assistant_message\":\"Đã chạy instrumented test trên máy thật, 1/1 test pass.\"}"
rm -f "${INSTR_DIR}"/TEST-*.xml
echo

# ── churn_guard.sh — PostToolUse ────────────────────────────────────────────
echo "churn_guard.sh"
run_case "3rd blind edit of one file warns" churn_guard.sh 2 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${CHURN_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
run_case "evidence between edits stays quiet" churn_guard.sh 0 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${EVID_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
run_case "escape hatch honoured" churn_guard.sh 0 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${CHURN_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"b\"}}" \
  CHURN_GUARD=0
echo

# ── comment_claim_guard.sh — PostToolUse ────────────────────────────────────
echo "comment_claim_guard.sh"
run_case "'covered by' claim in comment warns" comment_claim_guard.sh 2 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"// đã test, covered by SeenTest\\nval x = 1\"}}"
run_case "negative claim in comment warns" comment_claim_guard.sh 2 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"// hàm này không dùng ở đâu nữa\\nval x = 1\"}}"
run_case "plain descriptive comment quiet" comment_claim_guard.sh 0 \
  "{\"tool_name\":\"Edit\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${KT_SEEN}\",\"old_string\":\"a\",\"new_string\":\"// gom hai nhánh cho dễ đọc\\nval x = 1\"}}"
run_case "non-code file not scanned" comment_claim_guard.sh 0 \
  "{\"tool_name\":\"Write\",\"transcript_path\":\"${EMPTY_TR}\",\"tool_input\":{\"file_path\":\"${SANDBOX}/notes.md\",\"content\":\"// đã test, covered by SeenTest\"}}"
echo

# ── testsourceset_gate.sh — Stop (documented SKIP paths only) ───────────────
echo "testsourceset_gate.sh"
run_case "no ./gradlew in root → skip" testsourceset_gate.sh 0 \
  "{\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"xong\"}"
run_case "escape hatch honoured" testsourceset_gate.sh 0 \
  "{\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"xong\"}" \
  TESTSOURCESET_GATE=0
echo

# ── security_gate.sh — Stop (CLAUDE.md check 4c) ────────────────────────────
echo "security_gate.sh"
# must-NOT-fire cases come from files touched in THIS repo that are full of the
# trigger words but are not app attack surface — rule files and the gate itself.
# Docs QUOTE the very patterns the gate hunts for — `machine_gate_layer.md` and
# CLAUDE.md both do. Mutation 2026-07-28: the first version of this fixture had no
# real trigger in it, so it passed for free and left the `.md` exemption untested.
mk_tr "${SANDBOX}/sg_rule.jsonl"     Edit "${SANDBOX}/CLAUDE.md" \
  "ví dụ trigger: <uses-permission android:name=\"android.permission.INTERNET\"/> và javaScriptEnabled = true"
mk_tr "${SANDBOX}/sg_hook.jsonl"     Write "${SANDBOX}/.claude/hooks/security_gate.sh" \
  "PAT_WEBVIEW setJavaScriptEnabled addJavascriptInterface uses-permission"
mk_tr "${SANDBOX}/sg_unittest.jsonl" Edit "${SANDBOX}/core/analytics/src/test/java/PiiSanitizerTest.kt" \
  "assertThat(sanitize(\"apiKey=secret\")).isEqualTo(\"apiKey=***\")"
mk_tr "${SANDBOX}/sg_plain.jsonl"    Edit "${SANDBOX}/feature/reader/src/main/java/ReaderScreen.kt" \
  "Text(text = title, style = MaterialTheme.typography.titleMedium)"
mk_tr "${SANDBOX}/sg_manifest.jsonl" Edit "${SANDBOX}/app/src/main/AndroidManifest.xml" \
  "<uses-permission android:name=\"android.permission.READ_EXTERNAL_STORAGE\"/>"
mk_tr "${SANDBOX}/sg_webview.jsonl"  Edit "${SANDBOX}/feature/html/src/main/java/HtmlViewer.kt" \
  "webView.settings.javaScriptEnabled = true"
mk_tr "${SANDBOX}/sg_signing.jsonl"  Edit "${SANDBOX}/app/build.gradle.kts" \
  "storePassword = providers.gradleProperty(\"RELEASE_STORE_PASSWORD\").get()"
mk_tr "${SANDBOX}/sg_analytics.jsonl" Edit "${SANDBOX}/core/analytics/src/main/java/Reporter.kt" \
  "firebaseAnalytics.logEvent(\"search_performed\", bundleOf(\"query\" to raw))"
mk_tr "${SANDBOX}/sg_reviewed.jsonl" Edit "${SANDBOX}/app/src/main/AndroidManifest.xml" \
  "<uses-permission android:name=\"android.permission.INTERNET\"/>" WITH_SCAN

run_case "rule file full of trigger words quiet"  security_gate.sh 0 \
  "{\"session_id\":\"sg1\",\"transcript_path\":\"${SANDBOX}/sg_rule.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "the gate's own source quiet"            security_gate.sh 0 \
  "{\"session_id\":\"sg2\",\"transcript_path\":\"${SANDBOX}/sg_hook.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "unit test mentioning secrets quiet"     security_gate.sh 0 \
  "{\"session_id\":\"sg3\",\"transcript_path\":\"${SANDBOX}/sg_unittest.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "ordinary UI kotlin quiet"               security_gate.sh 0 \
  "{\"session_id\":\"sg4\",\"transcript_path\":\"${SANDBOX}/sg_plain.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "manifest permission change blocked"     security_gate.sh 2 \
  "{\"session_id\":\"sg5\",\"transcript_path\":\"${SANDBOX}/sg_manifest.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "enabling WebView JS blocked"            security_gate.sh 2 \
  "{\"session_id\":\"sg6\",\"transcript_path\":\"${SANDBOX}/sg_webview.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "signing/keystore change blocked"        security_gate.sh 2 \
  "{\"session_id\":\"sg7\",\"transcript_path\":\"${SANDBOX}/sg_signing.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "analytics payload change blocked"       security_gate.sh 2 \
  "{\"session_id\":\"sg8\",\"transcript_path\":\"${SANDBOX}/sg_analytics.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "trigger + security review ran → pass"   security_gate.sh 0 \
  "{\"session_id\":\"sg9\",\"transcript_path\":\"${SANDBOX}/sg_reviewed.jsonl\",\"last_assistant_message\":\"xong\"}"
run_case "escape hatch honoured"                  security_gate.sh 0 \
  "{\"session_id\":\"sg10\",\"transcript_path\":\"${SANDBOX}/sg_manifest.jsonl\",\"last_assistant_message\":\"xong\"}" \
  SECURITY_GATE=0
echo

# ── review_gate.sh — Stop ───────────────────────────────────────────────────
echo "review_gate.sh"
run_case "no uncommitted kotlin → nothing to review" review_gate.sh 0 \
  "{\"session_id\":\"rg1\",\"transcript_path\":\"${EMPTY_TR}\",\"last_assistant_message\":\"xong\"}"
echo

# ── report ──────────────────────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "contract points: ${PASS} ok, ${FAIL} deviating"
if [ "${FAIL}" -ne 0 ]; then
  echo "${FAILED_CASES}"
  echo
  echo "A deviation means the hook and its documented contract disagree."
  echo "Fix the hook, or fix the contract — do not relax the case (CLAUDE.md W4)."
  exit 1
fi
exit 0
