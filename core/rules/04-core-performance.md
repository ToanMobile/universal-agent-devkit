# 04 — Core Performance

## Measurement first

Do not optimize or set budgets from generic frame/heap/file-size numbers. Define the user-visible oracle,
fixture, device/build, tool and threshold provenance; capture a baseline before changing code.

## Hot-path rules

- No blocking I/O, parsing, bitmap/native allocation or unbounded loop on main thread.
- Bound count/dimensions/recursion before allocation; use overflow-safe arithmetic for untrusted file data.
- Stream/window large input where current parser contract supports it; changing parsing strategy requires
  explicit approval.
- Avoid per-item allocation/string conversion in tight loops when profiler/benchmark identifies it.
- Cache only with ownership, key validity, memory bound and invalidation/cleanup defined.
- Cancellation/checks must have a real production trigger; dead cooperative checks are not a fix.
- Close/recycle native, file, cursor, page and bitmap resources on success/error/cancel; cleanup idempotent.

## Evidence

- Use graph/source to trace caller → hot path → allocation/I/O → cleanup.
- Use benchmark/profiler/Perfetto/device gate matching the failure. Unit tests can prove bounds/state but
  not runtime latency or heap behavior.
- Compare before/after with the same protocol and retain raw artifact. Missing threshold/fixture/device is
  residual, not PASS.
- Release work must pass current prerelease/large-file gates; do not bypass or substitute a small file.

Do not add speculative pooling, tiling, cache or concurrency without measured need and lifecycle tests.
