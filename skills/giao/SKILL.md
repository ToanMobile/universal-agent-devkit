---
name: giao
description: Giao một task cho Google Antigravity làm rồi tự audit, code review, chạy test, đòi ảnh nghiệm thu trước khi chốt (Leader PM ↔ Worker Sandbox Protocol). Dùng cho MỌI project có MCP antigravity-pm. Tự động kích hoạt khi gõ /giao, "giao Antigravity", "giao cho Antigravity làm", "bảo Antigravity sửa", hoặc khi Leader PM cần phân công cho Antigravity làm trong môi trường sandbox với chính sách commitPolicy: forbid.
---

# Giao Việc Cho Antigravity (Leader PM ↔ Worker Protocol)

Antigravity viết code trong môi trường sandbox độc lập. **Bạn (Leader/PM) kiểm tra và chịu trách nhiệm nghiệm thu.** Tuyệt đối không tự viết code phần đã giao — làm thế là mất tác dụng của review và audit độc lập.

Project mặc định là thư mục đang làm việc; mọi tool nhận tham số `project` nếu cần chỉ định vị trí khác.

---

## 1. Trước Khi Giao (Pre-flight Check)
- Gọi `pm_doctor`: Kiểm tra Antigravity có đang chạy không, project đã đăng ký trong sổ dự án chưa, lệnh test và provider chụp ảnh đã khai chưa.
- Cấu hình đọc 2 tầng: `~/.antigravity-pm.json` (chung toàn hệ thống) ➔ `<project>/.antigravity-pm.json` (đè lên theo từng dự án).
- Nếu chưa có lệnh test (`testCommand`) hoặc provider ảnh, phải thông báo ngay vì cổng nghiệm thu sẽ chặn nếu thiếu.

---

## 2. Ba Thành Phần Bắt Buộc Trong Brief
Thiếu thành phần nào thì hỏi ngắn gọn người dùng, không tự suy diễn:
1. **Việc + Hiện trạng:** Lỗi ở đâu, luồng nào, file nào nếu đã xác định.
2. **Phạm vi (Scope):** Được sửa những gì, **CẤM** đụng vào những vùng nào.
3. **Bằng chứng nghiệm thu (Acceptance Proof):** Tiêu chí kiểm chứng nào chứng minh là xong (test nào xanh, ảnh chụp màn hình nào chứng minh).

---

## 3. Vòng Lặp Phân Công 7 Giai Đoạn (7-Phase Workflow)
**Kế hoạch là việc của Leader PM.** Antigravity không tự lập kế hoạch — nó chỉ phản biện kế hoạch của bạn rồi thực thi.

1. **Khởi tạo Task (`pm_task_create`):** `definitionOfDone` bắt buộc phải kiểm chứng được ("test X pass", "ảnh giao diện hiển thị badge Y"), cấm ghi mơ hồ "chạy ổn".
2. **PM Viết Kế Hoạch (`pm_plan`):** Kế hoạch phải dẫn chứng `file:line` thật, các bước phẫu thuật, danh sách file sửa đổi, phân tích blast radius và cách chứng minh.
3. **Giao Phản Biện Kế Hoạch (`pm_dispatch kind=plan_review`):** Antigravity đọc mã nguồn thật và tìm lỗ hổng trong kế hoạch (CẤM sửa code trong giai đoạn này).
4. **Đọc Phản Biện (`pm_status` ➔ `plan-review.json`):**
   - Nếu phát hiện kế hoạch sai: PM tự cập nhật lại kế hoạch (`pm_plan`), bản phản biện cũ tự động bị hủy để duyệt lại.
   - Nếu kế hoạch vững chắc: `pm_verdict kind=plan verdict=pass`.
5. **Giao Triển Khai (`pm_dispatch kind=implement`):** Mở hội thoại làm việc cho Antigravity với toàn văn kế hoạch đã chốt.
6. **Kiểm Tra Thực Tế (`pm_diff`):** Soi git diff thực tế. `result.json` của agent chỉ là lời khai; diff mới là sự thật.
   - Có thể mở mắt thứ hai: `pm_dispatch kind=audit` để hội thoại audit độc lập chỉ đọc soi xét.
7. **Phán Quyết & Nghiệm Thu:**
   - `pm_verdict kind=audit` ➔ `pm_verdict kind=review`.
   - `pm_run kind=test`: PM tự chạy test để lấy exit code thật.
   - `pm_capture_proof`: Thu thập ảnh nghiệm thu thật từ thiết bị/màn hình.
   - `pm_accept`: Cổng nghiệm thu tự động kiểm tra đủ 6 bằng chứng mới phê chuẩn. Nếu phát hiện lỗi: gọi `pm_rework` để tăng vòng và hủy bằng chứng cũ.
   - **Biên lai Nghiệm thu (Receipt Verification & Bằng Chứng Nghiệm Thu):** Cấp phát biên lai nghiệm thu kèm hàm băm xác thực kết quả thực tế.

---

## 4. Luật Bất Biến (Non-Negotiable Gates)
- Thay đổi **BẮT BUỘC có test đi kèm** — test cũ xanh không chứng minh được gì cho tính năng mới.
- Ảnh nghiệm thu phải chụp từ **thiết bị thật / emulator** nếu project khai `proof.require`.
- Không lách luật: Không chụp màn hình trống hoặc fake test pass.
