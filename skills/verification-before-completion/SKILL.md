---
name: verification-before-completion
description: Dùng khi sắp tuyên bố xong/fixed/PASS/green, trước commit/PR được User yêu cầu, hoặc khi kiểm kết quả từ agent khác. Bỏ qua khi chỉ khám phá/đọc và chưa đưa completion claim.
---

# Verification Before Completion

## Gate

Trước mỗi completion claim:

1. **Identify:** lệnh/evidence nào trực tiếp chứng minh claim?
2. **Run:** chạy fresh, targeted và đủ scope; không tin cache/report cũ.
3. **Read:** kiểm exit code, test count, failure và output thật.
4. **Match:** evidence có chứng minh đúng outcome được claim không?
5. **Claim:** nêu command/evidence đã chạy và residual; không phóng đại.

Với bug fix/error correction, gate bắt buộc luôn là **PAIRED EXECUTABLE ORACLE**: cùng
acceptance/scenario/oracle/execution identity đã thực thi RED trước production edit và GREEN sau edit.
Historical report/log/baseline/source/reviewer chỉ discovery; không có waiver hoặc completion claim khi
thiếu một vế. Không có safe pre-run → `BLOCKED`.

## Claim → evidence

| Claim | Evidence tối thiểu |
|:---|:---|
| Compile/build xanh | Targeted Gradle compile/build exit 0 trong conversation |
| Test pass | Test thật chạy, đúng test identity/count, 0 failure/error |
| ktlint/detekt sạch | Task tương ứng cho scope đụng exit 0 |
| Regression fix | Executed pre-edit RED + post-edit GREEN của cùng PAIRED EXECUTABLE ORACLE |
| Runtime/UI/lifecycle bug fixed | Device/instrumented/repro + logcat/oracle quan sát được |
| Security/release safe | Relevant release/config/runtime gate, không chỉ debug compile |
| Agent khác hoàn tất | Đọc diff/file thật và tự chạy verification phù hợp |

Chọn command theo module/blast radius trong `AGENTS.md` và `.Codex/rulebook/45-tdd-enforcement.md`.
Không chạy root full suite, screenshot matrix, macrobenchmark, device hay release gate mặc định nếu claim
không cần chúng. Ngược lại, compile/mock-only test không đủ cho runtime/device/security/performance.

## Safety và verdict

- Không reset/revert/xóa dirty work để tạo RED.
- Không dùng “chắc”, “có lẽ”, cache hoặc success-report thay evidence.
- Nếu command không chạy được, ghi chính xác blocker và phần chưa verify.
- Finding/residual còn thật thì verdict phải là residual/blocked, không `CLEAN`.
- Không commit/push/PR chỉ vì verification pass; cần request rõ của User.

Liên kết: `AGENTS.md` Rule 5/W6 · [[rulebook/17-testing]] · [[tdd-workflow]].
