# 23 — AI Workflow

## Phases

| Phase | Responsibility |
|:---|:---|
| **PLAN** | Specify outcome, investigate impact/flow, choose approach, decompose tasks and analyze consistency. |
| **IMPLEMENT** | Execute tasks in dependency order; a PAIRED EXECUTABLE ORACLE with no waiver is mandatory before/after production edits for every bug fix. |
| **REVIEW / CONVERGE** | Review by risk, reconcile acceptance ↔ tasks ↔ diff ↔ evidence, and report gaps honestly. |

Một agent có thể chạy xuyên suốt các phase. Expert review được chọn theo risk rules trong `AGENTS.md`
và `CLAUDE.md`, không theo tên/model tier và không tạo approval gate mặc định.

Progress/checkpoint không phải terminal: tự tiếp tục đến khi toàn bộ scope đạt terminal hợp lệ của
`CLAUDE.md B9`; không bao giờ yêu cầu User gõ `continue`/`làm tiếp`. Reviewer gap hay failed approach
chỉ buộc đổi plan/approach, không cấp phép bỏ phần việc còn làm được.

## PLAN
- Trigger khi bất kỳ một điều kiện đúng: changes ≥ 3 files OR touch ≥ 2 modules OR net diff > 200 LOC OR risky flow.
- Canonical workflow: `.claude/commands/plan.md`.
- Output: `spec.md`, `plan.md`, `tasks.md` in `plans/` (or conversation for small scoped work).
- Plan must include Impact Analysis, Flow Analysis and Test Gap grounded by graph/code/test evidence.
- Continue autonomously after ANALYZE unless User requests plan-only or a blocking authority decision remains.

## IMPLEMENT
- Execute plan tasks one by one.
- Follow all rules in `.claude/rulebook/`.
- Bug fix/error correction bắt buộc **PAIRED EXECUTABLE ORACLE**: cùng acceptance/scenario/oracle được
  thực thi RED trước production edit và GREEN sau edit; report/log/baseline cũ chỉ discovery, không
  waiver. Không có safe pre-run → `BLOCKED` trước production edit.
- Sau mỗi task, chạy checkpoint verification nhỏ nhất đủ chứng minh slice; mở rộng audit theo risk/blast
  radius khi converge.
- Never modify architecture without Plan update.
- Do not commit, push, create PR, deploy or release without explicit User request.

## REVIEW / CONVERGE
- Verify: does code match plan?
- Verify: all rules followed?
- Verify: tests pass?
- Verify: no anti-patterns introduced?
- Verify: accessibility, null safety, performance.
- Output dùng terminal vocabulary canonical của command đang chạy. Với `/fix`: `CLEAN`,
  `VERIFIED_WITH_RESIDUALS`, `BLOCKED`, `FAILED`, hoặc `ESCALATE`; generic `GAPS` map thành
  `VERIFIED_WITH_RESIDUALS`, không tạo status thứ sáu. Audit sub-workflow chỉ được trả verdict audit
  (`CLEAR/CONVERGING/RESIDUALS/INCOMPLETE/ESCALATE`), không tự cấp terminal `CLEAN`.
- Với `/fix`, oracle hoặc regression đã biết `FAIL` ưu tiên hơn evidence `BLOCKED`; validated P0/P1 chưa
  resolve phải `ESCALATE` hoặc `BLOCKED`, không được hạ thành deferred residual. `N/A` luôn cần reason + evidence.
- Mỗi `/fix` audit sweep phải ghi `nextAuditState` bằng `fix-evidence-driver.mjs record-audit-state`; sweep
  tiếp theo dùng state/digest do cùng sealed bundle phát, không bootstrap lại sweep 0 trong cùng session.
