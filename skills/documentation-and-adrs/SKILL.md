---
name: documentation-and-adrs
description: Dùng khi quyết định kiến trúc, chọn dependency/pattern/data model, đổi public API hoặc cần lưu why/trade-off lâu dài. Bỏ qua thay đổi tầm thường và fact đã suy ra được từ code/git.
---

# Documentation & Architecture Decision Records (ADR)

## Khi Nào Cần Ghi ADR

Ghi lại các quyết định **đắt giá và khó đảo ngược**: Chọn database/framework, thay đổi data model/schema, kiến trúc phân tán, engine đồ họa/xử lý âm thanh, threading model, mô hình bảo mật. KHÔNG ghi ADR cho các quyết định tầm thường.

## Cấu Trúc Bản Ghi ADR Chuẩn

```markdown
# ADR-<số>: <Tiêu đề quyết định>
- **Status:** PROPOSED | ACCEPTED | SUPERSEDED-by-ADR-N | DEPRECATED
- **Date:** <YYYY-MM-DD>

## Context (Bối cảnh & Ràng buộc)
<Vấn đề cần giải quyết, các ràng buộc kỹ thuật và tài nguyên>

## Decision (Quyết định lựa chọn)
<Công nghệ, mô hình hoặc kiến trúc được chọn>

## Alternatives Considered (Các phương án thay thế đã cân nhắc)
- **Phương án B:** Ưu điểm / Nhược điểm / **Tại sao từ chối**
- **Phương án C:** Ưu điểm / Nhược điểm / **Tại sao từ chối**

## Consequences (Hệ quả & Đánh đổi)
<Những lợi ích đạt được và các chi phí/rủi ro phải đánh đổi>
```

## Vòng Đời ADR: SUPERSEDE, Không Xóa

- Khi quyết định cũ không còn phù hợp: Tạo ADR mới ghi rõ `Status: ACCEPTED` tham chiếu ADR cũ; cập nhật ADR cũ thành `SUPERSEDED-by-ADR-N`.
- **Tuyệt đối KHÔNG xóa ADR cũ:** Xóa ADR sẽ làm mất lịch sử lý do tại sao từng làm vậy, dẫn tới việc các kỹ sư hoặc AI sau này đi vào vết xe đổ.

## Nguyên Tắc Comment Code: WHY, Not WHAT

- Comment giải thích **TẠI SAO** (ngữ cảnh, trade-off, bẫy mã nguồn), không mô tả lại điều code đang làm rõ ràng.
- Gắn liên kết tới ADR tương ứng khi có logic phức tạp hoặc gotcha.
