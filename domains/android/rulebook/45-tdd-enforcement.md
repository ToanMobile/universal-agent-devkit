# 45 — TDD Enforcement

> Workflow chi tiết: `.claude/skills/tdd-workflow/SKILL.md`. Bug fix: `/fix`.

## Khi bắt buộc

Áp dụng RED → GREEN cho logic testable mới hoặc thay đổi behavior: ViewModel, domain/use case,
repository, mapping/data transform, error handling và bug fix. Rendering/config/DI boilerplate thuần
có thể dùng compile, integration, UI, device hoặc gate phù hợp hơn; không tạo unit test vô nghĩa.

## Safety

- Bảo toàn code và dirty work đã tồn tại. Không reset, revert, xóa hoặc làm hỏng implementation để
  tạo RED.
- Mọi bug fix/error correction dùng **PAIRED EXECUTABLE ORACLE** bắt buộc: cùng
  acceptance/scenario/oracle/execution identity phải chạy RED trước production edit và GREEN sau edit.
- Unit không phù hợp thì dùng integration, instrumented/device hoặc runtime probe fresh. Historical
  report/log/baseline/source chỉ discovery; không thay được pre-run và không có waiver.
- Nếu implementation đã tồn tại, chỉ exercise/mutate trong artifact read-only hoặc isolated copy.
  Không chạy được RED an toàn thì `BLOCKED` trước khi sửa production, không ghi residual để gọi fixed.
- RED phải fail đúng assertion/symptom; compile failure chỉ hợp lệ khi chính acceptance là
  compile/build failure, còn setup, fixture hay test-discovery error không tính.

## Cycle

1. Chốt observable acceptance hoặc failure mechanism.
2. Viết test nhỏ nhất đủ chứng minh; variant cùng mechanism dùng parameterized test.
3. Chạy targeted test và xác nhận test thật sự chạy, fail đúng lý do.
4. Sửa production tối thiểu trong task-owned scope.
5. Chạy lại đúng test tới GREEN, rồi chạy regression theo blast radius thật.
6. Chỉ refactor phần task tạo hoặc bắt buộc cho correctness; giữ test GREEN.

## Test quality

- Test behavior/contract quan sát được, không private implementation hay incidental call order.
- Tên test thể hiện condition → action → outcome; test độc lập và deterministic.
- Ưu tiên real nhẹ → fake → stub → mock. Không `Thread.sleep` khi có virtual time hoặc signal.
- Không mở public API/DI chỉ để test nếu chưa trace blast radius và review architecture.

## Verification

Dùng lệnh nhỏ nhất đủ chứng minh vùng thay đổi, ví dụ targeted
`:<module>:testDebugUnitTest --tests "*<TestClass>*"`, rồi mở rộng theo call graph/risk. Không chạy root
`./gradlew test`, `test_full.sh`, lint toàn repo hoặc release gate mặc định; chỉ chạy khi blast radius,
release workflow hoặc User yêu cầu thật sự cần.

Chỉ báo PASS khi command thật đã chạy thành công trong conversation. Runtime/device/security outcome
không được chứng minh chỉ bằng compile, mock-only test hoặc syntax lint.
