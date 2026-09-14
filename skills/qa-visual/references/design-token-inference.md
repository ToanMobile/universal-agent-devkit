# Suy design token và bắt drift

Load file này khi phân tích màu / khoảng cách / cỡ chữ không nhất quán.

## Cảnh báo đọc trước

> Token ở đây là **SUY ĐOÁN từ computed style thực tế**, không phải khai báo từ design system.
> Output mang cờ `"inferred": true`. Khi trình bày cho người đọc, **phải nói rõ điều đó** —
> đừng dựng nó thành chân lý rồi bảo dev sửa theo.

Project có design system thật thì khai tay ở `qa.config.json` → `audit.tokens`; lúc đó inference bị bỏ hoàn toàn cho nhóm đã khai và cờ thành `"inferred": false`.

## Chạy

```bash
node .claude/skills/qa-visual/scripts/infer-design-tokens.mjs   # ghi inferred-tokens.json
node .claude/skills/qa-visual/scripts/audit-layout.mjs          # tự nạp file trên, bật check *-drift
```

Không chạy bước đầu thì `audit-layout` vẫn chạy đủ 5 check hình học. Token inference là **tuỳ chọn**.

## Cách suy token

Gom theo **nhóm**, không theo từng thuộc tính. Design system định nghĩa một thang dùng chung: bảng màu cho cả chữ/nền/viền, thang khoảng cách cho cả padding/margin/gap. Đếm riêng từng thuộc tính thì mỗi rổ quá nhỏ, giá trị hợp lệ cũng thành "hiếm".

| Nhóm | Thuộc tính | Sinh finding |
|---|---|---|
| `color` | `color`, `background-color`, `border-*-color` | `color-drift` |
| `fontSize` | `font-size` | `typography-drift` |
| `fontWeight` | `font-weight` | `typography-drift` |
| `spacing` | `padding-*`, `margin-*`, `row-gap`, `column-gap` | `spacing-drift` |
| `borderRadius` | `border-*-radius` | `spacing-drift` |

Giá trị chiếm **≥2%** số lần xuất hiện trong nhóm **và** xuất hiện **≥3 lần** → token. Còn lại → ứng viên drift.

`line-height` **không** được theo dõi: computed line-height suy ra từ `font-size × hệ số`. Font-size lệch thì line-height lệch theo — báo cả hai là báo một lỗi hai lần.

## Điều kiện KÉP để gọi là drift

Chỉ báo khi **cả hai** đúng:

1. Giá trị **hiếm** (dưới ngưỡng token), **và**
2. **Gần sát** một token — màu `ΔE < 5`, số đo lệch `< 15%`

Thiếu vế 2 thì check này báo mọi thứ hiếm gặp và trở thành rác. Ví dụ trong fixture:

| Giá trị | Token gần nhất | Khoảng cách | Kết luận |
|---|---|---|---|
| `#4AB6C2` | `#49B7C3` | ΔE **0.49** | drift — gần như chắc chắn hardcode nhầm |
| `#D64545` | `#49B7C3` | ΔE **98.27** | **không** báo — màu ngữ nghĩa riêng, dùng 1 lần là có chủ đích |

ΔE tính trên không gian **Lab** chứ không phải RGB: RGB không tuyến tính theo mắt người. ΔE <1 mắt không phân biệt được; 1–5 chỉ thấy khác khi đặt cạnh nhau — đúng vùng của lỗi hardcode.

## Hai bộ lọc chống nhiễu

Cả hai đều rút ra từ nhiễu gặp thật trên fixture:

1. **Giá trị px không nguyên bị loại khỏi ứng viên drift.** `h1 { margin: .67em }` trên font 32px ra `21.44px`; `<input>` mặc định ra `13.3333px`. Người thiết kế viết `15px`, không viết `21.44px` — số lẻ gần như luôn là do trình duyệt tự tính.
2. **Mỗi element chỉ một finding drift, ưu tiên nguyên nhân gốc** (`color` → `typography` → `spacing`). Font-size lệch kéo theo `margin: 1em` lệch, `padding: 1em` lệch. Báo cả chuỗi là báo một lỗi nhiều lần.

## Chỉnh ngưỡng

`qa.config.json` → `audit.tokenDrift`:

```json
{ "minShare": 0.02, "minCount": 3, "maxDeltaE": 5, "maxNumericDrift": 0.15 }
```

Khai tay token (bỏ hẳn suy đoán cho nhóm đó):

```json
{ "audit": { "tokens": { "color": ["rgb(73, 183, 195)", "rgb(31, 41, 51)"], "fontSize": ["16px", "14px", "20px"] } } }
```

Giá trị khai phải đúng dạng computed style — `rgb(73, 183, 195)` chứ không phải `#49B7C3`.

## Baseline trên fixture (2026-09-09)

`token-drift.html`: **3/3** defect bắt đúng, **0** false-positive. `#ok-accent` (`#D64545` dùng 1 lần) không dính. `clean.html` **0** drift.

## Giới hạn đã biết

- **Chỉ đúng với app một theme.** App có dark/light sẽ trộn hai bảng màu vào một rổ, làm cả hai thành "hiếm". R1 giả định một theme; đa theme để round 2.
- **Ngưỡng 2% / ΔE 5 / 15% là số đặt ra, mới kiểm trên fixture.** Chưa hiệu chỉnh trên project thật — đó là việc của phase 8.
- **Chỉ thu style của element đang hiển thị.** Trạng thái hover/focus/active, và màn chưa capture, không được tính.
- **Nếu sau khi dogfood vẫn nhiễu**: bỏ file `inferred-tokens.json` đi là check tắt, không cần sửa code.
