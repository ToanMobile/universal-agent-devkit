# Universal General & Clean Architecture Engineering Rules

## 1. Solo-Dev & Git Security (BẮT BUỘC)
- CHỈ thực hiện `git commit`, `git push` hoặc tạo PR (`gh pr create`) khi người dùng YÊU CẦU TƯỜNG MINH.
- Tuyệt đối KHÔNG commit bí mật / credentials: `.env`, keys, token, mật khẩu, cookies.
- Mọi tài khoản hoặc cấu hình nhạy cảm phải nạp qua biến môi trường hoặc file cấu hình cục bộ (`.gitignore`).
- Soát kỹ `git diff` trước khi báo cáo hoàn thành.

## 2. Paired Executable Oracle & Zero-Defect TDD
- Khi sửa lỗi (bug-fixing) hoặc phát triển tính năng mới:
  1. **RED:** Viết bài test tái hiện lỗi trước, chạy test xác nhận THẤT BẠI.
  2. **GREEN:** Sửa code tối giản để bài test chuyển sang THÀNH CÔNG.
  3. Cấm mock lỏng lẻo (`assert True`), cấm xóa hoặc đổi assertion của test để pass gian lận.

## 3. Chống Spam & Quản trị Bất đồng bộ (Debounce / Rate Limit)
- Các thao tác gọi API tốn kém, xác nhận giao dịch hoặc kích hoạt workflow bắt buộc có Debounce / Loading state.
- Không spam request liên tục làm quá tải backend, job queue hoặc làm nghẽn dịch vụ thông báo.

## 4. Bằng chứng Nghiệm thu (Acceptance Gate)
- Tính năng chỉ được xem là hoàn tất khi có bằng chứng xác minh trạng thái **THÀNH CÔNG (PASS / Success State)**:
  - Thông báo thành công (toast/modal), trạng thái nghiệp vụ hoàn tất.
  - Báo cáo kiểm thử hoặc screenshot kết quả thực tế.
