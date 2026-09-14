# Audit layout — đọc finding, chỉnh ngưỡng

Load file này khi diễn giải kết quả `audit-layout.mjs`, hoặc khi gặp finding sai.

## Nguyên tắc

Audit **đo** hình học trên DOM sống, không đưa ảnh cho LLM đoán. Mỗi finding là một con số kiểm chứng được, không phải phán xét thẩm mỹ.

> **Khi phân vân thì không báo.** False-positive giết niềm tin nhanh hơn bỏ sót. Dev bị báo bừa 2 lần sẽ bỏ qua cả những finding đúng.

## Chạy

```bash
node .claude/skills/qa-visual/scripts/audit-layout.mjs                    # theo capture-manifest.json
node .claude/skills/qa-visual/scripts/audit-layout.mjs --url http://…     # 1 trang, không cần manifest
node .claude/skills/qa-visual/scripts/audit-layout.mjs --viewport mobile  # lọc viewport
```

Audit chạy trên **DOM sống**, không trên file PNG — ảnh không có selector, không có computed style. Ảnh và audit dùng chung `stabilizePage` nên nhìn thấy cùng một trạng thái.

## 5 loại finding

| Type | Đo cái gì | Không báo khi |
|---|---|---|
| `horizontal-overflow` | trang cuộn ngang được **và** element có `right` vượt viewport | tổ tiên có `overflow-x` auto/scroll/hidden; cha cũng đã tràn (chỉ báo element đầu tiên phá khung) |
| `overlap` | hai sibling **cùng cha, cùng trong luồng** có hộp giao nhau >1px | absolute/fixed/sticky/float/`z-index` tường minh; element inline xuống nhiều dòng; giao < `minElementArea` |
| `collapsed-container` | `clientHeight = 0` nhưng có con hiển thị trong luồng | con đều ẩn; con đều absolute/fixed; chính nó bị ẩn |
| `misalignment` | con lệch khỏi **mốc mà container khai** qua `align-items` | lệch 0px; lệch >8px; container flex nhiều dòng; `align-items: baseline`; con có `align-self` riêng |
| `text-truncation` | `scrollWidth > clientWidth` trên element **mang chữ trực tiếp** | có `text-overflow: ellipsis`; có `-webkit-line-clamp`; `overflow-x` auto/scroll/visible |

### `misalignment` khác gì cách làm thông thường

Không so từng cặp element rồi đoán cái nào đúng. Container flex khai `align-items` tức là **CSS đã tuyên bố** mốc căn cho mọi con. Con nào lệch mốc đó 1–8px là vi phạm chính tuyên bố ấy.

Hệ quả: bắt được cả nhóm chỉ có **2 phần tử** (nhãn + ô nhập), nơi phương pháp "lấy số đông làm chuẩn" bó tay vì không có số đông.

### Vì sao ngưỡng 1–8px

| Lệch | Ý nghĩa |
|---|---|
| **0px** | căn đúng, cố ý |
| **1–8px** | gần như chắc chắn lỗi — mắt người thấy "sai sai" nhưng không chỉ ra được. Đây là loại defect máy bắt tốt hơn người |
| **>8px** | bố cục khác hẳn, có chủ đích. Báo là noise |

Đổi trong `qa.config.json`: `audit.alignTolerancePx: [1, 8]`.

## Severity

| Mức | Nghĩa | Ví dụ |
|---|---|---|
| `high` | chặn sử dụng | tràn ngang toàn trang; container sập nuốt nội dung; overlap ≥25% hoặc che thứ bấm được; chữ cắt trên nút/link |
| `medium` | thấy rõ nhưng vẫn dùng được | chữ cắt trong đoạn văn; container sập do float; lệch ≥3px |
| `low` | tinh chỉnh | lệch <3px |

## Baseline trên fixture (2026-09-09)

Đo bằng `node scripts/score-audit.mjs .qa-screenshots/audit-findings.json`, chạy trên `fixtures/defects`, 8 trang × 2 viewport:

| Loại | Recall |
|---|---|
| `collapsed-container` | 2/2 |
| `color-drift` / `spacing-drift` / `typography-drift` | 3/3 (xem [design-token-inference.md](./design-token-inference.md)) |
| `horizontal-overflow` | 1/1 |
| `misalignment` | 2/2 |
| `overlap` | 1/1 |
| `text-truncation` | 2/2 |
| **Tổng 8 loại** | **11/11 = 100%** |
| False-positive | **0 tổng, 0/màn** (ngưỡng ≤2/màn) |
| Bẫy `shouldNotFind` dính | **0/13** |

Hiệu năng: trang **1064 element** đo hết **13–30ms** (ngưỡng: 500 element <3s).

**Baseline này là in-sample.** Một số bộ lọc chống nhiễu được rút ra từ chính nhiễu của fixture, nên 11/11 đo *độ khớp với fixture*, không đo *độ chính xác trên app thật*. Lần đầu chạy trên project thật, recall thấp hơn là bình thường — thêm case vào fixture rồi sửa check, đừng nới ngưỡng.

Đối chứng ngoài fixture cho `misalignment`: `clean.html` gỡ hết `flex-wrap:wrap` (để 3 container `align-items` thật sự được xét) → **0 finding**; cấy một nút lệch `top:3px` → **đúng 1 finding**.

## Khi finding sai

1. **Đọc `evidence` trước.** Nó có số đo cụ thể — mở DevTools kiểm lại là biết ngay đúng hay sai.
2. **Đúng nhưng không muốn sửa** → thêm vào `audit.ignoreSelectors` trong `qa.config.json`, **kèm comment nói rõ vì sao**.
3. **Sai thật** → tái hiện tối giản vào `fixtures/defects/` với id `#ok-*`, thêm vào `shouldNotFind` của `expected-findings.json`, rồi sửa check. Chạy `score-audit` xác nhận recall không tụt.

**Không hạ ngưỡng để finding biến mất.** Hạ ngưỡng giấu cả finding đúng lẫn sai, và không ai biết đã giấu cái gì.

## Giới hạn đã biết

- **Chỉ container flex** mới có `misalignment`. Bố cục `block`/`grid` không khai mốc căn nên không có tuyên bố để đối chiếu; gom cạnh sibling rồi lấy số đông làm chuẩn là nguồn false-positive lớn, đã cân nhắc và **bỏ**.
- **Element inline xuống nhiều dòng** bị loại khỏi check `overlap`: `getBoundingClientRect` gộp các dòng thành một hộp bao trùm cả khoảng trắng không hề được vẽ.
- **Không đo bên trong `<svg>`.** Element con của `<svg>` không theo box model HTML — `clientHeight`/`clientWidth` luôn bằng 0 theo spec, và các `<g>` chồng lên nhau là cách vẽ chart bình thường. Duyệt chúng chỉ sinh false-positive hàng loạt (một trang dashboard Recharts ra 116 finding, sai 100%), nên chúng bị loại khỏi mọi check hình học. Thẻ `<svg>` gốc vẫn được đo vì nó là hộp HTML thật.
- **Element `sr-only` được coi là ẩn.** Nhãn cho trình đọc màn hình (`clip: rect(0,0,0,0)` hoặc `clip-path: inset(50%)`) vẫn ở trong DOM nhưng mắt người không thấy, nên mọi số đo hình học của nó vô nghĩa.
- **Chỉ đo được cái đo được.** Màu sai, chữ khó đọc, thứ tự thị giác lộn xộn — audit không thấy. Nhìn ảnh.
