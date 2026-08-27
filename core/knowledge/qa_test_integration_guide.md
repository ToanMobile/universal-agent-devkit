# QA Test Integration Guide

## Current source of truth

- Production entry: `.claude/commands/qa.md` → `python3 scripts/qa/orchestrators/qa.py`.
- Release orchestrator: `scripts/qa/orchestrators/production_gate.py`.
- CI/device runners: `scripts/qa/orchestrators/test_full.sh` và
  `scripts/qa/orchestrators/test_device.sh`.
- Fixture generators/push helpers: `scripts/qa/testdata/` và `scripts/qa/profile/`.
- Gate inventory và entry-point contract: `scripts/qa/README.md`.

Không có `prepare_qa_assets.sh` hoặc copy toàn bộ fixture vào `androidTest/assets` trong repo hiện tại;
không dùng hướng dẫn/count/size lịch sử làm evidence.

## Khi tích hợp fixture/gate mới

1. Xác định failure mechanism và runner nhỏ nhất cần fixture; không copy corpus lớn nếu generator/push
   helper hiện có đủ dùng.
2. Đặt fixture/generator trong thư mục QA hiện có, không commit secret, PII hoặc artifact build.
3. Wire vào orchestrator/gate theo pattern thật đã đọc; không thêm skip/bypass làm release evidence.
4. Thêm deterministic test cho success, expected failure và missing fixture/tool. Zero-test, stale report
   hoặc skip phải fail closed khi gate bắt buộc.
5. Update `scripts/qa/README.md`, `.claude/commands/qa.md` và traceability liên quan nếu public contract
   đổi.
6. Chạy targeted script/unit check trước; chỉ chạy `/qa` khi làm release verification.

Mọi count, file size, latency, coverage hoặc disk budget phải được đo từ repo/run hiện tại hoặc lấy từ
gate canonical; không hardcode từ tài liệu cũ.
