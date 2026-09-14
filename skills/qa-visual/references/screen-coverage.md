# Chụp đủ màn — khai gì trong qa.config.json

Load file này khi quyết định chụp cái gì, hoặc khi `capture-screens.mjs` báo lỗi.

## `routes[]` phải khai tay

Không có auto-detect lúc chạy. `install.sh` chỉ **in gợi ý** khi cài, còn `routes[]` là khai báo của con người — "dò route stack-agnostic" là lời hứa không giữ được, nên không hứa.

```json
{ "path": "/orders", "name": "orders" }
```

- `path` bắt đầu bằng `/`, tương đối so với `baseUrl`
- `name` duy nhất, dùng làm tên file ảnh (`orders-desktop.png`) → chỉ chữ thường, số, gạch ngang

### Route có tham số

`/user/:id` không chụp được. Khai đường dẫn **cụ thể** trỏ vào dữ liệu seed:

```json
{ "path": "/user/1", "name": "user-detail" }
```

Cần nhiều trạng thái thì khai nhiều route, tên nói rõ trạng thái:

```json
{ "path": "/orders?status=empty",  "name": "orders-empty" },
{ "path": "/orders?status=many",   "name": "orders-full" }
```

Trạng thái rỗng và trạng thái nhiều dữ liệu là **hai màn khác nhau** về layout. Chụp một cái rồi suy ra cái kia là bỏ sót.

## "Đủ màn" nghĩa là gì

Không phải mọi route trong app. Đủ = **mọi màn mà diff chạm tới**, cộng màn kế bên nếu thay đổi nằm ở component dùng chung.

| Diff chạm | Chụp gì |
|---|---|
| 1 trang | trang đó |
| component dùng chung (`Button`, `Card`, `Table`) | mọi trang render component đó |
| layout / shell / theme | 1 trang đại diện mỗi kiểu layout |
| CSS toàn cục, design token | 3–5 trang trải rộng nhất |

## `viewports[]`

Mặc định `desktop 1440×900` + `mobile 390×844` là đủ cho hầu hết việc. Thêm khi:

- App có breakpoint tablet riêng → thêm `768×1024`
- Người dùng thật chạy màn hẹp (1280) → thêm, vì lỗi tràn ngang chỉ lộ ở đó
- Có màn riêng cho TV / kiosk

Mỗi viewport thêm vào nhân đôi số ảnh và thời gian chạy. Đừng thêm cho có.

## `auth.mode`

| Mode | Khi nào | Cần gì |
|---|---|---|
| `none` | app không cần đăng nhập, hoặc dev env đã seed sẵn session | không gì |
| `form` | app có form email/password của chính nó | `emailSelector`, `passwordSelector`, `submitSelector`, `readySelector` + `.env` |
| `manual` | login phức tạp (SSO, OTP, captcha) hoặc không muốn để mật khẩu trong `.env` | `readySelector`; chạy `node scripts/authenticate.mjs --manual` một lần |

`readySelector` là **tín hiệu duy nhất** biết đã đăng nhập xong. Chọn thứ chỉ tồn tại sau khi vào app (`[data-testid="app-shell"]`, sidebar, avatar user) — đừng chọn thứ có cả ở trang login như `body` hay logo.

Session lưu ở `auth.statePath` (quyền `0600`), tái dùng trong `stateMaxAgeHours`. Session hỏng giữa chừng → script tự đăng nhập lại **đúng một lần** rồi dừng.

## Khi có lỗi

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `Không tìm thấy emailSelector "..."` | selector sai → sửa `qa.config.json`, không sửa code |
| `Vẫn ở trang login sau khi submit` | sai `QA_TEST_EMAIL`/`QA_TEST_PASSWORD` trong `.env` |
| `Không thấy auth.readySelector` mà URL đã vào app | `readySelector` sai → mở DevTools chọn lại |
| Một route `failed`, các route khác `ok` | route đó có vấn đề riêng; xem `error` trong manifest |
| Ảnh đúng là trang login | `readySelector` khớp cả trang login → chọn selector đặc trưng hơn |

Một route lỗi **không** làm hỏng cả run — mỗi route chạy trong tab riêng.

## `capture-manifest.json`

Ghi cạnh ảnh, là đầu vào của audit (phase 4) và upload (phase 6). Đọc file này, **đừng tự glob thư mục** — glob không biết route nào `failed`.

```json
{ "route": "orders", "viewport": "desktop",
  "file": ".qa-screenshots/orders-desktop.png",
  "finalUrl": "http://localhost:3000/orders", "status": "ok" }
```

`file` là đường dẫn tương đối gốc project — manifest mang sang máy khác vẫn dùng được.
