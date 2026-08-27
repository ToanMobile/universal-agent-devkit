---
name: triage-crashlytics-bug
description: Dùng khi input là Crashlytics stack trace, production bug chưa rõ root cause hoặc bug cần deep audit. Bỏ qua bug local đã biết nguyên nhân; dùng /fix light mode.
---

@.Codex/rulebook/14-null-safety.md
@.Codex/rulebook/20-error-handling-di-nav-build.md
@.Codex/rulebook/44-systematic-debugging.md
@.Codex/rulebook/45-tdd-enforcement.md

# Triage Crashlytics Bug

Adapter cho `/fix` deep mode; `/fix` là nguồn canonical cho terminal verdict, audit loop và authority.

## 1. Identify

- Parse exact exception/frame; capture version, variant, fatal/non-fatal/ANR, device/OS, first/last
  seen, affected versions, breadcrumbs/keys và frequency nếu input thật có. Field thiếu ghi
  `unavailable from input`; không bịa dashboard data.
- Deobfuscate chỉ khi mapping thật tồn tại và khớp build.
- Code discovery graph-first: resolve symbol → trace caller/callee → read snippet. Fallback Read/Grep cho
  literal/config/generated hoặc graph thiếu evidence.
- Nếu không resolve được symbol/R8 mapping hoặc nhiều candidate ngang bằng làm đổi scope, hỏi User.

## 2. Reproduce và hypothesize

Liệt kê scenario theo failure mechanism liên quan: lifecycle/config/process death/concurrency; network;
permission/external URI; malformed/empty/large input; native/file/data integrity. Loại scenario phải có
evidence, không checklist máy móc.

Chốt hypothesis từ stack/log/source/repro. Liệt kê mọi assumption ngoài file sửa và verify caller,
ordering, dispatcher/lifecycle, framework/library hoặc permission contract bằng graph/source, official
docs hay test. Assumption thiếu evidence không được dùng làm fix rationale.

## 3. Safe RED → GREEN

Theo `.Codex/rulebook/45-tdd-enforcement.md`: mỗi distinct failure mechanism dùng **PAIRED EXECUTABLE ORACLE**
bắt buộc, chạy cùng acceptance/scenario/oracle/execution identity RED trước production edit và
GREEN sau edit. Unit không phù hợp thì dùng integration, instrumented/device hoặc runtime trigger fresh.
Crashlytics/report/log/baseline cũ chỉ discovery; không thay pre-run và không có waiver. Không
xóa/revert implementation hoặc dirty work để tạo RED; chỉ dùng artifact read-only/isolated copy. Không
có safe pre-run thì `BLOCKED` trước production edit.

Implement fix surgical, matching existing pattern. Không thêm primitive/callback/check nếu không trace
được production path kích hoạt nó.

## 4. Audit và memory

Chạy targeted compile/test/static/runtime evidence theo risk và `/fix`; mandatory lens theo domain
(concurrency, architecture, UX/runtime, security/privacy). Không gọi compile/mock test là bằng chứng
runtime. Verdict chỉ `CLEAN`, `VERIFIED_WITH_RESIDUALS`, `BLOCKED`, `FAILED` hoặc `ESCALATE` theo
evidence thật.

P0/P1/P2: tạo memory + update `.Codex/memory/INDEX.md`. P3/noise chỉ tạo khi có reusable prevention
pattern. Không dismiss/swallow exception chỉ để giảm noise; giữ classification/telemetry phù hợp.

Không commit/push hoặc hỏi commit nếu User chưa yêu cầu rõ.

$ARGUMENTS
