# 03 — Monorepo Governance Rules

## Folder Structure (Layout)
```
OfficeReader/
├── app/               # Main application module (UI, Navigation, DI wiring)
├── core/              # Shared core (data, domain, ui)
├── feature/           # Feature modules (each is one screen/flow)
│   ├── files/
│   ├── scanner/
│   ├── starred/
│   └── onboarding/
├── libs/              # Reusable libraries (no dependency on app/core)
│   ├── epub-reader/
│   ├── office-reader/
│   └── pdfium/
├── baselineprofile/
├── microbenchmark/
└── build-logic/       # Convention plugins
```

### ✅ Allowed Imports
- `app` → can import everything
- `feature/*` → can import `core/*`, `libs/*`
- `core/*` → can import `libs/*`
- `libs/*` → **NO** import from `app`, `core`, or `feature`

### ❌ Forbidden Imports
- `libs/*` → `app/*`, `core/*`, `feature/*`
- `core/data` → `feature/*` (circular dependency)
- Feature A → Feature B (must go through navigation, not direct import)

## Code Ownership
- `libs/` code is **shared** — changes affect the entire project → requires PR + review.
- `feature/` code is **feature-scoped** — only affects that screen.
- `core/` code is **shared core** — changes affect all features.
