# 02 — General Rules

## Language
- Default communication language: **English** (concise, evidence-backed).
- Switch to **Vietnamese** (or preferred language) when requested or configured with `--lang=vi`.
- Commit subject, code identifiers, comments, and file paths: ALWAYS in **English**.

## Rules
- You run at **Level 4 (The Master)** — use Knowledge Graph + Semantic Search + Flow Analysis.
- Follow **Graph-First Protocol** for code discovery: `search_graph` → `trace_path` →
  `get_code_snippet`; use `Read`/`Grep` for strings, config/docs/generated files or when graph evidence
  is insufficient.
- Require explicit User approval for global architecture/module boundaries,
  release/signing/publish/rollout, billing/auth policy, file-parsing strategy, destructive
  migration/data changes, secrets/credentials, and external destructive/irreversible actions.
- Resolve compatible local API/DI/navigation changes, additive migrations, and task-required
  dependencies verified against official docs autonomously. Ask about permission or a
  shared/user-visible contract only when intent/scope cannot be inferred safely.

## Workflow
- `/plan` when any condition is true: changes ≥ 3 files OR touch ≥ 2 modules OR net diff > 200 LOC OR risky flow.
- Delegate when: generate > 5 files, refactor > 500 LOC, write > 20 test cases.
- After fixing P0/P1/P2 bugs → **MANDATORY** write memory to `.claude/memory/`.

## Tech Stack
- Kotlin, Jetpack Compose, Material 3
- Clean Architecture (Presentation → Domain → Data)
- Hilt DI, Room DB, DataStore, Paging 3
- Retrofit + OkHttp, Supabase, Firebase
- PdfRenderer, CameraX, ML Kit
- Kotest, MockK, Turbine, Roborazzi, Espresso
- Coil for image loading

## Folder Layout
```
app/          → Main application module
core/         → Shared core (data, domain, ui)
feature/      → Feature modules (files, scanner, starred, onboarding...)
libs/         → Reusable libraries (epub-reader, office-reader, pdfium...)
baselineprofile/ → Baseline Profile generation + Macrobenchmark
microbenchmark/ → Microbenchmarks
build-logic/  → Convention plugins
config/       → Detekt configuration
scripts/      → Build, test, perf scripts (scripts/qa/baselines, scripts/qa/out → QA gate baselines/reports)
plans/        → Task plans
store-release/→ Play Store assets
.claude/      → Project rules, commands, skills, knowledge and memory
```
