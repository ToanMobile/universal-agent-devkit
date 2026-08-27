---
name: graph-navigation
description: Dùng khi khám phá code, tìm symbol, đọc implementation, trace call/data flow, phân tích blast radius, test coverage hoặc architecture Target Project / Codebase. Bỏ qua với literal, config, docs và generated files; dùng Read/Grep trực tiếp cho các trường hợp đó.
---

# Graph Navigation

## Protocol bắt buộc

Code discovery luôn theo thứ tự nhỏ nhất đủ evidence:

1. `search_graph(name_pattern="...")` để resolve symbol.
2. `trace_path(function_name="...", direction="inbound|outbound")` để tìm caller/callee và blast
   radius khi task cần impact/flow.
3. `get_code_snippet(qualified_name="...")` để đọc source chính xác sau khi đã resolve qualified name.
4. `query_graph` cho quan hệ phức tạp; `get_architecture` cho overview/module hub.

Không áp hard cap tool-call/token. Dừng ở chuỗi nhỏ nhất nhưng phải đủ chứng minh kết luận.

## Fallback

Dùng `Read`/`Grep` trực tiếp cho string literal, error text, Gradle/config, scripts, docs, generated file,
hoặc khi graph thiếu/stale node. Ghi rõ lý do fallback. Sau fallback, không suy diễn caller: đọc/trace các
call site thật trước khi claim.

## Theo tác vụ

- Debug: resolve frame/symbol → trace inbound/outbound → đọc source → đối chiếu log/repro.
- Refactor/API change: trace mọi inbound caller và affected flow; tìm test liên quan trước khi sửa.
- Review: đối chiếu diff với inbound/outbound path; finding phải có source evidence.
- Cross-module/architecture: `get_architecture`/`query_graph`, rồi verify dependency thực trong Gradle.
- Dead code: chỉ kết luận sau graph inbound sạch và fallback source/reference search sạch.

## Guardrails

- Không bịa qualified name, line, fan-in, test coverage hoặc graph metric.
- Graph là index hỗ trợ discovery, không thay thế source/test/runtime evidence.
- Nếu graph và source mâu thuẫn, source hiện tại thắng; ghi graph stale và fallback.
- External library behavior phải verify bằng official docs/Context7 hoặc test thật.

Liên kết: `AGENTS.md` W1/Rule 5/Rule 6.1 · [[rulebook/44-systematic-debugging]].
