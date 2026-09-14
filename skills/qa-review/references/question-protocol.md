# Chất vấn — hỏi gì, hỏi bao nhiêu

Load file này ở bước 2 của `qa-review`.

## Nguyên tắc duy nhất

> Câu hỏi phải **trích được từ diff**. Nêu tên hàm, tên field, tên file, số dòng cụ thể.
> Không trích được thì **không hỏi**.

Checklist chung chung là cách nhanh nhất để dev bỏ qua toàn bộ report — kể cả những câu đáng giá nằm lẫn trong đó.

| ❌ Chung chung | ✅ Trích từ diff |
|---|---|
| "Đã xử lý edge case chưa?" | "`createOrder()` thêm tham số `discountCode` optional — mã không hợp lệ thì trả lỗi hay bỏ qua im lặng? Diff không có nhánh xử lý." |
| "Có test chưa?" | "`requireRole()` đổi từ so sánh `===` sang `includes()` — role `admin-readonly` giờ có lọt qua guard `admin` không?" |
| "Migration an toàn chứ?" | "`migration.sql` thêm `discount_code text` không default — 12.000 đơn cũ sẽ mang `NULL`. Code đọc cột này ở đâu và xử lý `NULL` thế nào?" |
| "Có ảnh hưởng gì không?" | "`OrderCard.tsx` bỏ prop `compact` — còn 3 nơi truyền prop này (`OrderList`, `Dashboard`, `PrintView`), đã sửa hết chưa?" |

## Số lượng

**3–7 câu.** Dưới 3 thường là chưa đọc kỹ; trên 7 thì dev đọc lướt. Nếu có nhiều hơn, giữ lại câu có blast radius lớn nhất và gộp phần còn lại thành 1 mục "kiểm thêm".

Ưu tiên theo thứ tự: `schema` → `auth` → `api` → `deps` → `config` → `ui`.

## Bộ câu hỏi theo loại thay đổi

Đây là **khung để lấy ý**, không phải câu hỏi để chép nguyên văn. Mỗi câu bên dưới chỉ dùng được sau khi thay bằng tên thật lấy từ diff.

### `schema`
- Dữ liệu đã tồn tại mang giá trị gì ở cột/bảng mới? Ai backfill?
- Migration chạy ngược được không? Nếu không, rollback bằng cách nào?
- Cột bị xoá/đổi tên còn code nào đọc không?
- Index có theo kịp truy vấn mới không, hay bảng lớn sẽ full scan?

### `auth`
- Sau thay đổi, **ai mất quyền** và **ai được thêm quyền**? Liệt kê cụ thể vai trò.
- Endpoint nào dùng guard này? Đã kiểm hết chưa?
- Fail-open hay fail-closed khi guard ném lỗi?
- Token/session cũ còn hợp lệ không?

### `api`
- Contract có breaking không (bỏ field, đổi kiểu, đổi bắt buộc)?
- Client bản cũ đang chạy có gãy không? Có versioning không?
- Mã lỗi trả về là gì cho từng nhánh thất bại?
- Có giới hạn kích thước / phân trang cho response mới không?

### `deps`
- Vì sao nâng? Vá lỗi bảo mật, hay tiện tay?
- Changelog có breaking change nào chạm vào code đang dùng?
- Có lock version không, hay để range tự trôi?

### `config`
- Biến mới đã có ở staging/production chưa?
- Thiếu biến thì app **chết ngay** hay **chạy sai âm thầm**? Cái sau nguy hiểm hơn.
- Giá trị mặc định dùng cho môi trường nào?

### `ui`
- Trạng thái rỗng / đang tải / lỗi trông thế nào? Diff có nhánh nào cho chúng không?
- Chuỗi dài, số lớn, tên nhiều dòng thì layout ra sao?
- Màn hẹp (390px) còn dùng được không?
- → Sau khi trả lời, chạy `qa-visual` để nhìn thật, đừng đoán.

## Điều không được làm

- Không tự trả lời thay dev rồi viết vào report như đã chốt. Câu chưa có lời đáp phải nằm nguyên ở mục cuối report.
- Không hỏi thứ đọc diff là biết ("Hàm này nằm ở file nào?").
- Không biến chất vấn thành code review — tìm bug trong code là việc của skill khác.
