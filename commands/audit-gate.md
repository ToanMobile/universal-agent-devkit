# /audit-gate — Post-Fix Audit & TIA Regression Shield Gate

Kích hoạt cổng kiểm toán 5 tầng tự động sau khi sửa lỗi, bao gồm:
1. Git Diff, Hygiene & Quét Secret, Anti-Laziness (chống placeholder).
2. Hệ thống Thiết kế & Chuẩn tiếp cận (DESIGN.md, Touch target >= 48dp, Debounced buttons).
3. Paired Executable Oracle (Bằng chứng RED -> GREEN).
4. Ma trận kiểm thử hồi quy TIA với checklist đánh dấu `[x] PASS`.
5. Đánh giá mã nguồn tự động qua Alibaba OpenCodeReview (`ocr`).

## Sử Dụng
```bash
# Kích hoạt cổng kiểm toán tự động
postfix-gate

# Hoặc chạy trực tiếp với Python:
python3 bin/post-fix-gate.py
```
