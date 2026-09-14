---
name: qa-visual
description: Chụp màn hình và audit layout cho project có qa.config.json. Dùng khi cần capture các route × viewport khai trong qa.config.json, tự đăng nhập bằng form login của app để chụp được màn sau login, dò lỗi bố cục đo trên DOM (tràn khung, lệch align, chồng lấp, chạm cạnh màn hình), suy design token từ CSS thực tế, upload ảnh lên Cloudflare R2 và đính vào PR. Kích hoạt khi người dùng nói "chụp màn", "screenshot các trang", "audit layout", "check giao diện", "UI có lệch không", "đính ảnh vào PR".
---

# qa-visual

Chụp màn hình + audit layout **đo bằng DOM, không đoán bằng LLM**. Mọi thứ stack-specific nằm trong `qa.config.json` ở gốc project.

## Điều kiện tiên quyết

1. `qa.config.json` tồn tại ở gốc project → `node .claude/skills/qa-visual/scripts/config-loader.mjs` phải exit 0.
2. Playwright cài trong project đích: `npm i -D playwright && npx playwright install chromium`.
3. App đang chạy tại `baseUrl`. **Skill không tự start app** — nếu không truy cập được thì báo người dùng start rồi dừng.
4. `.env` của repo có `QA_TEST_EMAIL`/`QA_TEST_PASSWORD` khi `auth.mode = "form"`.
5. Credential R2 (chỉ khi upload): nhập **một lần cho mọi repo**, không phải mỗi project một lần.
   Thiếu thì `upload-r2.mjs` báo lỗi kèm lệnh này — **in ra cho người dùng tự gõ, đừng hỏi key rồi gõ hộ**
   (key lọt vào lịch sử hội thoại):

   ```
   ! node .claude/skills/qa-visual/scripts/setup-r2.mjs
   ```

   Script hỏi trong terminal với echo tắt, ghi `~/.claude/qa-skill/.env` chmod 600, rồi kiểm chứng bằng một lượt ghi/xoá thử lên bucket. Xem trạng thái: thêm `--show`. Ghi riêng cho repo này thay vì dùng chung: thêm `--local`.

**Cảnh báo bắt buộc in ra trước khi capture:** ảnh màn hình đã đăng nhập sẽ lên bucket public. Chỉ chạy trên dev/staging dữ liệu giả.

## Quy trình

| Bước | Script | Khi nào |
|---|---|---|
| 1. Đọc config | `scripts/config-loader.mjs` | luôn — fail sớm nếu config sai |
| 2. Đăng nhập | `scripts/authenticate.mjs` | `auth.mode` ≠ `none` và state hết hạn |
| 3. Chụp | `scripts/capture-screens.mjs` | luôn |
| 4. Suy token | `scripts/infer-design-tokens.mjs` | tuỳ chọn — **phải chạy TRƯỚC bước 5** để bật check `*-drift` |
| 5. Audit layout | `scripts/audit-layout.mjs` | khi được hỏi về lỗi bố cục |
| 6. Upload | `scripts/upload-r2.mjs` | khi cần link chia sẻ hoặc đính PR |
| 7. Đính PR | `scripts/attach-to-pr.mjs` | khi có PR mở cho branch hiện tại |

Chạy đủ 1→7 chỉ khi người dùng yêu cầu "audit rồi đính vào PR". Mặc định dừng ở bước người dùng hỏi.

Bước 4 là tuỳ chọn: không chạy thì `audit-layout` vẫn đủ 5 check hình học, chỉ thiếu `*-drift`.
Thêm cờ `--a11y` (hoặc khai `audit.checkContrast`/`audit.checkTouchTarget` trong `qa.config.json`) để bật 2 check nâng cao: `text-contrast` (độ tương phản màu chữ/nền theo chuẩn WCAG 2.1) và `touch-target-size` (kích thước vùng chạm $\ge 44\times 44$px cho mobile).

## Reference — load đúng file cần, không load hết

| File | Load khi |
|---|---|
| `references/screen-coverage.md` | quyết định chụp route/viewport/trạng thái nào, xử lý màn cần data |
| `references/layout-audit.md` | diễn giải finding, chỉnh ngưỡng, xử lý false-positive |
| `references/design-token-inference.md` | phân tích màu/spacing/typography không nhất quán |
| `references/r2-publish.md` | upload, đặt key, verify URL public, đính vào PR |

## Ranh giới

- Skill **sinh report + ảnh**, không tự sửa code UI.
- Finding của `audit-layout` là **số đo**, không phải phán xét thẩm mỹ. Không suy diễn thêm ngoài dữ liệu script trả về.
- Không hạ ngưỡng trong `qa.config.json` để giấu finding. Muốn bỏ qua thì thêm vào `audit.ignoreSelectors` và nói rõ lý do.

## Ghi chú cài đặt

`qa-review` import `scripts/config-loader.mjs` của skill này qua đường dẫn tương đối. Hai skill ship theo cặp — đừng xoá một cái.
