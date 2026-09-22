---
name: fixbugs
description: Quy trình chuẩn đoán và sửa lỗi (bug fixing) tuân thủ Paired Executable Oracle (RED -> GREEN).
---

# Quy trình Sửa Lỗi Chuẩn (Standard Bug Fixing Protocol)

Skill hướng dẫn quy trình điều tra, tái hiện và sửa lỗi theo nguyên tắc **Paired Executable Oracle (RED → GREEN)** và **Surgical Edits** trong Target Project / Codebase.

## 1. Nguyên Tắc Cốt Lõi (Non-Negotiable)

- **PAIRED EXECUTABLE ORACLE (bắt buộc cho mọi bug fix — không có waiver / mandatory with no waiver):** Trước khi sửa bất kỳ dòng code production nào, PHẢI có một oracle thực thi (unit test, instrumented test, hoặc reproducer script) ở trạng thái **RED** (báo lỗi chính xác). Compile chỉ hợp lệ khi chính acceptance là lỗi compile/build failure. Sau khi sửa code, chạy lại đúng oracle đó và quan sát **GREEN**.
- **TASK COMPLETION:** Tự động hoàn thành toàn bộ các bước mà không bao giờ yêu cầu User gõ `continue`/`làm tiếp`.
- **Discriminating Evidence:** Nguyên nhân gốc (Root Cause) phải được chứng minh bằng bằng chứng phân biệt đối lập (Pass/Fail contrast), không dựa vào suy đoán cảm tính khi đọc code.
- **Surgical Edits:** Chỉ sửa tối thiểu tại đúng điểm lỗi. Không drive-by refactor, không xóa code không liên quan.
- **Anti-Loop:** Nếu 2 lần sửa liên tiếp thất bại trên cùng một giả thuyết nguyên nhân, DỪNG LẠI và từ bỏ giả thuyết đó để đổi hướng điều tra khác (abandon failing hypothesis).

## 2. Các Bước Thực Hiện

### Bước 1: Khám phá & Tái hiện (Discovery & Reproduction)
1. Xác định phạm vi và điều kiện gây lỗi (crash log, stack trace, corrupt document, lifecycle issue).
2. Dùng `codebase-memory-mcp` (`trace_path`) hoặc grep để rà soát 100% điểm gọi ngược (Inbound Callers Blast Radius) trước khi sửa đổi, đảm bảo tuyệt đối không sinh bug mới sang các module khác.
3. Rà soát danh mục rào chắn bất biến (`immutable_guards`) trong ma trận hồi quy để bảo vệ 100% các bản sửa lỗi lịch sử.

### Bước 2: Thiết lập Oracle Thất bại (RED Phase)
1. Viết một Unit Test hoặc regression test thể hiện đúng kịch bản lỗi.
2. Chạy test và quan sát lỗi thực tế:
   ```bash
   # Android / Java / Kotlin:
   ./gradlew :<module>:testDebugUnitTest --tests "*<RegressionTestClass>*"
   # Node.js / TypeScript:
   npm test -- -t "RegressionTestName"
   # Python:
   pytest -k "test_regression_scenario"
   ```
3. Xác nhận test thất bại chính xác (RED) do cơ chế lỗi cần sửa, không phải do mock sai.

### Bước 3: Sửa lỗi Tối thiểu (Surgical Fix & AST Compiler Self-Healing)
1. **Tra cứu Instincts:** Đọc `.agents/instincts.md` để đảm bảo không lặp lại bẫy mã nguồn đã từng gặp trong dự án.
2. **Sửa đổi Tối thiểu (Surgical Fix):** Thực hiện sửa đổi tối thiểu tại đúng điểm lỗi, bảo toàn 100% comment, docstring và tính toàn vẹn của file (Zero Lazy Code Placeholders).
3. **AST Compiler Diagnostic Parsing (Self-Healing):**
   - Khi build gặp lỗi biên dịch, phân tích log lỗi theo cấu trúc AST Compiler Diagnostics:
     - `File & Line:Col`: Định vị chính xác tọa độ lỗi biên dịch.
     - `Diagnostic Code / Type`: Nhận diện mã lỗi (vd: `TS2345`, `e: Unresolved reference`, `E0308`).
     - `Blast Radius Evaluation`: Đánh giá ảnh hưởng cục bộ hay ảnh hưởng đến caller bên ngoài.
4. **Kiểm toán Tối ưu Hiệu năng (Mandatory Performance Audit):**
   - Đảm bảo thuật toán đạt độ phức tạp tối ưu ($O(1)$ map lookup, $O(N)$ hoặc $O(N \log N)$), triệt tiêu vòng lặp lồng $O(N^2)$ trên tập dữ liệu động.
   - Tuyệt đối không thực hiện I/O, database hay network trên UI / Main Thread.
   - 100% luồng I/O, cursor, connection phải được đóng an toàn bằng `use`, `try-with-resources`, hoặc `try...finally`.
   - Tránh cấp phát bộ nhớ thừa trong hot path (tight loops / frame render).
5. **Kiểm toán Chống Nuốt Lỗi, Timeout & Structured Logging (Resilience Audit):**
   - Nghiêm cấm khối `catch` rỗng (`catch (e) {}`, `except: pass`). Mọi lỗi phải được log có ngữ cảnh hoặc re-throw có kiểm soát.
   - 100% request gọi mạng phải có Timeout tường minh (Connect $\le 10\text{s}$, Read $\le 15\text{s}$), không để treo vô tận.
   - Tuyệt đối cấm in chuỗi thô (`console.log`, `println`, `printStackTrace`). Dùng Structured Logger và mask 100% dữ liệu nhạy cảm (PII/Token).

### Bước 4: Xác minh Thành công (GREEN Phase)
1. Chạy lại đúng oracle đã thiết lập ở Bước 2:
   ```bash
   # Android / Java:
   ./gradlew :<module>:testDebugUnitTest --tests "*<RegressionTestClass>*"
   # Node.js / TS:
   npm test -- -t "RegressionTestName"
   # Python:
   pytest -k "test_regression_scenario"
   ```
2. Xác nhận test chuyển sang trạng thái thành công (**GREEN**).

### Bước 5: Chống hồi quy & Khóa Hồi Quy Vĩnh Viễn (Anti-Regression & Anti-Flapping Lock)
1. Kiểm tra compile toàn bộ source và unit test của module:
   ```bash
   # Android:
   ./gradlew :<module>:compileDebugKotlin :<module>:compileDebugUnitTestKotlin
   # Web:
   npm run build && npm run typecheck
   # Python:
   python3 -m py_compile $(git diff --name-only "*.py")
   ```
2. Chạy linter và format check (`ktlintCheck`, `eslint`, `flake8`).
3. **Khóa Hồi Quy Vĩnh Viễn (Anti-Flapping & Regression Lock):**
   - Bài test oracle vừa viết bắt buộc phải trở thành một phần vĩnh viễn của test suite dự án.
   - Tuyệt đối cấm sửa đổi hoặc nới lỏng các assertion của các bài test cũ để pass gian lận (Two-Way Test Suite Integrity).
   - Nếu trong tương lai bất kỳ commit nào làm mở lại bug này, test suite sẽ lập tức báo RED và chặn build ngay tức khắc.

### Bước 6: Cổng Kiểm Toán Post-Fix Bắt Buộc (Post-Fix Audit & TIA Gate)
1. Kích hoạt cổng kiểm toán và checklist đánh dấu tự động:
   ```bash
   postfix-gate
   # hoặc:
   python3 universal-agent-devkit/bin/post-fix-gate.py
   ```
2. Đảm bảo đạt đủ 8 tiêu chí kiểm toán:
   - [x] Quét secret & API key: SẠCH (0 rò rỉ)
   - [x] Anti-Laziness: Không có placeholder `// ... existing code ...`
   - [x] Paired Oracle: Bằng chứng RED và GREEN hợp lệ
   - [x] TIA Regression Checklist: Toàn bộ test liên đới đều `PASS`
   - [x] UI/UX & a11y: Tuân thủ `DESIGN.md` (touch target $\ge 48\text{dp}$, debounced buttons)
   - [x] Tối ưu Hiệu năng (Performance): Không chặn Main Thread, 0 memory leak, thuật toán tối ưu $O(1)/O(N)$
   - [x] Khả năng Phục hồi & Nhật ký (Resilience & Logging): 0 empty catch, có timeout, không log thô/lộ PII
   - [x] Alibaba OpenCodeReview: 0 Blocking Defects, 0 Memory Leaks, 0 Data Contaminations
3. Cập nhật bài học kinh nghiệm mới vào `.agents/instincts.md` nếu phát hiện bẫy mới.
4. **Xuất Báo Cáo Nghiệm Thu 4 Mục Súc Tích:** Đính kèm ảnh minh chứng THÀNH CÔNG (PASS badge) và xuất trình báo cáo nghiệm thu 4 mục bằng ngôn ngữ tự nhiên: (1) Đã fix được gì; (2) Đã chặn đứng bug cũ nào; (3) Nguy cơ bug mới đã triệt tiêu; (4) Trạng thái an toàn mã nguồn, hiệu năng & khả năng phục hồi.
