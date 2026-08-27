# 22 — Git Conventions

## Commit Message Format
```
<type>(<scope>): <subject in English>

<body in Vietnamese explaining WHY>
```

### Types
| Type | Description |
|:---|:---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `docs` | Documentation change |
| `chore` | Build, CI, dependencies |
| `style` | Formatting (no logic change) |

### Scope (use folder name)
- `app`, `core`, `feature/files`, `libs/pdfium`, etc.

## Branch Naming
```
feat/<scope>-<desc>
fix/<scope>-<desc>
refactor/<scope>-<desc>
perf/<scope>-<desc>
test/<scope>-<desc>
docs/<scope>-<desc>
chore/<scope>-<desc>
```

## PR Guidelines
- Summary in Vietnamese.
- Test plan (what was tested, how).
- Screenshots (before/after for UI changes).
- Rule 6 Audit Report (build, test, runtime, static analysis, master review, edge cases).

## Other Rules
- **Never commit**: `*.keystore`, `google-services.json`, `.env`, `local.properties`.
- Rebase before merge (no merge commits).
- Squash commits for feature branches.
