---
name: incremental-implementation
description: Dùng khi implement feature/thay đổi nhiều file hoặc task khó verify trong một bước. Bỏ qua edit local đã rõ và config không có logic.
---

# Incremental Implementation cho Target Project / Codebase

> **Nguồn gốc:** Adapted từ `addyosmani/agent-skills` — operationalize AGENTS.md B2 (Simplicity) + B3 (Surgical) thành vòng lặp.
> **Liên kết:** AGENTS.md B2 · B3 · B7 (Checkpoint) · [[deep-module-design]] · [[tdd-workflow]] · Gate 4b (ktlint)

---

## Vòng lặp increment
`Implement → Test → Verify → Atomic checkpoint → lát kế` — mang kết quả tiến lên, KHÔNG restart từ đầu mỗi lát. Checkpoint là diff đã verify trong working tree, không phải Git commit.

## 3 chiến lược cắt lát

| Chiến lược | Khi dùng | Target Project / Codebase |
| :-- | :-- | :-- |
| **Vertical** (mặc định) | Mỗi lát = 1 đường xuyên full-stack chạy end-to-end | 1 format mở được (parse→VM→render) trước, rồi format kế |
| **Contract-First** | Nhiều bên làm song song | Chốt interface `FileHandler`/UseCase trước, VM & Repo bám vào |
| **Risk-First** | Có chỗ bất định/rủi ro cao | **Prove lát decode rủi ro NHẤT trên device trước khi build UI** (đúng bài học pptx-extreme-deck / XLS-windowed) |

## Rule 0-5
0. **Simplicity-first** — 3 dòng na ná nhau THẮNG một abstraction non (B2). Đừng trừu tượng khi mới 1 call-site.
1. **Scope-discipline** — thấy chỗ khác cần sửa → ghi **"NOTICED BUT NOT TOUCHING: <x>"** vào backlog/evidence. Không hỏi User trừ khi nó block acceptance hiện tại hoặc cần authority mới; KHÔNG tự sửa lan (B3).
2. **One-thing-per-checkpoint** — 1 lát = 1 diff/checkpoint logic; delete và replace tách checkpoint riêng. Không `git commit`, push hoặc tạo PR nếu User chưa yêu cầu rõ.
3. **Keep-it-compilable giữa các lát** — mỗi lát xong `assembleDebug` phải xanh; feature chưa xong → sau feature-flag.
4. **Safe-defaults** — code mới off/an toàn mặc định.
5. **Rollback-friendly** — additive dễ revert; tách delete khỏi add.

## Red flag
- Một slice đã chứa nhiều behavior/failure mechanism mà chưa có checkpoint evidence → dừng, cắt nhỏ hơn.
- Nhưng ĐỪNG chạy lại build/test không đổi "cho chắc" — lãng phí (xem [[verification-before-completion]] để biết khi nào verify là cần thật).
