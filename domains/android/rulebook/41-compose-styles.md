# 41 — Compose Styles API (Future Track)

## Overview
Compose 1.8+ introduces `Styles` API — a unified styling system that replaces inline modifiers for consistent theming. Currently in **beta** — tracked but **NOT** applied in App yet.

## Timeline
- **beta01**: Released with Compose 1.8.0-beta01.
- **Stable**: Expected Compose 1.8.x (mid-late 2025).
- **App adoption**: After stable release + migration plan.

## Why Track?
- `Styles` will replace: `Modifier.background()`, `Modifier.border()`, `Modifier.padding()` for themed components.
- Single source of truth for component styling.
- Better Compose compiler optimization (less modifier chain allocation).

## Why NOT Use Yet?
- Beta API — breaking changes possible.
- Migration cost not yet justified.
- Current `AppColors` + `MaterialTheme` system works well.

## Notable Changes in beta01
- `Style` composable wrapper.
- `TextStyle`, `ContainerStyle`, `BorderStyle` definitions.
- Auto-merge of parent→child styles.

## Migration Plan
1. Wait for stable release.
2. Audit current component tree for styling patterns.
3. Create `AppStyles.kt` definitions.
4. Migrate base components first (`AppButton`, `AppCard`).
5. Migrate feature components.
6. Remove inline modifier chains.

## When to Activate This Rule?
- When Compose `Styles` API reaches **stable**.
- After team review and approval of migration plan.
- NOT during critical release cycles.

## Reference
- [Compose Styles API docs](https://developer.android.com/develop/ui/compose/layouts/styles)
- [Issue tracker](https://issuetracker.google.com/issues?q=componentid:612128%20styles)
