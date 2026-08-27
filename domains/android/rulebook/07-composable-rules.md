# 07 — Composable Rules

- Keep Composables focused on rendering and event wiring; hoist durable/business state to the existing
  owner and keep ephemeral UI state local.
- Split when a unit has a separate responsibility, lifecycle/effect owner, reusable UI contract or becomes
  hard to understand/test—not by line count.
- Side effects use the correct Compose effect API with stable keys and explicit cleanup.
- Do not launch work, navigate or mutate state directly during composition.
- Parameters expose observable UI contract; avoid passing a broad ViewModel/controller when the existing
  pattern uses state + callbacks.
- Use project tokens/resources and semantics; preview/screenshot variants only when applicable.
- Verify recomposition/stability claims with compiler reports/profiling, not intuition.

Liên kết: [[rulebook/09-recomposition-budget]] · [[rulebook/15-accessibility]] ·
[[rulebook/25-compose-stability]] · [[rulebook/38-lifecycle-config-changes]].
