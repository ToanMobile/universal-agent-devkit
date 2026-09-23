---
name: observability-instrumentation
description: Dùng khi thêm hoặc audit log, metric, trace, Crashlytics/Firebase Performance, hay khi production bug thiếu dữ liệu chẩn đoán. Bỏ qua UI thuần không có failure mode và code chỉ chạy trong test/script.
---

# Observability & Instrumentation

## Nguyên Tắc Đặt Signal Giám Sát

Trước khi thêm bất kỳ log, metric hay trace nào, hãy xác định câu hỏi chẩn đoán cụ thể:
- **Metric:** Đo lường tỷ lệ lỗi (error rate), throughput, latency phân vị P95/P99.
- **Trace:** Xác định chính xác latency nằm ở giai đoạn nào trong luồng xử lý phân tán.
- **Log / Breadcrumb:** Ghi lại ngữ cảnh tại sao một instance/transaction cụ thể thất bại.

## Tiêu Chuẩn Dữ Liệu (Telemetry Contract)

1. **Machine-Readable & Low Cardinality:** Event key ổn định, nhóm theo enum hoặc format hữu hạn; không dùng User ID hay nội dung tự do làm label metric.
2. **Che giấu PII Tối thượng:** Tuyệt đối không log thông tin nhạy cảm, mật khẩu, access token, số thẻ, số định danh CCCD.
3. **Correlation ID / Trace ID:** Gắn mã định danh ngẫu nhiên xuyên suốt các tầng xử lý để kết nối luồng mà không chứa dữ liệu nhạy cảm.
4. **Cấp độ Severity:**
   - `ERROR`: Chỉ cho các lỗi cần can thiệp xử lý ngay (actionable).
   - `WARN`: Cho các rủi ro đã lường trước hoặc trạng thái suy giảm hiệu năng (degraded).
   - `INFO`: Ghi nhận các mốc chuyển trạng thái nghiệp vụ lớn.
   - `DEBUG`: Chỉ phục vụ môi trường phát triển cục bộ.
