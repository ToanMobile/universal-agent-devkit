---
name: observability-instrumentation
description: Dùng khi thêm hoặc audit log, metric, trace, Crashlytics/Firebase Performance, hay khi production bug thiếu dữ liệu chẩn đoán. Bỏ qua UI thuần không có failure mode và code chỉ chạy trong test/script.
---

# Observability & Instrumentation

## Trước khi thêm signal

Viết câu hỏi chẩn đoán/on-call cụ thể. Mỗi signal phải trả lời một câu hỏi; không map được thì không
emit. Dùng signal nhỏ nhất:

- Metric: lỗi xảy ra bao nhiêu/rate nào.
- Trace: latency hoặc failure nằm ở stage nào.
- Log/breadcrumb: vì sao một instance thất bại.

Không bịa threshold, percentile hoặc alert budget. Dùng gate/measurement/owner requirement thật.

## Contract

- Event/key ổn định, machine-readable; label/cardinality từ tập nhỏ như format/reason.
- Không dùng user id, full path, URI, free-form error text hoặc document content làm metric label.
- Không log PII, secret, token, credential, file content hay path lộ danh tính.
- Correlation ID chỉ khi cần nối flow; phải ngẫu nhiên/opaque và không chứa PII.
- Severity phản ánh action: error cho lỗi actionable, warning cho degraded/expected risk, info cho mốc
  nghiệp vụ, debug chỉ dev.

## Crashlytics

Classify trước `recordException`. Network/offline, permission denial, user error hoặc platform noise đã
được codebase phân loại thì dùng pattern hiện có và giữ breadcrumb phù hợp; không tạo classifier mới
khi đã có. Chỉ report exception bất ngờ/actionable. Không swallow lỗi chỉ để dashboard sạch.

Với auth/cloud/file/permission path, review Security/Privacy và mọi entry point. Firebase/SDK behavior
phải verify bằng official docs hoặc Context7.

## Verification

Trong debug/staging phù hợp, gây một success/failure có kiểm soát và xác nhận signal xuất hiện, field đã
redact, correlation nối đúng và duplicate/noise không tăng. Nếu thiếu device/dashboard/access, báo
residual; compile hoặc unit test mock không chứng minh telemetry production hoạt động.

Liên kết: [[rulebook/16-security]] · [[rulebook/20-error-handling-di-nav-build]] · [[rulebook/46-firebase]] · [[knowledge/crashlytics_oom_alert]] · [[knowledge/logcat_noise_filter]].
