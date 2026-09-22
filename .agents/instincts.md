# Instincts & Failure Memory — Repository Lessons Learned

> **Quy định Vận hành cho AI Agent:**
> Tệp này ghi nhận lại các "bẫy mã nguồn" (traps), sai lầm trong quá khứ hoặc lỗi hồi quy từng xảy ra trên codebase này.
> Trước khi sửa code hoặc đề xuất giải pháp, AI Agent BẮT BUỘC phải đọc lướt qua các bẫy dưới đây để **tuyệt đối không đi vào vết xe đổ**.
> Khi gặp một lỗi mới hoặc bài học kinh nghiệm sâu sắc, AI Agent phải tự giác cập nhật thêm một mục vào tệp này.

---

## 1. Bẫy Thường Gặp & Bài Học Kinh Nghiệm (Active Instincts)

### [INSTINCT-001] Tránh Mất Mát Mã Nguồn Do Placeholder Lười Biếng
- **Hiện tượng lỗi:** Khi chỉnh sửa file dài, agent tự động phát sinh `// ... existing code ...` hoặc `# keep existing logic`, làm bay màu các hàm xung quanh khi lưu file.
- **Nguyên nhân gốc rễ:** Model cố gắng tối ưu token đầu ra nên bỏ qua đoạn giữa.
- **Quy tắc bắt buộc:** Luôn thay thế trọn vẹn khối mã liền mạch, kiểm tra độ dài file và git diff trước khi xác nhận hoàn tất.
- **Kiểm tra tự động:** `grep -En "// \.\.\.|\/\* \.\.\.|\# \.\.\." <modified_files>` phải trả về 0 kết quả.

---

### [INSTINCT-002] Chống Đúp Request & Spam Thao Tác (Button Double-Click)
- **Hiện tượng lỗi:** Người dùng click nhanh hoặc mạng lag làm gọi API/workflow 2 lần liên tiếp, dẫn tới trùng lặp dữ liệu hoặc lỗi race condition.
- **Nguyên nhân gốc rễ:** Thiếu debounce / disable trạng thái nút bấm ngay tại millisecond đầu tiên.
- **Quy tắc bắt buộc:** Mọi nút bấm kích hoạt xử lý bất đồng bộ hoặc gọi API đều phải có biến `isLoading` / `isSubmitting` để disable nút và hiển thị indicator ngay lập tức.

---

### [INSTINCT-003] Không Tái Phát Minh Bánh Xe (Don't Reinvent The Wheel)
- **Hiện tượng lỗi:** Tạo mới `DateUtils`, `StringHelper` hay `HttpWrapper` trong khi dự án đã có sẵn module tương tự ở thư mục chung.
- **Nguyên nhân gốc rễ:** Không tìm kiếm codebase trước khi bắt tay vào code.
- **Quy tắc bắt buộc:** Luôn chạy `grep_search` hoặc graph search các từ khóa liên quan trong project để tái sử dụng tiện ích nội bộ có sẵn.

---

### [INSTINCT-004] Bảo Vệ Bí Mật Môi Trường & Dữ Liệu Nhạy Cảm
- **Hiện tượng lỗi:** Hardcode API key, password, private key hoặc token test vào mã nguồn hoặc file test.
- **Nguyên nhân gốc rễ:** Tiện tay khi debug hoặc viết test nhanh.
- **Quy tắc bắt buộc:** Luôn đọc qua biến môi trường (`process.env`, `System.getenv`) hoặc file cấu hình nằm trong `.gitignore`. Che / mask dữ liệu nhạy cảm trước khi chụp ảnh báo cáo.

---

### [INSTINCT-005] Vùng Chạm Giao Diện Dưới Chuẩn Tiếp Cận (< 48dp)
- **Hiện tượng lỗi:** Nút bấm quá nhỏ hoặc quá sát nhau khiến người dùng khó tương tác trên màn hình cảm ứng hoặc web di động.
- **Nguyên nhân gốc rễ:** Chỉ căn chỉnh theo mắt nhìn trên màn hình desktop độ phân giải cao.
- **Quy tắc bắt buộc:** Mọi phần tử click/tap phải đảm bảo kích thước tối thiểu $\ge 48\times 48\text{dp}$ ($\ge 44\times 44\text{px}$ trên Web). Khoảng cách tối thiểu giữa 2 nút liền kề $\ge 8\text{dp}$.

---

### [INSTINCT-006] Chặn Luồng Chính (Main Thread) & Bẫy Hiệu Năng $O(N^2)$
- **Hiện tượng lỗi:** Ứng dụng bị đơ (ANR trên Android, lag/freeze UI trên Web/Desktop), giật khung hình khi cuộn danh sách lớn, hoặc rò rỉ bộ nhớ (OOM).
- **Nguyên nhân gốc rễ:** Thực hiện I/O (đọc file, DB, network) trên UI Thread, lồng vòng lặp $O(N^2)$ trên mảng động thay vì dùng HashMap/Set, hoặc quên đóng FileStream/Cursor/Listener.
- **Quy tắc bắt buộc:** 
  1. 100% I/O và tính toán nặng phải offload sang background coroutine / worker.
  2. Bắt buộc tra cứu $O(1)$ qua Map/Set khi join/filter 2 tập dữ liệu.
  3. Bắt buộc dùng `use` / `try-with-resources` để đóng 100% tài nguyên stream/connection.

---

### [INSTINCT-007] Nuốt Lỗi Âm Thầm (Empty Catch Block / Silent Exception)
- **Hiện tượng lỗi:** Ứng dụng chạy sai luồng dữ liệu, nút bấm không phản hồi nhưng không hề có thông báo hay crash log ("Ghost Bug").
- **Nguyên nhân gốc rễ:** Dùng `catch (e) {}` hoặc `except: pass` để "chữa cháy" cho qua unit test mà không xử lý hoặc log lỗi.
- **Quy tắc bắt buộc:** Nghiêm cấm khối catch rỗng. Bắt buộc ghi log lỗi kèm ngữ cảnh (Contextual Error Logging) hoặc hiển thị UI Error Boundary.

---

### [INSTINCT-008] Treo Vô Hạn Do Thiếu Timeout & Trùng Lặp Giao Dịch
- **Hiện tượng lỗi:** Ứng dụng quay vòng tròn loading vĩnh viễn khi mạng rớt; hoặc người dùng bị trừ tiền / tạo 2 đơn hàng khi mạng chập chờn.
- **Nguyên nhân gốc rễ:** Không set Timeout cho HTTP client; thiếu Idempotency-Key trên các request POST/PUT nhạy cảm.
- **Quy tắc bắt buộc:** 100% request mạng phải có timeout (Connect $\le 10\text{s}$, Read $\le 15\text{s}$). Mọi mutation request nhạy cảm phải gửi kèm header `Idempotency-Key`.

---

### [INSTINCT-009] In Log Thô (console.log / println) & Lộ Thông Tin Nhạy Cảm (PII)
- **Hiện tượng lỗi:** Log tràn ngập console production làm nghẽn I/O; lộ mật khẩu, access token, OTP hoặc số định danh trong Crashlytics / hệ thống log.
- **Nguyên nhân gốc rễ:** Thói quen debug bằng `console.log` / `println` thay vì Structured Logger; in thẳng toàn bộ payload request.
- **Quy tắc bắt buộc:** Nghiêm cấm log chuỗi thô trên production; bắt buộc dùng Structured Logger có log level; 100% dữ liệu nhạy cảm/Token phải được mask trước khi log.

---

### [INSTINCT-010] Sập Ứng Dụng Do Nâng Cấp Schema CSDL Thiếu Migration
- **Hiện tượng lỗi:** Người dùng cập nhật app lên bản mới thì bị văng ngay khi mở app (`Room cannot verify data integrity`).
- **Nguyên nhân gốc rễ:** Sửa đổi cấu trúc Entity/Table nhưng quên viết Migration Script hoặc dùng `fallbackToDestructiveMigration` làm mất sạch dữ liệu.
- **Quy tắc bắt buộc:** Mọi thay đổi schema CSDL phải có migration script và có bài test kiểm tra nâng cấp từ bản cũ lên bản mới.

---

## 2. Nhật Ký Bẫy Mã Nguồn Bổ Sung (Dành cho Dev / Agent thêm mới)

<!--
Mẫu ghi nhận:
### [INSTINCT-XXX] <Tên bẫy / Tình huống>
- **Ngày phát hiện:** YYYY-MM-DD
- **Hiện tượng lỗi:** <Mô tả lỗi hoặc hồi quy>
- **Nguyên nhân:** <Tại sao lại xảy ra>
- **Quy tắc phòng ngừa:** <Cách làm đúng từ nay về sau>
- **Lệnh kiểm tra:** <Câu lệnh kiểm tra tự động nếu có>
-->

### [INSTINCT-AUTO] StateLossOnProcessDeath
- **Ngày phát hiện:** 2026-09-22
- **Hiện tượng lỗi:** StateLossOnProcessDeath
- **Nguyên nhân:** ViewModel không dùng SavedStateHandle
- **Quy tắc phòng ngừa & Cách fix:** Dùng SavedStateHandle để khôi phục biến tạm
- **Lệnh kiểm tra:** postfix-gate
