# 📑 Mục Lục Bộ Nhớ 2 Tầng: instincts.md
> **Tệp gốc:** `instincts.md` (103 dòng, 7.4 KB)
> **Quy tắc đọc (Memory Slicing):** KHÔNG nạp toàn bộ file gốc. Tra cứu mục cần thiết bên dưới và dùng lệnh `sed -n` để đọc lát cắt đúng 50–100 dòng.

| STT | Tiêu Đề Mục / Bẫy Mã Nguồn | Phạm Vi Dòng | Lệnh Đọc Lát Cắt (On-Demand Slicing) |
|:---:|:---|:---:|:---|
| 1 | Instincts & Failure Memory — Repository Lessons Learned | `1–9` | `sed -n '1,9p' instincts.md` |
| 2 | 1. Bẫy Thường Gặp & Bài Học Kinh Nghiệm (Active Instincts) | `10–11` | `sed -n '10,11p' instincts.md` |
| 3 | [INSTINCT-001] Tránh Mất Mát Mã Nguồn Do Placeholder Lười Biếng | `12–19` | `sed -n '12,19p' instincts.md` |
| 4 | [INSTINCT-002] Chống Đúp Request & Spam Thao Tác (Button Double-Click) | `20–26` | `sed -n '20,26p' instincts.md` |
| 5 | [INSTINCT-003] Không Tái Phát Minh Bánh Xe (Don't Reinvent The Wheel) | `27–33` | `sed -n '27,33p' instincts.md` |
| 6 | [INSTINCT-004] Bảo Vệ Bí Mật Môi Trường & Dữ Liệu Nhạy Cảm | `34–40` | `sed -n '34,40p' instincts.md` |
| 7 | [INSTINCT-005] Vùng Chạm Giao Diện Dưới Chuẩn Tiếp Cận (< 48dp) | `41–47` | `sed -n '41,47p' instincts.md` |
| 8 | [INSTINCT-006] Chặn Luồng Chính (Main Thread) & Bẫy Hiệu Năng $O(N^2)$ | `48–57` | `sed -n '48,57p' instincts.md` |
| 9 | [INSTINCT-007] Nuốt Lỗi Âm Thầm (Empty Catch Block / Silent Exception) | `58–64` | `sed -n '58,64p' instincts.md` |
| 10 | [INSTINCT-008] Treo Vô Hạn Do Thiếu Timeout & Trùng Lặp Giao Dịch | `65–71` | `sed -n '65,71p' instincts.md` |
| 11 | [INSTINCT-009] In Log Thô (console.log / println) & Lộ Thông Tin Nhạy Cảm (PII) | `72–78` | `sed -n '72,78p' instincts.md` |
| 12 | [INSTINCT-010] Sập Ứng Dụng Do Nâng Cấp Schema CSDL Thiếu Migration | `79–85` | `sed -n '79,85p' instincts.md` |
| 13 | 2. Nhật Ký Bẫy Mã Nguồn Bổ Sung (Dành cho Dev / Agent thêm mới) | `86–89` | `sed -n '86,89p' instincts.md` |
| 14 | [INSTINCT-XXX] <Tên bẫy / Tình huống> | `90–97` | `sed -n '90,97p' instincts.md` |
| 15 | [INSTINCT-AUTO] StateLossOnProcessDeath | `98–103` | `sed -n '98,103p' instincts.md` |

## 💡 Cách Sử Dụng:
1. Đầu phiên làm việc, chỉ nạp tệp mục lục nhẹ này (`instincts-index.md`).
2. Khi phát sinh triệu chứng hoặc lỗi cụ thể, chạy lệnh `sed -n` tương ứng để nạp đúng ngữ cảnh cần xử lý.
