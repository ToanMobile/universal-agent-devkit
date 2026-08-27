# 42 — QA Test Case Management

## Khi cần test case

Tạo/update test case khi feature/fix có observable acceptance, manual/device flow hoặc regression cần
traceability. Local logic đã được mô tả rõ bằng test có thể chỉ cần mapping trong plan/task; không bắt mỗi
feature tạo checklist riêng.

## Format tối thiểu

```text
ID: <stable id>
Requirement/failure mechanism: <why>
Precondition/fixture: <what is required>
Steps/trigger: <minimal reproducible action>
Oracle: <observable expected result>
Evidence type: unit/integration/UI/device/runtime/manual
Status: PASS | FAIL | BLOCKED | NOT RUN
Evidence: <current run artifact; blank until executed>
```

Không pre-fill PASS, device, count, coverage hoặc result. Manual and automated cases use the same
observable oracle; a marker/link alone is not proof the test ran.

## Selection

- Cover primary acceptance and each distinct failure mechanism.
- Add null/empty, malformed/large, offline/permission, lifecycle/config, concurrency, RTL/font/theme,
  performance or security only when reachable/applicable.
- Prefer the lowest deterministic layer: unit → integration → UI/instrumented/device.
- Variant cùng mechanism dùng parameterized/data-driven case; không multiply checklist mechanically.
- P0/P1 path cần executable oracle ở layer thật; unit không phù hợp thì dùng integration,
  instrumented/device hoặc runtime probe, không hạ thành report/manual residual để gọi fix xong.

## Verification

- Bug fix: **PAIRED EXECUTABLE ORACLE** bắt buộc — thực thi cùng acceptance/scenario/oracle RED trước
  production edit và GREEN sau edit. Historical report/log/baseline chỉ chọn scenario; không thay lần
  chạy RED và không có waiver. Không chạy pre oracle an toàn được thì `BLOCKED` trước khi sửa production.
- Feature: acceptance ↔ task ↔ test/evidence must be traceable.
- Run targeted checks first and expand by graph blast radius/risk.
- PASS only after current command/manual observation produced evidence; missing fixture/device/tool is
  `BLOCKED`, not PASS/SKIP.

Release cases and thresholds come from `/qa`, `scripts/qa/README.md` and current gate scripts, not this
rulebook.

Liên kết: [[rulebook/17-testing]] · [[rulebook/45-tdd-enforcement]].
