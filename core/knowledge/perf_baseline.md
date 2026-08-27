# Performance Baseline Registry

No numeric baseline is valid until produced by the current benchmark/gate on a named fixture/device/build.

For each accepted baseline record outside this template:

```text
Metric/oracle:
Scenario + fixture:
Device/API/build/variant:
Tool/command:
Warmup/iterations/statistic:
Measured value + raw artifact:
Threshold provenance (User/gate):
Date/commit:
```

Use Macrobenchmark/Microbenchmark/Perfetto/profiler or existing QA perf gates as appropriate. Do not use
log timestamps, skipped-frame folklore, emulator-only measurements or a single unbound number as a
release threshold. When code/fixture/device/tool changes, treat the old result as historical and measure a
new comparable baseline.

Performance regressions require an observable RED measurement and a post-fix run using the same protocol.
Missing measurement is `BLOCKED`/residual, not “within budget”.
