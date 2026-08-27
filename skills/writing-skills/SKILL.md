---
name: writing-skills
description: Dùng khi tạo, sửa hoặc audit skill trong .Codex/skills của OfficeReader. Bỏ qua khi chỉ sử dụng skill hoặc sửa typo không đổi contract.
---

# Writing Skills

## Nguồn schema

`.Codex/skills` chạy trong Codex, vì vậy schema/documentation Codex là authoritative.
Không áp validator của Codex một cách máy móc lên Codex-only fields. `disable-model-invocation: true`
là hợp lệ và cần cho skill chỉ User được gọi như `session-handoff`.

## Viết tối thiểu

- `description` chỉ nêu trigger “Dùng khi/Bỏ qua khi”; không tóm tắt workflow.
- Trang `SKILL.md` mục tiêu dưới khoảng 500 từ. Trỏ tới command/rulebook/knowledge canonical thay vì
  sao chép policy hoặc ví dụ dài.
- Một skill giải quyết một failure mode/output shape rõ. Không tạo skill nếu command/rule đã đủ.
- Discipline failure: prohibition ngắn + consequence/evidence. Output-shape failure: recipe tích cực.
- Không thêm metric, threshold, API/tool field hoặc project fact chưa verify.

## Test thay đổi behavior

1. Mô tả scenario skill phải đổi hành vi và failure/rationalization hiện tại.
2. Viết wording nhỏ nhất chặn failure; không bắt buộc spawn subagent nếu harness/policy không cho phép.
3. Chạy lại scenario hoặc audit fixture/command hiện có; kiểm bằng tay output quan trọng.
4. Rút bỏ phần không ảnh hưởng behavior.

## Validation

- Frontmatter parse được, `name` khớp folder, field thuộc schema Codex và kiểu dữ liệu đúng.
- Mọi `@path`, wiki-link, command, rulebook, knowledge/memory path tồn tại.
- Markdown fence cân bằng; không chứa secret/PII hoặc path máy cá nhân.
- Skill không mâu thuẫn `AGENTS.md`, `AGENTS.md`, command/rule canonical và không tự tạo approval gate.
- User-only skill giữ `disable-model-invocation: true`; autonomous skill không dùng field này ngoài ý định.

Liên kết: [[spec-driven-development]] · [[tdd-workflow]].
