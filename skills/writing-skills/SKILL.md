---
name: writing-skills
description: Dùng khi tạo, sửa hoặc audit skill trong thư mục skills/ của dự án. Bỏ qua khi chỉ sử dụng skill hoặc sửa typo không đổi contract.
---

# Writing Skills (Chuẩn Hóa Kỹ Năng Cho Agent)

## Cấu Trúc Bắt Buộc Của Một Skill

Mỗi skill là một thư mục nằm trong `skills/<skill-name>/` chứa tệp `SKILL.md` mở đầu bằng YAML frontmatter chuẩn:

```markdown
---
name: <kebab-case-name>
description: Dùng khi <ngữ cảnh kích hoạt rõ ràng>. Bỏ qua khi <trường hợp không cần thiết>.
---
```

## Nguyên Tắc Soạn Thảo

1. **Trigger Ngắn Gọn & Chính Xác:** Trường `description` chỉ nêu rõ điều kiện kích hoạt và ranh giới loại trừ; không tóm tắt lại toàn bộ các bước thực hiện.
2. **Dung Lượng Tinh Gọn:** Giữ nội dung `SKILL.md` cô đọng dưới 500 từ. Trỏ tới các rules hoặc templates có sẵn thay vì sao chép trùng lặp.
3. **Một Mục Tiêu Cụ Thể:** Mỗi skill giải quyết một bài toán hoặc một failure mode rõ ràng.
4. **Không Thêu Dệt:** Không bịa đặt tham số công cụ hoặc đường dẫn tệp không tồn tại trong dự án.

## Checklist Kiểm Định (Skill Validation)

- [ ] YAML Frontmatter hợp lệ, trường `name` trùng khớp với tên thư mục.
- [ ] Mọi đường dẫn tham chiếu trong tệp đều tồn tại thật.
- [ ] Không chứa thông tin nhạy cảm, token, secret hoặc đường dẫn cục bộ cá nhân.
- [ ] Không mâu thuẫn với các quy tắc cốt lõi trong `rules/core-rules.md`.
