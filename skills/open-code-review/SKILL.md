---
name: open-code-review
description: Dùng khi cần review code tự động, kiểm tra chất lượng git diff trước khi commit/PR, hoặc audit toàn bộ file bằng OpenCodeReview CLI (Alibaba Group). Hỗ trợ cả chế độ OCR-managed và Delegation mode.
---

# Open Code Review (`ocr`) — Alibaba Quality Engine

## 1. Tổng quan (Overview)

Tích hợp trực tiếp công cụ `ocr` (Alibaba Group OpenCodeReview) vào quy trình phát triển.
Công cụ giải quyết 4 điểm nghẽn lớn của AI code review truyền thống:
1. **Chống bỏ sót file (Incomplete Coverage):** Tự động phân rã changeset thành các bundle $\le 10$ file có quan hệ ngữ nghĩa để review độc lập, không "cắt xén" góc cạnh.
2. **Định vị dòng chính xác tuyệt đối (Deterministic Line Resolution):** AI chỉ trích xuất `existing_code`, engine Go tĩnh (`resolver.go`) tự đối chiếu Git Diff Hunks để tính `StartLine` và `EndLine` chính xác 100%.
3. **Độ chính xác cao (High Precision / Low Noise):** Đạt chuẩn benchmark AACR-Bench, ưu tiên loại bỏ nhận xét rác.
4. **Tiết kiệm token:** Chỉ tiêu tốn $\sim 1/9$ lượng token so với đưa toàn bộ diff thô vào prompt.

---

## 2. Các chế độ thực thi (Execution Modes)

### Mode 1: Chế độ Review Diff Trực tiếp (`ocr review`)
Sử dụng khi cần review các thay đổi chưa commit (workspace), branch diff, hoặc một commit cụ thể.

```bash
# 1. Review toàn bộ staged, unstaged và untracked changes trong workspace
ocr review --audience agent

# 2. Review diff giữa nhánh hiện tại và nhánh main kèm ngữ cảnh nghiệp vụ
ocr review --from main --to $(git branch --show-current) -b "Automotive zero-regression fix"

# 3. Review 1 commit cụ thể
ocr review -c <commit-hash>

# 4. Xuất kết quả dạng JSON để script phân tích
ocr review --format json --output ocr-report.json
```

### Mode 2: Chế độ Ủy quyền (Delegation Mode — `ocr delegate`)
Sử dụng khi **không muốn cấu hình thêm API key ngoài cho OCR**, mà muốn chính Host Agent (Claude Code / Antigravity / Gemini) tự review bằng model của mình:

```bash
# Bước 1: Để OCR phân tích diff, loại trừ file rác và xuất danh sách file cần review
ocr delegate preview --format json

# Bước 2: Để OCR phân giải các bộ luật review phù hợp cho từng file
ocr delegate rule --format json <file1> <file2> ...

# Bước 3: Host Agent tự đọc diff và áp dụng luật để xuất nhận xét
```

### Mode 3: Quét Toàn Bộ File (`ocr scan`)
Sử dụng khi cần kiểm toán mã nguồn một thư mục hoặc file mà không có git diff:

```bash
ocr scan --path src/main/java/com/car/media/
```

---

## 3. Quy chuẩn Kết hợp với Automotive Zero-Regression

Khi `ocr review` được gọi trong dự án ô tô / hệ sinh thái phức tạp:
1. **Pass Condition:** 0 lỗi Critical/High liên quan đến:
   - Thay đổi không an toàn ở luồng dùng chung (Shared Flow breach).
   - Xóa hoặc nới lỏng Guard Conditions (`Build.VERSION.SDK_INT <= 28`, `FlymeAuto`).
   - Rò rỉ thông tin nhạy cảm, token, credentials.
2. **Sửa lỗi theo gợi ý:** Nếu OCR đưa ra `suggested_diff`, kiểm tra lại call-sites trước khi áp dụng.
