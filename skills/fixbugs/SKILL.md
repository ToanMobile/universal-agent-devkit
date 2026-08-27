---
name: fixbugs
description: Quy trình chuẩn đoán và sửa lỗi (bug fixing) tuân thủ Paired Executable Oracle (RED -> GREEN).
---

# Quy trình Sửa Lỗi Chuẩn (Standard Bug Fixing Protocol)

Skill hướng dẫn quy trình điều tra, tái hiện và sửa lỗi theo nguyên tắc **Paired Executable Oracle (RED → GREEN)** và **Surgical Edits** trong OfficeReader.

## 1. Nguyên Tắc Cốt Lõi (Non-Negotiable)

- **PAIRED EXECUTABLE ORACLE (bắt buộc cho mọi bug fix — không có waiver / mandatory with no waiver):** Trước khi sửa bất kỳ dòng code production nào, PHẢI có một oracle thực thi (unit test, instrumented test, hoặc reproducer script) ở trạng thái **RED** (báo lỗi chính xác). Compile chỉ hợp lệ khi chính acceptance là lỗi compile/build failure. Sau khi sửa code, chạy lại đúng oracle đó và quan sát **GREEN**.
- **TASK COMPLETION:** Tự động hoàn thành toàn bộ các bước mà không bao giờ yêu cầu User gõ `continue`/`làm tiếp`.
- **Discriminating Evidence:** Nguyên nhân gốc (Root Cause) phải được chứng minh bằng bằng chứng phân biệt đối lập (Pass/Fail contrast), không dựa vào suy đoán cảm tính khi đọc code.
- **Surgical Edits:** Chỉ sửa tối thiểu tại đúng điểm lỗi. Không drive-by refactor, không xóa code không liên quan.
- **Anti-Loop:** Nếu 2 lần sửa liên tiếp thất bại trên cùng một giả thuyết nguyên nhân, DỪNG LẠI và từ bỏ giả thuyết đó để đổi hướng điều tra khác (abandon failing hypothesis).

## 2. Các Bước Thực Hiện

### Bước 1: Khám phá & Tái hiện (Discovery & Reproduction)
1. Xác định phạm vi và điều kiện gây lỗi (crash log, stack trace, corrupt document, lifecycle issue).
2. Dùng `codebase-memory-mcp` hoặc symbol search để định vị blast radius và call chain liên quan.

### Bước 2: Thiết lập Oracle Thất bại (RED Phase)
1. Viết một Unit Test hoặc regression test thể hiện đúng kịch bản lỗi.
2. Chạy test và quan sát lỗi thực tế:
   ```bash
   ./gradlew :<module>:testDebugUnitTest --tests "*<RegressionTestClass>*"
   ```
3. Xác nhận test thất bại chính xác (RED) do cơ chế lỗi cần sửa, không phải do mock sai.

### Bước 3: Sửa lỗi Tối thiểu (Surgical Fix Phase)
1. Thực hiện sửa đổi tối thiểu trong code sản phẩm để khắc phục nguyên nhân gốc.
2. Tuân thủ Kotlin coding conventions và Null Safety standards của dự án.

### Bước 4: Xác minh Thành công (GREEN Phase)
1. Chạy lại đúng oracle đã thiết lập ở Bước 2:
   ```bash
   ./gradlew :<module>:testDebugUnitTest --tests "*<RegressionTestClass>*"
   ```
2. Xác nhận test chuyển sang trạng thái thành công (**GREEN**). Đọc file `TEST-*.xml` để đối chiếu `tests > 0, failures = 0, errors = 0`.

### Bước 5: Chống hồi quy (Anti-Regression Checks)
1. Kiểm tra compile toàn bộ source và unit test của module:
   ```bash
   ./gradlew :<module>:compileDebugKotlin :<module>:compileDebugUnitTestKotlin
   ```
2. Chạy toàn bộ test suite của module để đảm bảo không phá vỡ logic khác:
   ```bash
   ./gradlew :<module>:testDebugUnitTest
   ./gradlew :<module>:ktlintCheck
   ```
