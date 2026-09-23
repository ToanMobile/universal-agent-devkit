---
name: incremental-implementation
description: Dùng khi implement feature/thay đổi nhiều file hoặc task khó verify trong một bước. Bỏ qua edit local đã rõ và config không có logic.
---

# Incremental Implementation (Chia Nhỏ Để Triển Khai)

## Vòng Lặp Increment

`Implement → Test → Verify → Checkpoint cục bộ → Lát cắt kế tiếp` — Mang kết quả tiến lên từng bước, không bắt đầu lại từ đầu mỗi lát cắt. Checkpoint là diff đã verify an toàn trong working tree, không phải Git commit.

## 3 Chiến Lược Cắt Lát (Slicing Strategies)

| Chiến lược | Khi dùng | Mô tả |
| :-- | :-- | :-- |
| **Vertical Slice** (Mặc định) | Mỗi lát = 1 đường xuyên full-stack chạy end-to-end | Xử lý trọn vẹn 1 luồng nhỏ từ Model -> Controller/VM -> UI trước khi mở rộng |
| **Contract-First** | Nhiều module làm việc song song | Chốt chặt Interface/Contract và mock tests trước, sau đó mới implement chi tiết |
| **Risk-First** | Có phần bất định hoặc rủi ro kỹ thuật cao | Giải quyết và chứng minh phần rủi ro/thuật toán khó nhất trước khi làm UI |

## 5 Quy Tắc Kỷ Luật

1. **Simplicity-First:** Tránh tạo abstraction quá sớm khi mới chỉ có 1 call-site.
2. **Scope-Discipline:** Thấy chỗ khác có vấn đề -> Ghi nhận `"NOTICED BUT NOT TOUCHING: <x>"`, tuyệt đối không drive-by refactoring sửa lan.
3. **One-Thing-Per-Checkpoint:** 1 lát cắt = 1 thay đổi logic độc lập. Tách biệt hoàn toàn thao tác xóa (delete) và thao tác thêm (add).
4. **Luôn Biên Dịch Được:** Sau mỗi lát cắt, toàn bộ test suite và build phải giữ trạng thái GREEN.
5. **Rollback-Friendly:** Thiết kế code theo hướng có thể hoàn tác ngay lập tức nếu phát sinh sự cố.
