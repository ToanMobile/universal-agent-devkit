# DESIGN.md — Universal Design System & UI/UX Guidelines for AI Agents

> **Chỉ thị Bắt buộc cho AI Agent:**
> Trước khi sinh hoặc sửa đổi bất kỳ mã nguồn giao diện (UI) nào (Jetpack Compose, Flutter, React/Tailwind, Unity UI, v.v.), AI Agent BẮT BUỘC phải đọc và áp dụng chính xác các Design Tokens và quy chuẩn trong tệp này. Tuyệt đối không hardcode mã màu lạ hoặc khoảng cách tùy tiện.

---

## 1. Hệ Thống Màu Sắc Ngữ Nghĩa (Semantic Color Tokens)

| Token Tên | Light Mode HEX | Dark Mode HEX | Mục đích sử dụng |
|---|---|---|---|
| `color-primary` | `#0D6EFD` | `#3B82F6` | Màu thương hiệu chính, nút CTA, thanh tiêu đề |
| `color-on-primary` | `#FFFFFF` | `#FFFFFF` | Chữ/icon nằm trên nền màu primary |
| `color-surface` | `#FFFFFF` | `#121212` | Nền thẻ (Card), Modal, Sheet, AppBar |
| `color-background` | `#F8F9FA` | `#0A0A0A` | Nền toàn bộ màn hình (Scaffold background) |
| `color-text-primary` | `#1F2937` | `#F3F4F6` | Chữ tiêu đề, nội dung đọc chính (High contrast) |
| `color-text-secondary`| `#6B7280` | `#9CA3AF` | Chữ phụ, mô tả ngắn, timestamp, label phụ |
| `color-border` | `#E5E7EB` | `#27272A` | Đường kẻ phân cách, viền input, divider |
| `color-success` | `#10B981` | `#34D399` | Trạng thái hoàn tất, badge PASS, tiền vào |
| `color-warning` | `#F59E0B` | `#FBBF24` | Trạng thái cảnh báo, pending, chờ duyệt |
| `color-error` | `#EF4444` | `#F87171` | Báo lỗi, nút hủy nghiêm trọng, thất bại |

---

## 2. Thang Đo Typography & Phân Cấp Chữ

Sử dụng thang đo tiêu chuẩn $8\text{pt} / 4\text{px}$ Grid:

| Cấp bậc (Level) | Cỡ chữ (Size) | Line Height | Weight | Sử dụng cho |
|---|---|---|---|---|
| `Display / Hero` | $28\text{sp} / 32\text{px}$ | $36\text{px}$ | Bold (700) | Màn hình chính, số dư lớn, banner chào |
| `Headline` | $20\text{sp} / 24\text{px}$ | $28\text{px}$ | SemiBold (600) | Tiêu đề màn hình, tên mục lớn |
| `Title` | $16\text{sp} / 18\text{px}$ | $24\text{px}$ | Medium (500) | Tiêu đề card, nhóm chức năng |
| `Body Large` | $14\text{sp} / 16\text{px}$ | $22\text{px}$ | Regular (400) | Nội dung văn bản chính, input value |
| `Body Small` | $12\text{sp} / 14\text{px}$ | $18\text{px}$ | Regular (400) | Ghi chú, tooltip, điều khoản |
| `Caption / Label` | $10\text{sp} / 12\text{px}$ | $16\text{px}$ | Medium (500) | Badge trạng thái, nhãn dưới tab bar |

---

## 3. Khoảng Cách (Spacing Grid & Layout)

Tuân thủ hệ số bội của $4\text{px} / 4\text{dp}$:
- `space-xs`: $4\text{dp}$ — Khoảng cách icon và chữ nhỏ.
- `space-sm`: $8\text{dp}$ — Khoảng cách giữa các chip, tag nội bộ.
- `space-md`: $16\text{dp}$ — Padding tiêu chuẩn của màn hình, lề trong của Card.
- `space-lg`: $24\text{dp}$ — Khoảng cách giữa các khối nội dung lớn.
- `space-xl`: $32\text{dp}$ — Lề trên màn hình, phân tách các section độc lập.

---

## 4. Rào Chắn Khả Năng Tiếp Cận & Tương Tác (Accessibility & a11y)

1. **Kích thước Vùng Chạm Tối thiểu (Touch Target Size):**
   - Mọi nút bấm, icon button, switch, checkbox bắt buộc phải có kích thước vùng bấm tối thiểu:
     $$\text{Touch Target} \ge 48\times 48\text{dp} \quad (\text{Web: } \ge 44\times 44\text{px})$$
   - Tuyệt đối không đặt các nút bấm quá sát nhau gây bấm nhầm trên màn hình cảm ứng.
2. **Độ tương phản màu (Contrast Ratio):**
   - Đảm bảo tỷ lệ tương phản chữ/nền tối thiểu $4.5:1$ cho văn bản thường và $3:1$ cho văn bản lớn (chuẩn WCAG AA).
3. **Trạng thái Tương tác Rõ ràng (Interaction States):**
   - Mỗi component tương tác bắt buộc phải hỗ trợ đủ 4 trạng thái: `Default`, `Pressed/Hover`, `Focused`, và `Disabled`.
   - Khi ở trạng thái `Disabled`, độ mờ (opacity) chuẩn là $0.38$, không nhận bất kỳ sự kiện click nào.

---

## 5. Quy Chuẩn Đồ Họa & Iconography

- Định dạng icon chuẩn: Vector SVG (Web) hoặc Vector Drawable (Android XML / Compose Icons).
- Độ dày viền icon (Stroke): Đều đặn $1.5\text{dp}$ hoặc $2.0\text{dp}$ trong toàn bộ ứng dụng.
- Bán kính bo góc (Corner Radius):
  - Nút bấm nhỏ / Chip: $8\text{dp}$.
  - Thẻ (Card) / Sheet: $16\text{dp}$.
  - Modal / Dialog: $20\text{dp}$.
  - Pill button / Avatar: $999\text{dp}$ (Full rounded).
