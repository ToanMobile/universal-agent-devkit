# 29 — Responsive Design

## Current contract

`AdaptiveDimensions.kt` delegates size class to the current window-info source. Its `scaleFactor` is
identity; tablets/foldables adapt by changing layout structure rather than globally scaling phone
dimensions. Verify current source before relying on symbol/API details.

## Rules

- Use project window-info/size-class abstraction and design tokens; do not branch on raw device model or
  “tablet” guess.
- Change navigation/pane/grid/content structure at meaningful layout breakpoints already defined by the
  project/platform; do not invent new breakpoints/scales without design requirement and tests.
- Preserve state/selection/focus across size/config changes; effects must not duplicate work on resize.
- Avoid fixed widths/heights that clip content. Test long/localized text, system/in-app font scale,
  portrait/landscape, inset/IME and multi-window only as applicable.
- Compact and expanded layouts must expose the same business actions unless product explicitly differs.
- Accessibility semantics/order remain logical when panes rearrange.

Verification uses Compose/UI/device/screenshot evidence matching the changed contract. A preview or
compile alone does not prove runtime resize/fold behavior.

Liên kết: [[rulebook/10-design-system]] · [[rulebook/15-accessibility]] ·
[[rulebook/38-lifecycle-config-changes]].
