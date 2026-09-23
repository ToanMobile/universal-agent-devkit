---
name: codebase-memory
description: Use the codebase knowledge graph for structural code queries, AST navigation, and blast radius analysis. Dùng khi khám phá code, tìm symbol, đọc implementation, trace call/data flow, ai gọi hàm này (inbound caller), hàm này gọi gì (outbound), phân tích blast radius, dead code, refactor candidates, Cypher query, hoặc xem kiến trúc dự án. Tự động fallback về Read/Grep khi thiếu node hoặc index stale.
---

# Codebase Memory & Graph Navigation (SSOT)

Kết hợp công cụ Đồ thị Tri thức AST (`codebase-memory-mcp`) và Quy trình Điều hướng Tinh gọn, trả về kết quả cấu trúc chính xác chỉ tiêu tốn ~500 tokens (so với ~80K tokens của brute-force grep).

---

## 1. Protocol Bắt Buộc (Minimal Evidence Discovery Protocol)

Code discovery luôn tuân thủ theo thứ tự nhỏ nhất đủ bằng chứng (evidence):

1. **Resolve Symbol:** `search_graph(name_pattern="...")` để định vị chính xác tên hàm, class hoặc interface.
2. **Truy vết Blast Radius:** `trace_path(function_name="...", direction="inbound|outbound")` để tìm callers/callees và khóa chặt phạm vi ảnh hưởng khi sửa code.
3. **Đọc Source Chính Xác:** `get_code_snippet(qualified_name="...")` sau khi đã resolve được qualified name.
4. **Quan Hệ Phức Tạp:** `query_graph` bằng truy vấn Cypher; `get_architecture` cho bức tranh tổng thể / module hub.

> **Nguyên tắc:** Không áp hard cap tool-call/token. Dừng ở chuỗi nhỏ nhất nhưng phải đủ chứng minh kết luận.

---

## 2. Cơ Chế Fallback (Graceful Degradation)

- Dùng `Read`/`Grep` trực tiếp cho string literal, error text, Gradle/config, scripts, docs, generated file, hoặc khi graph thiếu/stale node.
- Luôn ghi rõ lý do fallback.
- Sau khi fallback, tuyệt đối không suy diễn caller: phải đọc/trace các call site thực tế trước khi đưa ra kết luận.

---

## 3. Quy Trình Điều Hướng Theo Tác Vụ (Task-Directed Workflows)

- **Debug / Bug Fix:** Resolve frame/symbol $\rightarrow$ Trace inbound/outbound $\rightarrow$ Đọc source $\rightarrow$ Đối chiếu log/repro.
- **Refactor / API Change:** Trace 100% inbound caller và affected flow; tìm toàn bộ unit test liên quan trước khi sửa.
- **Code Review:** Đối chiếu git diff với inbound/outbound path; mọi finding phải có source code evidence đi kèm.
- **Cross-module / Architecture:** Dùng `get_architecture` hoặc `query_graph`, sau đó verify dependency thực tế trong file cấu hình build (Gradle, npm, Cargo).
- **Dead Code Detection:** Chỉ kết luận dead code sau khi cả graph inbound sạch (`max_degree=0`) VÀ kết quả tìm kiếm source/reference bằng Grep sạch 100%.

---

## 4. Ma Trận Quyết Định Nhanh (Quick Decision Matrix)

| Nhu Cầu | Lệnh Tool MCP Đồ Thị |
|---|---|
| Ai gọi hàm X? (Inbound Callers) | `trace_path(direction="inbound")` |
| Hàm X gọi những gì? (Callees) | `trace_path(direction="outbound")` |
| Toàn bộ ngữ cảnh gọi 2 chiều | `trace_path(direction="both")` |
| Tìm hàm/class theo pattern | `search_graph(name_pattern="...")` |
| Tìm code rác (Dead code) | `search_graph(max_degree=0, exclude_entry_points=true)` |
| Quan hệ gọi qua API/Microservices | `query_graph` với cú pháp Cypher |
| Phân tích ảnh hưởng của Git Diff | `detect_changes()` |
| Phân loại rủi ro luồng gọi | `trace_path(risk_labels=true)` |
| Tìm kiếm chuỗi văn bản thô | `search_code` hoặc `Grep` (fallback) |

---

## 5. Danh Mục 14 Tool MCP & Edge Types

### 14 MCP Tools
`index_repository`, `index_status`, `list_projects`, `delete_project`, `search_graph`, `search_code`, `trace_path`, `detect_changes`, `query_graph`, `get_graph_schema`, `get_code_snippet`, `get_architecture`, `manage_adr`, `ingest_traces`.

### Edge Types
`CALLS`, `HTTP_CALLS`, `ASYNC_CALLS`, `IMPORTS`, `DEFINES`, `DEFINES_METHOD`, `HANDLES`, `IMPLEMENTS`, `OVERRIDE`, `USAGE`, `FILE_CHANGES_WITH`, `CONTAINS_FILE`, `CONTAINS_FOLDER`, `CONTAINS_PACKAGE`.

---

## 6. Cú Pháp Truy Vấn Cypher Mẫu (`query_graph`)

```cypher
// 1. Tìm các cuộc gọi HTTP liên dịch vụ
MATCH (a)-[r:HTTP_CALLS]->(b) RETURN a.name, b.name, r.url_path, r.confidence LIMIT 20

// 2. Tìm toàn bộ hàm xử lý sự kiện (Handler)
MATCH (f:Function) WHERE f.name =~ '.*Handler.*' RETURN f.name, f.file_path

// 3. Tìm các hàm mà hàm main trực tiếp gọi
MATCH (a)-[r:CALLS]->(b) WHERE a.name = 'main' RETURN b.name
```

---

## 7. Rào Chắn An Toàn (Guardrails & Gotchas)

1. **Tuyệt đối không bịa đặt:** Không bịa qualified name, dòng code, fan-in, test coverage hoặc graph metric.
2. **Source of Truth:** Graph là chỉ mục hỗ trợ discovery, không thay thế runtime evidence. Nếu graph và source mâu thuẫn, source code hiện tại thắng; ghi nhận graph stale và kích hoạt fallback.
3. **Thư viện ngoài:** Hành vi của external library phải được xác thực bằng official docs (Context7) hoặc test thực tế.
4. **Gotchas khi dùng tool:**
   - `search_graph(relationship="HTTP_CALLS")` lọc node theo bậc — dùng `query_graph` với Cypher để thấy cạnh thực tế.
   - `query_graph` giới hạn tối đa 200 dòng — dùng `search_graph` kèm filter bậc để đếm tổng số.
   - `trace_path` đòi hỏi tên chính xác — luôn gọi `search_graph(name_pattern=...)` trước để lấy exact name.
   - Kết quả phân trang mặc định 10 items/page — kiểm tra `has_more` và dùng `offset` khi cần duyệt tiếp.
