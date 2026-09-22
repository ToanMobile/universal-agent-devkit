# Android Mobile Engineering Rules

## 1. Solo-Dev & Chống Spam Thao Tác (Debounce/Disabled)
- Mọi nút kích hoạt thao tác quan trọng, xác nhận giao dịch hoặc gọi API bắt buộc phải:
  1. **Disable ngay lập tức** sau cú click đầu tiên.
  2. Hiển thị trạng thái Loading hoặc Spinner.
  3. Áp dụng debounce tối thiểu $1000\text{ms}$ để tránh double click hoặc spam job queue.

## 2. Bảo mật Mobile & Tuyệt đối Cấm lộ Bí mật
- Tuyệt đối không hardcode API key, auth token, mật khẩu kiểm thử hoặc cookie trần trong code.
- Cấu hình qua `.env` hoặc `local.properties` (đã vào `.gitignore`).
- Mọi `PendingIntent` bắt buộc phải khai báo cờ rõ ràng: `PendingIntent.FLAG_IMMUTABLE` (hoặc `FLAG_MUTABLE` nếu thực sự cần thiết kèm giải trình).

## 3. Quản trị Hiệu năng & UI Thread (Chống ANR)
- CẤM chạy tác vụ I/O, truy vấn Room/SQLite hoặc tính toán mã hóa trên UI Main Thread.
- Sử dụng Kotlin Coroutines với `Dispatchers.IO` hoặc `Dispatchers.Default`.
- Quản lý kích thước Bitmap, tái chế bộ nhớ tránh OutOfMemory (OOM).

## 4. Nghiệm thu & Chụp ảnh Minh chứng (Acceptance Gate)
- Mọi tính năng hoàn thành bắt buộc phải có ảnh chụp màn hình xác minh trạng thái **THÀNH CÔNG (PASS / Success State)**.
- Soát git diff trước khi báo cáo Tech Lead / Reviewer.
