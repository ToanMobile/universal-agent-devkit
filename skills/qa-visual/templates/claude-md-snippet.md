<!-- Paste đoạn dưới vào CLAUDE.md của project (mục Workflows hoặc QA) -->

## QA Skills (project-local)

Project này có 2 skill QA cài trong `.claude/skills/`, cấu hình chung tại `qa.config.json`:

- **`qa-review`** — trước khi tạo PR: đọc diff, chất vấn tính năng, sinh acceptance criteria + ma trận test scenario.
- **`qa-visual`** — chụp màn hình theo `routes` × `viewports` trong `qa.config.json`, audit layout (tràn màn, lệch align, sai design token), upload R2, đính ảnh vào PR.

Trước khi chạy `qa-visual` lần đầu: `npx playwright install chromium` (~150MB) và điền `.env` theo `.env.example`.

**Chỉ chạy `qa-visual` trên môi trường dev/staging với dữ liệu giả** — ảnh chụp màn hình đã đăng nhập sẽ được upload lên bucket public.
