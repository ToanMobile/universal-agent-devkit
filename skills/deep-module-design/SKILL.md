---
name: deep-module-design
description: Dùng khi thiết kế hoặc đánh giá interface/seam, testability hay abstraction của một module. Bỏ qua khi chỉ cần tìm caller/blast radius hoặc sửa local không đổi contract.
---

# Deep Module Design

## Mục tiêu

Một module tốt ẩn nhiều behavior phức tạp sau một contract nhỏ và ổn định. Skill này giúp quyết định abstraction có tạo leverage/locality thực sự hay chỉ thêm tầng indirection vô nghĩa.

## Lens Đánh Giá

- **Interface:** Mọi thứ caller phải biết: signature, invariant, ordering, error/config/performance mode.
- **Implementation:** Chi tiết ẩn sau interface.
- **Seam:** Vị trí thay đổi behavior mà không sửa consumer.
- **Depth:** Behavior hữu ích được ẩn so với lượng contract caller phải học; không đo bằng số dòng.
- **Locality:** Thay đổi đúng một nơi thay vì lặp lại ở nhiều caller.

### Bốn câu hỏi then chốt:

1. Xóa abstraction thì độ phức tạp (complexity) biến mất hay tràn về nhiều caller?
2. Có ít nhất hai implementation/adapter thật sự (ví dụ production và deterministic test) không?
3. Caller có cần biết chi tiết implementation, ordering hoặc error mode không?
4. Test qua observable contract có sống sót khi refactor nội tại không?

Nếu abstraction chỉ pass-through, dùng một lần hoặc tạo seam giả định, ưu tiên code trực tiếp. Không ép interface chỉ để mock.

## Nguyên Tắc Thiết Kế

- Inject dependency thay vì tự tạo ở nơi cần thay thế.
- Trả result/state rõ ràng thay vì side effect ẩn.
- Pure/in-memory dependency: test trực tiếp, thường không cần adapter.
- Local/remote/external dependency: đặt seam ở boundary thật; giữ contract nhỏ và có production/test adapter khi mang lại leverage.
- Trước khi đổi public API, DI graph hoặc module boundary: trace 100% caller qua MCP Graph (`trace_path`).
