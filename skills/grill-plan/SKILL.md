---
name: grill-plan
description: Dùng khi User yêu cầu grill/phản biện plan, plan còn ambiguity blocking hoặc thay đổi kiến trúc rủi ro cao cần stress-test trước code. Bỏ qua khi task đã rõ hoặc User muốn thực thi ngay.
---

# Grill Plan

## Tách FACT khỏi DECISION

- **FACT:** tự điều tra, không hỏi User. Code discovery dùng `search_graph` → `trace_path` →
  `get_code_snippet`; Read/Grep chỉ cho literal/config/docs/generated hoặc khi graph thiếu evidence.
- **LOCAL DECISION:** reversible, trong scope, không cần authority mới → tự chọn quality-first và ghi
  evidence/trade-off.
- **BLOCKING DECISION:** chỉ hỏi khi evidence không thể phân thắng bại và lựa chọn đổi đáng kể
  user-visible behavior/data/release outcome, hoặc cần authority theo `AGENTS.md`/`AGENTS.md`.

## Cadence

1. Lập cây các decision thật, không đưa fact tra được vào cây hỏi.
2. Resolve fact và local decision trước; chỉ giữ blocker.
3. Hỏi tối đa 3 câu blocking mỗi batch/turn. Dùng question tool khi có, nếu không hỏi plain text.
4. Mỗi câu nêu evidence, trade-off và phương án đề xuất đầu tiên; không hỏi lại quyết định đã chốt.
5. Chỉ mở batch tiếp theo nếu câu trả lời làm lộ blocker mới.
6. Hết blocker thì bàn giao `/plan` tự tiếp tục; chỉ dừng ở plan nếu User yêu cầu plan-only.

Không có approval gate mặc định. Cùng blocker lặp hai vòng thì áp anti-loop và báo điều còn thiếu; không
bịa câu hỏi để kéo dài.

Output cuối gồm decision tự chốt, authority decision từ User, assumptions còn lại và tác động tới
spec/plan/tasks.

Liên kết: [[rulebook/23-ai-workflow]] · [[spec-driven-development]] · [[deep-module-design]].
