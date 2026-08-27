# 39 — Compose Animations

- Use Material/project motion tokens and existing component pattern; do not introduce per-screen arbitrary
  duration/easing constants.
- Animation state has one owner and stable keys; cancellation/navigation/config change must not leave
  stale state or duplicate side effects.
- Avoid animating layout/bitmap/native work when a cheaper transform satisfies the same UX.
- Respect reduced-motion/accessibility behavior supported by current platform/design contract.
- Test observable end state and interruption, not exact internal clock unless timing itself is contract.
- Profile jank on representative device/build before optimizing; duration/frame budget must come from design
  token, User acceptance or measurement gate.

Liên kết: [[rulebook/09-recomposition-budget]] · [[rulebook/15-accessibility]] ·
[[rulebook/38-lifecycle-config-changes]].
