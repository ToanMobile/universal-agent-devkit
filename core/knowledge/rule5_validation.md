# Rule 5 Validation

## Purpose

Validate anti-fabrication controls without claiming they cover every semantic error.

## Deterministic controls

- `.claude/hooks/claim_check.sh`: checks a narrow set of sourced citations/past-action claims.
- `.claude/hooks/review_gate.sh`: requires supported fresh-context review after session-owned Kotlin/Java
  edits, with an anti-loop fallback.
- `.claude/workflows/fix-evidence-driver.mjs`: snapshots pre-session content outside the worktree,
  predeclares postimages, binds bytes/modes into exact per-edit deltas, seals the local bundle, rejects
  path aliases/hidden target dirtiness and new out-of-scope drift, binds final approvals to the last
  edit/postimage/patch, emits canonical binary evidence bound to raw octets, and seals each workflow's
  next audit-state digest for the following sweep. Its concurrency and approval evidence remains optimistic/local, not hostile-writer
  or user-authority attestation.
- `.claude/workflows/multi-lens-audit.js`: v3 validates inline SHA-256 artifacts, exact-patch coverage,
  canonical binary manifests plus bounded raw pre/post octets embedded for lens coverage, acceptance-owned typed machine oracles,
  one-file text patch grammar, session/last-edit-bound RED/GREEN proofs, fail-safe rejected-candidate recurrence,
  driver-recorded optimistic sweep-state continuity, intended gate execution
  identities and non-lossy audit verdicts.
  It never self-promotes audit CLEAR to terminal CLEAN because named workflows lack trusted host
  attestation.

Settings wiring is in `.claude/settings.json`. Current behavior must be verified from source/tests rather
than test-count prose in this document.

Measured gaps in these controls (probe evidence, 2026-07-27):
`.claude/knowledge/rule_evidence_cases.md#case-gate-audit-2026-07-27`.

Remediated the same day: the two `claim_check.sh` bypasses (out-of-range line numbers behind an
opened-file citation; a negation anywhere in the sentence disarming the past-action check) are fixed
and covered by a 10-case RED/GREEN probe set; `testsourceset_gate.sh` is now wired into `Stop`; a new
`churn_guard.sh` runs on `PostToolUse` for rule 6.4b. Still open: `review_gate.sh` enforces
end-of-batch rather than per-fix review timing, and nothing scans comments/KDoc.

## Verification

```bash
bash -n .claude/hooks/claim_check.sh .claude/hooks/review_gate.sh
node --check .claude/workflows/multi-lens-audit.js
node --check .claude/workflows/fix-evidence-driver.mjs
node --test .claude/workflows/multi-lens-audit.test.mjs .claude/workflows/fix-evidence-driver.test.mjs
```

For hooks, use controlled stdin/transcript fixtures when changing behavior. Validate both true blocks and
false-positive cases; hooks fail-open on internal errors by design, so syntax-only checks are insufficient
for behavior changes.

## Limits

These controls cannot prove metrics, cause/effect, library behavior or arbitrary call-path claims. Those
still require graph/source, official docs, tests or runtime evidence. Logs under `.claude/audit-gate/` are
local artifacts and may include test-generated entries; aggregate counts are not equivalent to real
fabrication incidents.

Record a new rule only after a reproduced miss/false positive. Keep patterns narrow; if a gate blocks
valid output, fix precision or report residual instead of expanding exceptions silently.

## Final Report (validation period 2026-05-20 → 2026-06-17)

Tổng kết thực hiện tại local 2026-07-17 (sau khi period đã đóng; routine cloud không tự chạy được).

- **Routine cloud `Rule 5 Weekly Validation Review` (`trig_01BernpmArvN36AAJ2soseyU`):** tạo 2026-05-20,
  cron `0 2 * * 0`. **Không fire lần nào** — API `get` không có `last_fired_at`; `ended_reason:
  auto_disabled_repo_access`; `next_run_at` đóng băng ở lần đầu 2026-05-24T02:08Z, `updated_at`
  2026-05-24T02:09Z (auto-disable ngay tại lần chạy đầu do cloud agent mất quyền truy cập repo). → 0/4
  tuần có run tự động.
- **Fabrication incidents được log:** 0. Tài liệu này không chứa log entry nào (không có cột
  Mode/Bịa/Remediation; xác minh 2026-07-17 bằng `grep -c` → tất cả marker = 0). Aggregate = 0, không
  suy ra "không có sự cố nào ngoài thực tế" (xem Limits).
- **Kết cục:** validation chuyển sang cơ chế **deterministic** (hooks `claim_check.sh` / `review_gate.sh`
  + workflows `fix-evidence-driver.mjs` / `multi-lens-audit.js` mô tả ở các section trên), thay cho nhật
  ký fabrication thủ công theo tuần.
- **Trạng thái routine:** đã `enabled: false`. Đề xuất xóa hẳn tại https://claude.ai/code/routines (API
  chỉ disable/update, không xóa được). Không còn active tracking cho Rule 5 validation.
