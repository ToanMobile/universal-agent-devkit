# 09 — Recomposition & Frame Performance

## Diagnose

Use Compose compiler reports, Layout Inspector/recomposition counters, Macrobenchmark/Perfetto and a
reproducible UI scenario. Do not assign frame-phase milliseconds or skippable percentages without a
current measured gate.

## Rules

- Keep state reads at the narrowest owner; derive values with `remember`/`derivedStateOf` only when
  profiling or expensive work justifies it.
- Stabilize data by contract, not by adding annotations blindly. Mutable collections inside an
  `@Immutable` type are invalid.
- Avoid allocation, sorting/filtering, formatting and object creation in hot composition/draw loops when
  evidence shows cost; precompute at the appropriate state owner.
- Effect keys and lambdas must not restart work unintentionally; use current Compose patterns verified from
  source/docs.
- Lazy list keys/content types must reflect stable item identity.

Verify before/after using the same device/build/scenario. A compiler report or unit test alone does not
prove jank is fixed.
