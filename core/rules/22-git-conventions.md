# 22 — Git Conventions

## Commit Message Format
```
<type>(<scope>): <subject in English>

<body in English (or Vietnamese if project-configured) explaining WHY>
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

## Pre-commit & Review Workflow

### 1. Quyền hạn & Bảo mật trước khi commit
- Chỉ thực hiện commit, push hoặc mở PR khi người dùng YÊU CẦU tường minh.
- Tuyệt đối KHÔNG bao giờ commit các file bí mật, credentials hoặc file cấu hình cục bộ (`keystore.properties`, `*.keystore`, `.env`, `local.properties`, `google-services.json`).

### 2. Self review + QA trước khi tạo commit
- Đọc lại toàn bộ diff (`git diff origin/main...HEAD`), tự soát: đúng SDD/BRD, không lộ bí mật, không phá DEMO/LIVE, có ghi audit ở nghiệp vụ mới.
- Chạy thử tính năng end-to-end trên môi trường dev (UI hoặc API) với cả DEMO lẫn LIVE nếu tính năng có liên quan. Có lỗi thì sửa xong mới sang bước 3.

### 3. Screenshot minh hoạ
- Chụp màn hình các tính năng đã làm / đã verify: màn UI trước–sau, kết quả API, log test pass… Đủ để người review hiểu tính năng mà không cần chạy lại.

## Other Rules
- **Never commit**: `*.keystore`, `google-services.json`, `.env`, `local.properties`.
- Rebase before merge (no merge commits).
- Squash commits for feature branches.
