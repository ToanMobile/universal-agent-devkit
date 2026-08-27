---
name: deprecation-migration
description: Dùng khi thay implementation, sunset API/feature/handler, xóa code cũ hoặc quyết định giữ hay migrate consumer. Bỏ qua feature mới thuần và local edit không đụng migration.
---

# Deprecation & Migration

## Gate quyết định

1. Tìm mọi consumer bằng graph-first (`search_graph` → inbound `trace_path` → source snippet); fallback
   reference search khi graph thiếu evidence.
2. Xác nhận replacement đã tồn tại và được verify trên behavior/fixture liên quan.
3. Xác định migration advisory hay bắt buộc, compatibility/user-visible impact và owner.
4. Đánh giá rollback/data risk. Destructive migration/data change, file-parsing strategy, module
   boundary hoặc rollout/release change phải xin authority theo `AGENTS.md`.

Không dùng số ngày, traffic %, age hay “zero usage” tùy ý. Threshold phải từ User, telemetry thật hoặc
gate/rollout policy đã có.

## Quy trình

1. Đặt replacement sau seam hiện có khi có thể; không tạo abstraction chỉ cho một consumer.
2. Migrate consumer theo dependency order, giữ compatibility adapter/flag chỉ khi có rollback hoặc
   coexistence need thật.
3. Test behavior của old/new state khi cả hai còn hoạt động; verify representative file/data và failure
   path, không chỉ compile.
4. Chỉ xóa old path khi graph + fallback search không còn consumer ngoài phạm vi đã chấp nhận và
   evidence rollout/telemetry đáp ứng threshold thật.
5. Xóa flag/adapter/docs/test obsolete trong cùng task khi chúng trở thành orphan; không xóa dead code
   không liên quan.

Trước khi thử lại hướng từng bị revert, đọc `.Codex/memory/INDEX.md` và memory liên quan, rồi re-verify
với code/docs hiện tại. Memory là cảnh báo, không phải bằng chứng runtime hiện tại.

Bàn giao gồm consumer đã migrate, compatibility còn lại, rollback path, checks đã chạy và residual.

Liên kết: [[rulebook/05-architecture]] · [[deep-module-design]] · [[graph-navigation]] · `.Codex/memory/bug_large_xlsx_rejected_by_memory_guard.md` · `.Codex/memory/bug_xlsx_open_oom_teardown_symptom.md`.
