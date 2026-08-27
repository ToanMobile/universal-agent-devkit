# 99 — Inter-Module Glue Rules (Hilt & Navigation)

## 1. Dependency Injection (Hilt)
- Each module provides its dependencies via Hilt `@Module`.
- Feature modules expose `api` dependencies, `impl` modules provide the implementation.
- `core/` modules provide shared dependencies (Database, DataStore, Analytics).
- `app/` module wires everything at Application level.

## 2. Navigation
- Cross-feature navigation via `Navigator` interface (not direct feature→feature imports).
- Each feature exposes its routes as a `sealed class`.
- Navigation graph assembled in `app/` module.
- Deep links defined in each feature, assembled centrally.

## 3. Build Performance
- Feature modules are `implementation` in app module → isolated compilation.
- `core/` modules exposed as `api` to feature modules.
- Convention plugins in `build-logic/` for shared build config.
- Gradle build cache enabled globally.
