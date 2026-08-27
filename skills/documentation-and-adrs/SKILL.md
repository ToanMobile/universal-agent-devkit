---
name: documentation-and-adrs
description: Dùng khi quyết định kiến trúc, chọn dependency/pattern/data model, đổi public API hoặc cần lưu why/trade-off lâu dài. Bỏ qua thay đổi tầm thường và fact đã suy ra được từ code/git.
---

# Documentation & ADRs cho Target Project / Codebase

> **Nguồn gốc:** Adapted từ `addyosmani/agent-skills` (port-lite: chỉ ADR template + lifecycle). Formalize cái memory system đang làm informal.
> **Nối infra:** codebase-memory-mcp `manage_adr` (ADR store) + `.Codex/memory/` + `.Codex/knowledge/`.
> **Liên kết:** AGENTS.md W4 (Self-Improving Memory) · [[deep-module-design]] · [[deprecation-migration]]

---

## Khi nào ghi ADR
Quyết định **đắt để đảo ngược**: chọn framework/dep, data model (Room schema), auth model (Supabase), kiến trúc API/module boundary, engine parse, threading model. KHÔNG ADR cho quyết định tầm thường.

## ADR template

```markdown
# ADR-<số>: <tiêu đề quyết định>
- **Status:** PROPOSED | ACCEPTED | SUPERSEDED-by-ADR-N | DEPRECATED
- **Date:** <YYYY-MM-DD tuyệt đối>

## Context
<vấn đề, ràng buộc, lực đẩy>

## Decision
<chọn gì>

## Alternatives Considered   ← field quan trọng nhất
- **<Cách B>** — pros / cons / **tại sao BỎ**
- **<Cách C>** — pros / cons / **tại sao BỎ**

## Consequences
<được gì, mất gì, đánh đổi>
```

> **"Alternatives Considered → tại sao bỏ"** là bản ghi chống-re-litigate: memory project đã có dạng informal ("DON'T re-attempt windowed-BIFF", "DON'T build windowed XLSX read"). ADR biến chúng thành record first-class có lý do.

## Lifecycle: SUPERSEDE, đừng DELETE
- Quyết định cũ sai/lỗi thời → tạo ADR MỚI `Status: ACCEPTED` tham chiếu ADR cũ; đổi ADR cũ thành `SUPERSEDED-by-ADR-N`.
- **KHÔNG xóa ADR cũ** — mất lịch sử "tại sao từng làm vậy" → agent sau re-decide lại.
- Nơi lưu: `manage_adr` MCP (canonical) + pointer 1 dòng trong memory nếu là gotcha hay tái phạm.

## Comment code: WHY không WHAT
- Comment giải thích **tại sao**, không mô tả lại code làm gì.
- Gotcha inline → link tới ADR/memory.
- "TODO nên làm luôn được → làm luôn." Xóa code comment-out (B3).

## Docs cho agent
AGENTS.md + spec + ADR + gotcha inline tồn tại để **agent không phải re-decide**. Trước khi quyết lại một thứ lớn → grep ADR/memory xem đã có chưa.
