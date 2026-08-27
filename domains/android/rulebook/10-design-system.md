# 10 — Design System

## Source of truth

Resolve current tokens/components from `core/design-system` source. Do not copy token inventories,
scaling factors or component APIs into this rulebook.

## Rules

- Use semantic project color/spacing/typography/radius/icon tokens and existing components before adding
  local constants.
- User-visible text uses string resources; icons/images use the established resource pipeline.
- A new token/component requires real reuse or a shared invariant; one-screen styling stays local when
  that matches current patterns.
- Do not hardcode colors/dimensions to bypass dark theme, font scale or adaptive layout.
- `AdaptiveDimensions.scaleFactor` is currently identity; responsive behavior comes from layout structure
  and current window-info source, not magnifying a phone layout. Re-verify source before changing this
  statement.
- Preview/screenshot variants are selected by acceptance/risk, not a mandatory matrix.
- Accessibility requirements come from [[rulebook/15-accessibility]] and current design/product source.

When changing shared tokens/components, trace all consumers and verify representative light/dark,
font-scale and size-class behavior. Public shared contract/module change follows authority rules.
