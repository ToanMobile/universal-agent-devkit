# 08 — Code Organization & DRY

- Organize by existing module/package ownership and dependency direction; do not move code for aesthetics.
- Split a function/class/file when it owns multiple responsibilities, independent lifecycle/state, or a
  contract that changes for different reasons—not at arbitrary line/parameter counts.
- Prefer three clear local statements over a one-use abstraction. Extract only when it improves a real
  seam, reuse, testability or invariant locality.
- Do not merge similar-looking behavior with different contracts. If patterns conflict, choose the
  newer/better-tested one and explain.
- Public API, DI/navigation contract and module move require graph blast-radius analysis and authority
  where canonical rules require it.
- Remove orphan created by the task; report unrelated dead code without deleting it.

Liên kết: [[rulebook/05-architecture]] · [[deep-module-design]].
