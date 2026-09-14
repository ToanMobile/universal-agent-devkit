# Sinh ma trận test scenario

Load file này ở bước 4 của `qa-review`. Đầu ra là **kịch bản để người kiểm**, không phải code test (R1 không sinh code test).

## Bốn trục

| Trục | Hỏi gì | Bỏ qua khi |
|---|---|---|
| **Happy path** | Luồng đúng, dữ liệu hợp lệ, quyền đủ | không bao giờ bỏ |
| **Biên** | rỗng / một / rất nhiều; 0, âm, max; chuỗi dài; ngày đầu-cuối kỳ | thay đổi không nhận input nào |
| **Lỗi & ngoại lệ** | mạng đứt, timeout, trùng, bấm hai lần, service ngoài trả 500 | thay đổi thuần tĩnh, không I/O |
| **Quyền hạn** | từng vai trò: được / bị chặn / không thấy | không có khái niệm vai trò trong luồng này |

**Chỉ dùng trục áp dụng được.** Đổi màu nút không cần trục quyền hạn — thêm vào chỉ làm loãng.

## Format

| # | Trục | Tiền đề | Thao tác | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|
| 1 | Happy | Đơn 500.000₫, mã `SALE10` còn hạn | Nhập mã, bấm Áp dụng | Tổng 450.000₫, hiện "Đã giảm 50.000₫" | P0 |
| 2 | Biên | Đơn 0₫ | Áp mã `SALE10` | Không âm tiền; tổng vẫn 0₫ | P1 |
| 3 | Lỗi | Mã hết hạn hôm qua | Áp mã | HTTP 422 `DISCOUNT_EXPIRED`, đơn không được tạo | P0 |
| 4 | Lỗi | Mạng rớt giữa lúc áp mã | Bấm Áp dụng 2 lần | Chỉ 1 request được ghi nhận, không trừ 2 lần | P0 |
| 5 | Quyền | Tài khoản khách vãng lai | Áp mã nội bộ `STAFF20` | Bị từ chối, không lộ mã hợp lệ | P1 |

**Kết quả mong đợi phải quan sát được** — mã lỗi, con số, chữ hiện trên màn. "Xử lý đúng" không phải kết quả.

## Ưu tiên

| Mức | Nghĩa |
|---|---|
| **P0** | Hỏng là mất tiền / lộ dữ liệu / chặn luồng chính. Phải kiểm trước khi merge. |
| **P1** | Hỏng gây khó chịu rõ rệt nhưng có đường vòng. |
| **P2** | Hoàn thiện. Kiểm khi có thời gian. |

## Số lượng

Đủ để phủ **mọi nhánh rẽ nhìn thấy trong diff**, không hơn. Liệt kê tổ hợp cho đủ số lượng là cách chắc chắn để không ai chạy bảng này.

Dấu hiệu ma trận sai:
- Hai dòng khác nhau mỗi chỗ đặt tên biến → gộp.
- Một dòng không truy được về dòng nào trong diff → xoá, hoặc chuyển thành câu hỏi.
- Không dòng nào là P0 mà thay đổi chạm `schema`/`auth` → đọc lại diff, chắc chắn đã sót.

## Nối sang qa-visual

Có file `category: ui` trong diff → cuối report ghi rõ:

```
Bước tiếp: chạy `qa-visual` trên các route <liệt kê route bị ảnh hưởng>
để đối chiếu layout thật, đừng phán đoán từ diff.
```
