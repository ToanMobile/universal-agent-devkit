---
name: spec-driven-development
description: Dùng khi feature/refactor/risky flow cần spec trước code, yêu cầu mơ hồ, hoặc thay đổi chạm từ 2 module, 3 file hay hơn 200 LOC net diff. Bỏ qua typo, config không đổi behavior và bug local đã rõ root cause.
---

# Spec-Driven Development

`.Codex/commands/plan.md` là nguồn canonical cho SPECIFY → CLARIFY → PLAN → TASKS → ANALYZE →
IMPLEMENT → CONVERGE. Skill này chỉ là adapter; không tạo workflow hoặc approval gate thứ hai.

## Mode

- Bug/local edit nhỏ: acceptance + targeted verification trong conversation, không tạo bộ spec.
- Feature/refactor/risky flow: `plans/[feature]/spec.md`, `plan.md`, `tasks.md`.
- User nói plan-only/chưa code: hoàn thành ANALYZE rồi dừng.
- Nếu không bị giới hạn: sau ANALYZE CLEAN, implement và CONVERGE.

## Contract artifact

- `spec.md`: objective/problem, requirements, non-goals, acceptance, edge cases, assumptions và open
  authority decisions; chỉ what/why.
- `plan.md`: approach, impacted modules/files, graph trace, dependencies, risks và test plan.
- `tasks.md`: task theo dependency, map requirement, có path/module và một verify command tương xứng.

Không thêm artifact nếu ba file đủ dùng. Metric/threshold phải có nguồn từ User, repo gate hoặc
measurement thật.

## Decision policy

Điều tra graph/source, official docs và test evidence trước khi hỏi. Tự chọn reversible local decision
theo correctness → security/data safety → compatibility/architecture → measured performance →
simplicity.

Luôn hỏi trước authority boundary trong `AGENTS.md`/`AGENTS.md`. Permission hoặc shared/user-visible
contract chỉ hỏi khi intent/scope không thể suy ra an toàn. Tối đa 3 blocker mỗi batch; mỗi câu kèm
evidence và trade-off.

## Gates

- ANALYZE tới 0 finding trước code; requirement/acceptance phải map tới task và evidence.
- Mọi bug fix phải tuân thủ PAIRED EXECUTABLE ORACLE (bắt buộc, không có waiver / mandatory with no waiver). Compile chỉ hợp lệ khi chính acceptance là lỗi compile/build failure.
- Implement test-first khi behavior testable, giữ diff surgical.
- Requirement/architecture đổi thì cập nhật spec → plan → tasks và ANALYZE lại.
- CONVERGE acceptance ↔ tasks ↔ diff ↔ evidence; chỉ `CLEAN`, `GAPS` hoặc `BLOCKED`.
- CONVERGE = `CLEAN` → xóa `plans/[feature]/` khỏi working tree (xem `.Codex/commands/plan.md` §Dọn
  dẹp); chỉ move phần có giá trị dài hạn sang `.Codex/knowledge/`, không giữ song song 2 bản.
- Không hạ acceptance hay đổi RED/INCOMPLETE thành PASS. Không commit/push/PR/deploy/release nếu User
  chưa yêu cầu rõ.
