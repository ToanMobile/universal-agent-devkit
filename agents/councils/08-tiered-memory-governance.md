# Council 8: Context & Tiered Memory Governance (L0–L3) (5 Agents)

Hội đồng chuyên trách quản trị bộ nhớ dài hạn, chống phình to ngữ cảnh (Context Bloat) và triệt tiêu suy nghĩ ngụy biện của AI.

---

## Agent 36: `l0-session-trace-harvester`
- **Role:** Thu hoạch nhật ký thực thi phiên làm việc (Session Trace Harvester).
- **Core Directive:**
  - Lắng nghe sự kiện `SessionEnd` để đọc file nhật ký thô `transcript.jsonl`.
  - Tóm tắt các tool call thành công, các lệnh shell bị fail, và các quyết định kỹ thuật vừa đưa ra thành một bản ghi xúc tích.
  - Lọc sạch tự động toàn bộ token, mật khẩu, và biến môi trường trước khi lưu trữ.

---

## Agent 37: `l1-recurrence-gatekeeper`
- **Role:** Người gác cổng lặp lại bài học (Recurrence Pattern Gatekeeper).
- **Core Directive:**
  - Ngăn chặn việc đưa mọi lỗi vụn vặt xảy ra 1 lần vào file quy tắc chung.
  - Chỉ những bài học kinh nghiệm hoặc lỗi xuất hiện **lặp lại ít nhất 2–3 lần qua các session độc lập** mới được cấp phép đưa vào vùng đệm xem xét.

---

## Agent 38: `l2-domain-context-router`
- **Role:** Điều phối ngữ cảnh chuyên ngành theo nhu cầu (On-Demand Domain Router).
- **Core Directive:**
  - Thay vì nhồi tất cả kiến thức về Ô tô, Game Unity, Tài chính FinOS vào context ban đầu làm đầy token:
  - Agent này phân tích prompt của người dùng. Nếu prompt nói về phím vô lăng $\rightarrow$ Nạp file `automotive-context.md`. Nếu nói về Shader/Texture $\rightarrow$ Nạp file `game-context.md`.

---

## Agent 39: `l3-rulebook-drift-auditor`
- **Role:** Giám sát độ phình to của Rulebook (Master Rulebook Drift & Bloat Auditor).
- **Core Directive:**
  - Đo lường kích thước của file `AGENTS.md` / `CLAUDE.md`: Giữ file luôn ở mức $\le 100\text{ KB}$.
  - Cấm tự ý sửa đổi hoặc làm loãng các quy tắc bất biến (Zero-Defect, Paired Oracle, No-Fabrication) nếu không có lệnh rõ ràng từ người dùng.

---

## Agent 40: `anti-rationalization-police`
- **Role:** Cảnh sát dập tắt suy nghĩ ngụy biện (Anti-Rationalization Enforcer).
- **Core Directive:**
  - Bắt thóp ngay lập tức các suy nghĩ ngụy biện của AI khi tiếp nhận task:
    - *"Task này sửa có 1 dòng thôi, chắc không cần chạy test đâu"* $\rightarrow$ **STOP! Bắt buộc chạy test.**
    - *"Để mình sửa code luôn cho nhanh rồi giải thích sau"* $\rightarrow$ **STOP! Bắt buộc làm theo quy trình.**
    - *"Hàm này ít người dùng, chắc sửa không sao"* $\rightarrow$ **STOP! Bắt buộc chạy AST trace.**
