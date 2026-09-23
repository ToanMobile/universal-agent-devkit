---
name: context-enricher
description: Tự động phân tích, mở rộng và làm giàu ngữ cảnh từ câu prompt ngắn gọn hoặc ngôn ngữ tự nhiên của người dùng thành Hồ Sơ Kỹ Thuật Đầy Đủ 5 Chiều (5D Context Dossier). Tự động truy vết codebase graph, nạp ràng buộc của active profile, tra cứu bẫy mã nguồn lịch sử (instincts), và gắn các yêu cầu phi chức năng ngầm định (debounce, a11y >= 48dp, non-blocking main thread, mask PII, paired test oracle) trước khi viết code, đảm bảo đầu ra luôn đạt chất lượng 10/10 mà không cần người dùng phải prompt chi tiết.
---

# Autonomous Prompt Context & Intent Enrichment (Làm Giàu Ngữ Cảnh Tự Động)

Kỹ năng này giải quyết triệt để vấn đề: **Người dùng chỉ gõ prompt ngắn gọn hoặc ngôn ngữ tự nhiên đời thường, nhưng hệ thống vẫn tự động suy luận và sinh ra kết quả xuất sắc đẳng cấp Senior mà không cần người dùng phải nhắc chi tiết từng quy chuẩn kỹ thuật.**

---

## 1. Nguyên Lý Vàng: Từ Prompt Ngắn ➔ Hồ Sơ Kỹ Thuật 5 Chiều (5D Dossier)

Khi người dùng đưa ra một yêu cầu ngắn (ví dụ: *"sửa nút login bị crash khi xoay màn hình"* hoặc *"thêm chức năng lọc đơn hàng"*), Agent **TUYỆT ĐỐI KHÔNG CODE NGAY LẬP TỨC** theo nghĩa đen. 

Agent **TỰ ĐỘNG CHẠY BƯỚC LÀM GIÀU NGỮ CẢNH** qua 5 chiều kỹ nghệ:

```
┌──────────────────────────────────────────────────────────────────┐
│                   BRIEF USER PROMPT                              │
│       "sửa nút login bị bấm nhiều lần văng app"                  │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Autonomous Context Enrichment
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│              5-DIMENSIONAL TECHNICAL CONTEXT DOSSIER             │
│                                                                  │
│  [D1] Codebase Topology : search_graph(".*login.*") ➔ Inbound    │
│  [D2] Active Profile    : Android Clean Architecture + Jetpack   │
│  [D3] Instincts Memory  : INSTINCT-002 (Debounce) + INSTINCT-006 │
│  [D4] Injected NFRs     : Debounce >= 1000ms, Touch Target >=48dp│
│                           Non-blocking Main Thread, Mask PII     │
│  [D5] Paired Oracle     : Test RED (double-click triggers 1 req) │
│                           Test GREEN (debounce verified)         │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Autonomous Execution
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│          SURGICAL IMPLEMENTATION & 8-LAYER VERIFICATION          │
│   (Zero Swallowing, Zero Placeholders, 100% Post-Fix Gate PASS)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết 5 Chiều Làm Giàu Ngữ Cảnh (5 Dimensions)

### [D1] Truy Vết Tô-Pô Mã Nguồn (Codebase Topological Discovery)
- **Công cụ:** Gọi MCP `codebase-memory-mcp` hoặc AST:
  - `search_graph(name_pattern=".*<Keyword>.*")`: Định vị chính xác class, function, handler thật.
  - `trace_path(function_name="...", direction="inbound")`: Quét 100% callers để khóa chặt blast radius.
- **Mục tiêu:** Không đoán mò đường dẫn file; mọi thao tác đều dựa trên mã nguồn thực tế.

### [D2] Ràng Buộc Theo Hồ Sơ Dự Án (Active Profile & Platform Constraints)
- Đọc `.active-profile.json` để áp dụng đặc thù nền tảng:
  - **Android:** Coroutines `Dispatchers.IO`, `FLAG_IMMUTABLE`, vòng đời Lifecycle, a11y $\ge 48\text{dp}$.
  - **Automotive:** CAN debounce $80\text{ms}$, API 28 quirks, CarPropertyService isolation.
  - **Game 3D:** Triệt tiêu GC allocation trong `Update()`, Physics `NonAlloc`, ma trận 75/75.
  - **Voice Assistant:** *"Graceful Silence over Wrong Execution"*, kiểm thử âm thanh 2 tầng.
  - **Universal:** Clean Architecture, SOLID, DIP, Dependency Injection.

### [D3] Tiền Sử Lỗi & Bẫy Mã Nguồn (Cognitive Failure Memory)
- Tra cứu nhanh `.agents/instincts-index.md`:
  - `[INSTINCT-001]`: Khôi phục trạng thái khi Configuration Change.
  - `[INSTINCT-002]`: Chống spam thao tác đúp (Button Double-Click).
  - `[INSTINCT-006]`: Cấm chặn Main Thread, cấm lặp $O(N^2)$ trên mảng động.
  - `[INSTINCT-007]`: Cấm nuốt lỗi âm thầm (Empty Catch Block).

### [D4] Bổ Sung Yêu Cầu Phi Chức Năng Ngầm Định (Implicit NFRs Injection)
Đây là các tiêu chuẩn mà người dùng **KHÔNG BAO GIỜ GÕ TRONG PROMPT**, nhưng hệ thống **BẮT BUỘC TỰ ĐỘNG THI HÀNH**:
1. **Chống Spam Nút Bấm:** Debounce $\ge 1000\text{ms}$ + Instant Disable ngay mili-giây đầu tiên + Hiển thị Loading spinner.
2. **Kích Thước Vùng Chạm:** Touch target $\ge 48\times 48\text{dp}$ (Mobile) / $\ge 44\times 44\text{px}$ (Web).
3. **An Toàn Luồng Chính:** Tuyệt đối không gọi I/O hoặc tính toán nặng trên Main Thread.
4. **Bảo Mật Dữ Liệu:** Mask 100% PII (Token, Password, CCCD) trước khi in log.
5. **Khả Năng Phục Hồi:** Timeout mạng tường minh (Connect $\le 10\text{s}$, Read $\le 15\text{s}$) & Idempotency Key (UUIDv4).
6. **Chống Nuốt Lỗi:** Cấm 100% khối `catch` rỗng.

### [D5] Thiết Kế Bài Test Đối Lập (Paired Executable Oracle Spec)
- Tự động xác định:
  - **Điều kiện RED:** Kịch bản test nào sẽ thất bại trên mã nguồn hiện tại?
  - **Điều kiện GREEN:** Sau khi sửa, bài test nào sẽ chuyển sang màu xanh và chứng minh lỗi đã biến mất?

---

## 3. Công Cụ Trợ Lực Tự Động (CLI Helper)

Agent có thể chạy công cụ phân tích ngữ cảnh tự động bất cứ lúc nào:
```bash
./scripts/enrich_context.py "<câu prompt của người dùng>"
```
Lệnh này trả về đối tượng JSON chứa đầy đủ 5 chiều ngữ cảnh, danh sách query MCP Graph, các bẫy mã nguồn cần tránh, và các skill cần chuỗi hóa tiếp theo.

---

## 4. Tích Hợp Vào Chuỗi Quy Trình Tự Động (Autonomous Execution)
Kỹ năng `context-enricher` là **Cổng Vào Đầu Tiên (Front-End Gateway)** của mọi đợt xử lý yêu cầu. Sau khi làm giàu ngữ cảnh, hệ thống tự động đẩy dữ liệu sang các bước kế tiếp:
`context-enricher` ➔ `fixbugs` / `deep-module-design` ➔ `tdd-workflow` ➔ `post-fix-gate` (8 layers) ➔ Báo cáo nghiệm thu B10.
