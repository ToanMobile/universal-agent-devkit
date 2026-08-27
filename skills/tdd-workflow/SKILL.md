---
name: tdd-workflow
description: Dùng khi thêm/sửa logic testable, viết regression test hoặc audit test quality cho OfficeReader bằng RED→GREEN an toàn. Bỏ qua config/rendering thuần cần verification khác; không xóa hay revert user work để tạo RED.
---

# TDD Workflow cho OfficeReader

## Contract

Tuân theo `AGENTS.md`, `/fix`, `/plan` và `.Codex/rulebook/45-tdd-enforcement.md`. Skill này chỉ vận hành
RED→GREEN và chọn evidence; không tự đặt coverage, performance budget hay tỷ lệ test.

## Safety

- Bảo toàn pre-existing code và dirty work; không reset/restore/revert/xóa implementation để tạo RED.
- Bug fix/error correction bắt buộc **PAIRED EXECUTABLE ORACLE**: chạy cùng
  acceptance/scenario/oracle/execution identity RED trước production edit và GREEN sau edit.
- Unit không phù hợp thì dùng integration, instrumented/device hoặc runtime probe fresh; report/log/
  baseline/source cũ chỉ discovery, không thay pre-run và không có waiver.
- Implementation đã tồn tại chỉ được exercise/mutate trong artifact read-only hoặc isolated copy.
  Không có safe pre-run thì `BLOCKED` trước production edit.
- Test behavior/contract quan sát được, không khóa private method hay incidental call order.

## Chọn evidence nhỏ nhất đủ chứng minh

| Outcome | Ưu tiên |
|:---|:---|
| Domain/data transform | Unit test |
| ViewModel state/error | Unit test + coroutine scheduler |
| Flow/cancellation/order | Turbine + virtual time |
| Repository/Room/network boundary | Integration/contract test |
| Compose semantics | Compose UI test |
| Lifecycle/device/file/native | Instrumented/device repro + logcat |
| Performance/large input | Fixture/gate/benchmark hiện có |

Compile, mock-only test hoặc syntax lint không chứng minh runtime/device/security outcome.

## RED → GREEN → REFACTOR

### RED

1. Chốt một observable acceptance/symptom.
2. Viết test nhỏ nhất cho một failure mechanism; variant cùng mechanism dùng parameterized test.
3. Chạy targeted command fresh khi cache có thể che execution.
4. Xác nhận test thực sự chạy và fail tại assertion/symptom, không phải setup/compile error.
5. Bind receipt pre-edit với acceptance/scenario/oracle/execution identity sẽ chạy lại ở GREEN.

### GREEN

Sửa production tối thiểu trong task-owned scope. Chạy lại đúng RED command, kiểm test count/exit code,
rồi chạy regression lân cận theo blast radius thật.

### REFACTOR

Chỉ refactor phần task tạo hoặc bắt buộc cho correctness. Không mở public API/DI chỉ để test; nếu cần
seam, trace blast radius và review architecture tương xứng.

## Test quality

- Ưu tiên real nhẹ/deterministic → fake → stub → mock; mock khi interaction chính là contract.
- Dùng DAMP, tên condition→action→outcome, state/cleanup độc lập.
- Không `Thread.sleep`; dùng virtual time, idling resource hoặc deterministic signal.
- Threshold chỉ lấy từ repo/User; thiếu threshold thì map acceptance/failure mechanism tới evidence.

## Terminal

Chỉ báo PASS khi command thật đã chạy trong conversation. Dùng verdict của workflow gọi skill:
`/fix` → `CLEAN|VERIFIED_WITH_RESIDUALS|BLOCKED|FAILED|ESCALATE`; `/plan` → `CLEAN|GAPS|BLOCKED`.
Không commit/push hoặc hỏi có muốn commit nếu User chưa yêu cầu rõ.
