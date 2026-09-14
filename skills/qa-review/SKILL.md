---
name: qa-review
description: Chất vấn một thay đổi code trước khi tạo PR. Dùng khi cần đọc diff (branch, commit, hoặc PR số) rồi đặt câu hỏi làm rõ tính năng, sinh acceptance criteria kiểm chứng được, và dựng ma trận test scenario theo vai trò × trạng thái dữ liệu × luồng lỗi. Kích hoạt khi người dùng nói "review diff trước khi tạo PR", "chất vấn tính năng này", "viết acceptance criteria", "liệt kê test case cho thay đổi này", "QA cái PR này". Đây là bước hỏi và lập kế hoạch test, không phải bước tìm bug trong code hay chạy test.
---

# qa-review

Đọc diff → **chất vấn** → acceptance criteria → ma trận scenario. Đầu ra là tài liệu để con người quyết, không phải bản vá.

## Không nhầm với

- Tìm bug / lỗi bảo mật trong code → dùng skill review code.
- Chạy test, đo coverage → dùng skill test.
- Chụp màn, audit giao diện → dùng `qa-visual`.

## Quy trình

1. **Thu diff** — `node scripts/collect-diff.mjs [--base <ref>] [--pr <số>]`. Mặc định so với nhánh mặc định của repo. Trả JSON: file đổi, số dòng +/-, tên hàm/route/component mới, migration, thay đổi config.
2. **Chất vấn** — load `references/question-protocol.md`. Hỏi ĐÚNG chỗ diff không tự trả lời được: hành vi mong đợi ở biên, ai được phép, dữ liệu cũ ra sao. **Không hỏi lại thứ đọc diff là biết.**
3. **Acceptance criteria** — load `references/diff-analysis.md`. Mỗi tiêu chí phải kiểm chứng được: input cụ thể → kết quả quan sát được. Cấm tiêu chí kiểu "hoạt động đúng", "UX tốt".
4. **Ma trận scenario** — load `references/scenario-generation.md`. Trục: vai trò × trạng thái dữ liệu (rỗng/một/nhiều/lỗi) × luồng lỗi (mạng, quyền, trùng, timeout). Đánh dấu ưu tiên; không liệt kê tổ hợp cho đủ số lượng.
5. **Scaffold Playwright Test (Paired Executable Oracle)** — `node scripts/scaffold-playwright.mjs [--report <path>] [--out <spec.ts>]`. Tự động chuyển bảng scenario thành file test Playwright có thể thực thi để chạy RED trước khi code và GREEN sau khi hoàn thiện.

## Reference

| File | Load khi |
|---|---|
| `references/diff-analysis.md` | đọc diff, viết acceptance criteria |
| `references/question-protocol.md` | quyết định hỏi gì, hỏi bao nhiêu |
| `references/scenario-generation.md` | dựng ma trận test scenario |
| `scripts/scaffold-playwright.mjs` | sinh file Playwright spec (.spec.ts) từ ma trận |

## Đầu ra

Ghi vào `output.reportDir` của `qa.config.json` (mặc định `plans/reports/`),
tên `qa-review-{YYMMDD-HHmm}-{branch-slug}-report.md`. Không có `qa.config.json` thì vẫn chạy — hỏi người dùng nơi ghi.

Bố cục report, đúng 5 mục:

1. **Tóm tắt thay đổi** — base/head, số file, `byCategory`, blast radius một dòng
2. **Acceptance criteria** — mỗi dòng: input cụ thể → kết quả quan sát được
3. **Câu hỏi cho dev** — nhóm theo loại thay đổi, 3–7 câu, mỗi câu nêu tên hàm/field thật
4. **Ma trận scenario** — bảng theo 4 trục, có cột ưu tiên P0/P1/P2
5. **Bước tiếp** — có file `category: ui` thì chỉ đích danh route cần chạy `qa-visual`; gợi ý dev chạy `node scripts/scaffold-playwright.mjs` để biến kịch bản thành test Playwright chạy được ngay.

Diff `truncated: true` → nói rõ trong mục 1 là report chỉ phủ các file đã đọc, liệt kê file chưa đọc.

## Ranh giới

- Không tự sửa code, không tự tạo PR, không tự commit.
- Câu hỏi chưa có lời đáp phải nằm nguyên trong report ở mục cuối, không được tự đoán rồi viết như đã chốt.
