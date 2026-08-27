---
name: deep-module-design
description: Dùng khi thiết kế hoặc đánh giá interface/seam, testability hay abstraction của một module OfficeReader. Bỏ qua khi chỉ cần tìm caller/blast radius hoặc sửa local không đổi contract.
---

# Deep Module Design

## Mục tiêu

Một module tốt ẩn nhiều behavior sau contract nhỏ, ổn định. `graph-navigation` trả lời cấu trúc; skill
này giúp quyết định abstraction có tạo leverage/locality thật hay chỉ thêm indirection.

## Lens đánh giá

- **Interface:** mọi thứ caller phải biết: signature, invariant, ordering, error/config/performance mode.
- **Implementation:** chi tiết ẩn sau interface.
- **Seam:** vị trí thay behavior mà không sửa consumer.
- **Depth:** behavior hữu ích được ẩn so với lượng contract caller phải học; không đo bằng số dòng.
- **Locality:** thay đổi đúng một nơi thay vì lặp ở nhiều caller.

Hỏi bốn câu:

1. Xóa abstraction thì complexity biến mất hay tràn về nhiều caller?
2. Có ít nhất hai implementation/adapter thật sự (ví dụ production và deterministic test) không?
3. Caller có cần biết chi tiết implementation, ordering hoặc error mode không?
4. Test qua observable contract có sống sót khi refactor nội tại không?

Nếu abstraction chỉ pass-through, dùng một lần hoặc tạo seam giả định, ưu tiên code trực tiếp theo B2.
Không ép interface chỉ để mock.

## Thiết kế

- Inject dependency thay vì tự tạo ở nơi cần thay thế.
- Trả result/state rõ thay vì side effect ẩn.
- Pure/in-memory dependency: test trực tiếp, thường không cần adapter.
- Local/remote/external dependency: đặt seam ở boundary thật; giữ contract nhỏ và có production/test
  adapter khi mang lại leverage.
- Trước đổi public API, DI graph hoặc module boundary: trace mọi caller và xin authority theo
  `AGENTS.md`/`AGENTS.md`.

Khi có nhiều thiết kế hợp lý, tự phác ít nhất hai phương án, so sánh depth/locality/compatibility và chọn
phương án evidence-supported. Chỉ dùng sub-agent khi harness/project policy cho phép và task đủ lớn.

Liên kết: [[rulebook/05-architecture]] · [[rulebook/08-code-organization-dry]] · [[rulebook/17-testing]] · [[graph-navigation]].
