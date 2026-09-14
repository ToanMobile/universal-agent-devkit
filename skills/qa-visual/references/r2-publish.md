# Upload R2 và đính vào PR

Load file này khi upload ảnh, đặt key, hoặc đưa report vào PR.

## Thứ tự

```
capture-screens.mjs  →  .qa-screenshots/capture-manifest.json
        ↓
upload-r2.mjs        →  .qa-screenshots/upload-manifest.json   (local path -> public URL)
        ↓
attach-to-pr.mjs     →  comment vào PR, HOẶC ghi <reportDir>/qa-visual-pr-body.md
```

`render-report-markdown.mjs` gọi được riêng (`--out <file>`) nếu chỉ muốn lấy markdown.

## Điều kiện

`.env`: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. `qa.config.json` mục `r2`: `endpoint`, `bucket`, `publicBaseUrl`.

Ký bằng SigV4 thuần `node:crypto` (`sigv4.mjs`), **không dùng wrangler** — wrangler cần bộ credential khác, phải tải binary, và chậm vì `npx` resolve mỗi lần. R2 dùng `region = "auto"`, service `s3`, URL path-style.

## Key schema

```
<repo>/<branch-slug>/<short-sha>/<route>-<viewport>.png
```

**Không có PR number trong key.** Chạy `qa-visual` *trước* `gh pr create` là hợp lệ — lúc đó chưa có PR number. Branch + sha thì luôn tồn tại.

`sha` khiến chạy lại trên commit khác sinh key khác, nên **ảnh đã đính vào PR không bao giờ bị ghi đè**. Đổi lại: mỗi commit là một bộ ảnh mới, dung lượng tích tụ — xem mục dọn dẹp.

## Bucket là PUBLIC

`upload-r2.mjs` in cảnh báo và **chờ gõ `yes`** trước mỗi lần upload. `--yes` bỏ qua bước hỏi; không có terminal (CI) mà thiếu `--yes` thì script **từ chối chạy**, không tự cho qua.

- Ảnh đọc được bởi bất kỳ ai có URL. Không có auth, không hết hạn.
- `sha` trong key làm URL khó đoán — **đó không phải bảo mật**, đừng trình bày như vậy.
- Chỉ chạy trên local/dev/staging với dữ liệu giả. Không chạy trên production.
- Ảnh đã lên thì coi như công khai vĩnh viễn, kể cả sau khi xoá khỏi bucket (có thể đã bị cache/crawl).

Nếu team quyết định không chấp nhận rủi ro này: đổi sang bucket private + presigned URL (hết hạn ~7 ngày) — và chấp nhận ảnh trong PR cũ sẽ chết sau đó.

## Đính vào PR

| Tình huống | Hành vi |
|---|---|
| Có PR mở cho branch | `gh pr comment <n> --body-file` |
| Chưa có PR | ghi `<reportDir>/qa-visual-pr-body.md`, in lệnh `gh pr create --body-file ...` |
| `--pr <n>` | ép comment vào PR đó |
| `--dry` | chỉ in markdown ra stdout |

Markdown **luôn được ghi ra file** trước khi thử comment — comment fail thì vẫn còn bản để dán tay.

Ảnh gói trong `<details>`: 10 route × 2 viewport là 20 ảnh, để trần thì PR ngập không đọc được.

Chưa chạy `audit-layout` thì report vẫn ra, chỉ có ảnh, không có bảng finding — và nói rõ điều đó.

## Xoay credential

Key R2 sinh ở Cloudflare dashboard → R2 → Manage API Tokens. Giới hạn scope **đúng một bucket**, quyền Object Read & Write. Xoay: tạo key mới → sửa `.env` → xoá key cũ trên dashboard.

`.env` đã nằm trong `.gitignore` do `install.sh` ghi vào. Không bao giờ commit. Script không log giá trị credential và không log header `Authorization`.

## Dọn ảnh cũ

R1 **không tự xoá**. Mỗi commit × mỗi lần chạy để lại một bộ ảnh.

Cách gọn nhất: đặt **lifecycle rule** trên bucket (Cloudflare dashboard → R2 → bucket → Settings → Object lifecycle), xoá object cũ hơn 30–90 ngày. Đặt một lần, không phải viết code.

Xoá tay một prefix: dùng S3 API `DELETE` với cùng `sigv4.mjs`, hoặc `rclone`/`aws s3 rm` trỏ vào endpoint R2.

## Khi có lỗi

| Triệu chứng | Nguyên nhân |
|---|---|
| `HTTP 403 SignatureDoesNotMatch` | sai `R2_SECRET_ACCESS_KEY`, hoặc lệch giờ hệ thống >15 phút |
| `HTTP 403 AccessDenied` | key không có quyền trên bucket này |
| PUT 200 nhưng GET public 404 | `publicBaseUrl` trỏ sai bucket — kiểm bằng cách PUT 1 file nhỏ rồi `curl` ẩn danh |
| Ảnh không hiện trên GitHub | GitHub proxy ảnh qua camo; URL phải là https và đọc được ẩn danh |
