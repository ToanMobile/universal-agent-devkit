# Đọc diff và suy blast radius

Load file này khi bắt đầu bước 1–3 của `qa-review`.

## Chạy script

```bash
node .claude/skills/qa-review/scripts/collect-diff.mjs            # nhánh hiện tại vs base (gồm cả thay đổi chưa commit)
node .claude/skills/qa-review/scripts/collect-diff.mjs --staged   # chỉ phần đã staged
node .claude/skills/qa-review/scripts/collect-diff.mjs --pr 123   # PR đã mở
node .claude/skills/qa-review/scripts/collect-diff.mjs --base develop
```

Output JSON ra stdout, cảnh báo ra stderr:

| Field | Dùng để |
|---|---|
| `stats.byCategory` | biết đây là thay đổi kiểu gì trước khi đọc dòng nào |
| `files[]` | **đã sắp theo rủi ro giảm dần** — đọc từ trên xuống, đừng đọc theo thứ tự alphabet |
| `truncated` | `true` = diff quá lớn, `diff` là `null`. Phải tự `git diff -- <path>` từng file rủi ro cao |
| `base` / `head` | ghi vào report để người đọc biết so với cái gì |

`files[].category` chỉ dựa trên **đường dẫn**, không đọc nội dung. Nó gợi ý chỗ cần chú ý, không phải kết luận — file `src/lib/format.ts` bị xếp `other` vẫn có thể là thay đổi nguy hiểm nhất.

## Blast radius

Xếp hạng theo *thứ có thể hỏng mà diff không cho thấy*:

| Category | Lan tới đâu | Câu hỏi nền |
|---|---|---|
| `schema` | dữ liệu đã tồn tại, mọi truy vấn cũ | migration có chạy ngược được không? Dữ liệu cũ mang giá trị gì ở cột mới? |
| `auth` | mọi endpoint dùng guard đó | ai mất quyền, ai được thêm quyền sau thay đổi này? |
| `api` | mọi client đang gọi (kể cả app mobile bản cũ) | contract có breaking không? Client cũ còn chạy được không? |
| `deps` | toàn bộ runtime | bản mới có breaking change không? Vì sao nâng? |
| `config` | mọi môi trường | biến mới có mặt ở staging/prod chưa? Thiếu thì app chết hay chạy sai âm thầm? |
| `ui` | luồng người dùng, layout các màn liên quan | → chuyển tiếp `qa-visual` |

## Khi nào phải đọc ngoài diff

Diff cho thấy *cái gì đổi*, không cho thấy *ai phụ thuộc vào nó*. Bắt buộc tìm thêm khi:

- **Đổi chữ ký hàm / field API** → `grep -rn "<tên hàm>"` tìm nơi gọi. Diff chỉ sửa 1 nơi mà có 6 nơi gọi là dấu hiệu sót.
- **Thêm cột NOT NULL** → tìm mọi nơi `INSERT`/`create` vào bảng đó.
- **Đổi guard/permission** → liệt kê endpoint dùng guard đó.
- **Xoá hoặc đổi tên** bất cứ thứ gì exported → tìm import còn lại.

Không tìm thì mọi acceptance criteria viết ra chỉ phủ được phần đã thấy.

## Acceptance criteria — quy tắc viết

Mỗi tiêu chí phải có **input cụ thể → kết quả quan sát được**. Nếu không kiểm chứng được thì không phải tiêu chí.

| ❌ Không nhận | ✅ Nhận |
|---|---|
| "Mã giảm giá hoạt động đúng" | "Đơn 500.000₫ + mã `SALE10` → tổng còn 450.000₫, response có `discountApplied: true`" |
| "UX mượt" | "Bấm Áp dụng khi mạng chậm → nút disabled và hiện spinner, không tạo được 2 đơn" |
| "Không có lỗi" | "Mã hết hạn → HTTP 422, body `{code: 'DISCOUNT_EXPIRED'}`, đơn KHÔNG được tạo" |

Tiêu chí suy từ diff, không bịa tính năng. Chỗ nào diff không nói rõ hành vi → chuyển thành **câu hỏi**, đừng tự đoán rồi viết như đã chốt.
