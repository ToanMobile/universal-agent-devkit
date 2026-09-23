---
name: grill-plan
description: Dùng khi User yêu cầu grill/phản biện plan, plan còn ambiguity blocking hoặc thay đổi kiến trúc rủi ro cao cần stress-test trước code. Bỏ qua khi task đã rõ hoặc User muốn thực thi ngay.
---

# Grill Plan (Adversarial Plan Stress-Testing)

## Tách Rời FACT Khỏi DECISION

- **FACT:** Tự động điều tra từ codebase/graph, tuyệt đối KHÔNG hỏi User những gì đọc được từ code.
- **LOCAL DECISION:** Reversible, trong phạm vi cho phép → Tự chọn phương án tối ưu chất lượng và ghi nhận trade-off.
- **BLOCKING DECISION:** Chỉ hỏi khi bằng chứng kỹ thuật không thể phân định và ảnh hưởng lớn tới kiến trúc hoặc dữ liệu sản xuất.

## Quy Trình Phản Biện & Stress-Test

1. **Lập cây quyết định thật:** Bóc tách toàn bộ giả định ngầm của bản kế hoạch.
2. **Resolve fact trước:** Tra cứu codebase, đo đạc dữ liệu, loại bỏ các giả định sai.
3. **Phản biện tối đa 3 câu hỏi blocking mỗi turn:** Mỗi câu nêu rõ bằng chứng (evidence), đánh đổi (trade-off) và phương án đề xuất cụ thể.
4. **Không hỏi kéo dài vô nghĩa:** Sau khi gỡ bỏ blocker, lập tức chuyển giao sang thực thi.
