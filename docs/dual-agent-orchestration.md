# 🤖 Dual-Agent Orchestration: Leader PM (Claude) ↔ Worker (Antigravity)

> **Mô hình Điều phối Hai Tác Nhân Độc Lập:** Giải quyết triệt để vấn đề Context Drift, ảo tưởng suy luận và tự ý sửa đổi kế hoạch để hợp thức hóa mã nguồn sai.

---

## 1. Bối cảnh & Tại sao cần Mô hình Dual-Agent?

Trong mô hình **Single Agent (Một tác nhân duy nhất)**:
- Một AI vừa lập kế hoạch, vừa viết code, vừa tự chạy test và tự quyết định nghiệm thu.
- Khi gặp lỗi khó hoặc context window bị kéo dài, tác nhân dễ bị hiện tượng "say xỉn" (*context degradation*), tự hạ thấp tiêu chuẩn kiểm thử, tự sửa lại assertion của bài test cũ hoặc xóa bớt yêu cầu trong plan ban đầu để ép code "xanh".

Trong mô hình **Dual-Agent Orchestration**:
- Tách bạch hoàn toàn giữa **Tư duy Kiến trúc (Leader/PM)** và **Thực thi Kỹ thuật (Worker/Coder)**.
- Tạo ra cơ chế đối trọng (*Separation of Concerns & Adversarial Checks*), đảm bảo chất lượng code 10/10 trước khi vào nhánh chính.

---

## 2. Phân Tách Trách Nhiệm Chi Tiết

```
┌────────────────────────────────────────────────────────┐
│                   USER (TECH LEAD)                     │
└──────────────────────────┬─────────────────────────────┘
                           │ Lệnh / Yêu cầu nghiệp vụ
                           ▼
┌────────────────────────────────────────────────────────┐
│              LEADER AGENT (Claude Code / PM)           │
│  • Nghiên cứu GDD, PRD & Architecture Decision Record  │
│  • Phân tích Blast Radius qua MCP Graph (trace_path)   │
│  • Soạn thảo Test Specification & Tiêu chí nghiệm thu  │
│  • Lệnh giao việc (/giao) kèm ranh giới chặt chẽ       │
└──────────────────────────┬─────────────────────────────┘
                           │ Task Prompt + Sandboxed Policy
                           ▼
┌────────────────────────────────────────────────────────┐
│            WORKER AGENT (Google Antigravity)           │
│  • Hoạt động trong Sandbox (commitPolicy: "forbid")    │
│  • Tuân thủ TDD: Viết test RED -> Sửa code GREEN       │
│  • Tối ưu hiệu năng O(1), Anti-Swallowing, a11y >= 48dp│
│  • Nộp Bằng chứng: git diff + Test output + Ảnh chụp   │
└──────────────────────────┬─────────────────────────────┘
                           │ Báo cáo 4 mục + Visual Proof
                           ▼
┌────────────────────────────────────────────────────────┐
│              LEADER ACCEPTANCE GATE & COMMIT           │
│  • Soát diff độc lập (0 rò rỉ secret, 0 placeholder)   │
│  • Chạy 8-Layer Quality Shield (postfix-gate)          │
│  • Thực hiện Git Commit bằng tiếng Việt conventional   │
└────────────────────────────────────────────────────────┘
```

### Vai Trò 1: Leader Agent (Claude Code / PM & Architect)
- **Tư duy cấp cao:** Đọc hiểu tài liệu nghiệp vụ, viết Architecture Decision Records (ADR).
- **Phân tích tầm ảnh hưởng (Blast Radius):** Sử dụng `codebase-memory-mcp` để truy vết toàn bộ điểm gọi ngược (`trace_path inbound`).
- **Sinh Test Specification:** Định nghĩa rõ kịch bản kiểm thử mong đợi (đầu vào, đầu ra, ngoại lệ biên).
- **Không trực tiếp code các tác vụ phức tạp:** Giao việc cho Worker kèm theo các ràng buộc bất biến.

### Vai Trò 2: Worker Agent (Google Antigravity / Coder)
- **Hoạt động độc lập trong môi trường cách ly (Sandbox):**
  - Chính sách bất di bất dịch: `"commitPolicy": "forbid"`.
  - Tuyệt đối cấm tự ý `git commit`, `git push` hay tạo PR.
- **Kỷ luật Paired Executable Oracle:**
  - Bắt buộc tạo bài test RED chứng minh lỗi thật trước khi sửa code.
  - Sửa đổi phẫu thuật tối thiểu (Surgical Edits), bảo tồn 100% comment và docstring xung quanh.
- **Nộp Bằng chứng Nghiệm thu:**
  - Trích xuất `git diff`.
  - Xuất log chạy test `[x] PASS`.
  - Chụp ảnh minh chứng thực tế (Visual Acceptance Proof) có badge PASS rõ ràng.

---

## 3. Quy Trình Phối Hợp Thực Tế (Handover Protocol)

### Bước 1: Leader Phân Rã & Giao Việc (/giao)
Leader chuẩn bị task prompt chứa đầy đủ:
1. Mục tiêu nghiệp vụ & ranh giới tệp được phép sửa.
2. Danh sách bẫy mã nguồn cần tránh (tra cứu từ `.agents/instincts-index.md`).
3. Rào chắn bất biến: Không xóa guard condition cũ, không nuốt lỗi, debounce nút bấm $\ge 1000\text{ms}$.

### Bước 2: Worker Triển Khai Trong Sandbox
Worker thực hiện:
- Viết test failure (RED).
- Sửa code đúng điểm lỗi (GREEN).
- Chạy cổng kiểm toán `bin/post-fix-gate.py --dry-run`.
- Báo cáo kết quả bằng cấu trúc 4 mục súc tích kèm mã băm SHA-256 của ảnh chụp.

### Bước 3: Leader Kiểm Toán Độc Lập & Chốt Commit
Leader nhận báo cáo từ Worker:
1. Đọc lại `git diff` toàn diện (kiểm tra không lộ secret, không có placeholder lười biếng `// ... existing code ...`).
2. Chạy bộ kiểm toán `postfix-gate`.
3. Chỉ khi 100% tiêu chí đạt chuẩn mới tiến hành nghiệm thu và báo cáo Tech Lead.
