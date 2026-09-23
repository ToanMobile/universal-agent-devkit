---
name: deprecation-migration
description: Dùng khi thay implementation, sunset API/feature/handler, xóa code cũ hoặc quyết định giữ hay migrate consumer. Bỏ qua feature mới thuần và local edit không đụng migration.
---

# Deprecation & Migration

## Gate Quyết Định 5 Bước

1. **Tìm kiếm toàn bộ consumer:** Bằng graph-first (`search_graph` → inbound `trace_path` → source snippet); fallback AST/Grep khi thiếu evidence.
2. **Xác nhận replacement đã sẵn sàng:** Đã tồn tại và được verify trên test case/fixture liên quan.
3. **Phân loại tác động:** Xác định migration là advisory hay bắt buộc, ảnh hưởng tương thích ngược và user-visible impact.
4. **Đánh giá rủi ro Rollback & Data:** Tuyệt đối cấm migration mang tính phá hủy (DROP/TRUNCATE) trên dữ liệu production.
5. **Kế hoạch Rollout an toàn:** Giữ compatibility adapter/flag khi cần coexistence giữa bản $N-1$ và $N$.

## Quy Trình Thực Thi

1. Đặt replacement sau seam hiện có; không tạo abstraction thừa cho một consumer đơn lẻ.
2. Migrate consumer theo thứ tự phụ thuộc (dependency order).
3. Test behavior song song khi cả old và new implementation còn hoạt động.
4. Chỉ xóa old implementation khi trace không còn bất kỳ caller nào trong toàn bộ codebase.
5. Xóa adapter/flag/test thừa khi chúng trở thành orphan.
