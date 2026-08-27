# 34 — PDF Rendering

## Discovery

Không dùng code mẫu trong rulebook như API thật. Resolve renderer/writer/cache hiện tại bằng graph-first,
trace lifecycle/caller và đọc source. Android/PDF library behavior phải verify bằng official docs hoặc
test của version pin trong repo.

## Rendering contract

- Open document/page resources với ownership rõ và close ở mọi success/error/cancellation path.
- Render/decode ngoài main thread; UI state update trên dispatcher/lifecycle đúng.
- Không render toàn bộ document hoặc giữ bitmap không giới hạn. Allocation/cache/tile strategy phải dựa
  viewport, heap pressure và benchmark/fixture thật.
- Validate page index, dimensions, zoom, cancellation và malformed/encrypted/corrupt input trước native
  boundary.
- Dispose/idempotency phải chịu được navigation, config change, process recreation và callback đến muộn.
- Native/OOM failure không được coi như `Exception` thông thường; verify current boundary và recovery UI.

## Writing/scanner contract

- Chọn writer/encoding theo observable output requirement và implementation thật trong repo; không mặc
  định một writer phù hợp mọi image/text/vector PDF.
- Stream hoặc release intermediate bitmap sớm; không giữ cả session nếu pipeline có thể incremental.
- Quality/file-size/latency trade-off phải đo trên representative fixture. Không dùng bảng size/quality
  ước tính làm acceptance.
- Flush/close output atomically; partial/cancelled write không được masquerade thành success.

## Verification

Chọn theo failure mechanism: unit test cho bounds/state, integration/native test cho render/write,
device/logcat cho lifecycle/UI/native crash, benchmark/gate hiện có cho performance. Include malformed,
empty, large/high-resolution, rotation/navigation và cancellation chỉ khi applicable. Threshold phải từ
User, current gate hoặc measurement plan.

Không thay file-parsing/rendering strategy hoặc public/module contract nếu chưa có explicit approval.
Liên kết: [[rulebook/04-core-performance]] · [[rulebook/12-threading-async]] ·
[[rulebook/38-lifecycle-config-changes]] · [[rulebook/45-tdd-enforcement]].
