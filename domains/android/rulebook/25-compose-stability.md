# 25 — Compose Stability

- Treat stability annotations as contracts, not performance decorations.
- `@Immutable` requires deeply immutable observable state; do not annotate mutable collections/objects to
  silence compiler reports.
- `@Stable` requires observable mutations to notify Compose and stable equality/contract behavior.
- Prefer immutable state models and persistent/immutable collections where current module pattern supports
  them; do not add dependency/convert broadly without need.
- Lambdas/callback holders and remembered objects must have lifecycle/key ownership clear.
- Verify a stability/recomposition problem with compiler reports/profiling and a scenario. Do not enforce
  generic skippable/restartable percentages.
- After change, compare the same report/scenario; compile success alone does not prove fewer recompositions.

Liên kết: [[rulebook/09-recomposition-budget]] · [[rulebook/07-composable-rules]].
