# 28 — Baseline Profiles

- Profile only representative critical journeys backed by current product/release needs.
- Keep selectors/synchronization deterministic; no fixed sleep or coordinates when semantic/state signal
  exists.
- Generate/verify with configured baseline-profile module and current release-like build.
- Check profile artifact is packaged and rules cover intended code path; stale generation success is not
  runtime evidence.
- Measure cold/warm startup or journey before/after using the same Macrobenchmark protocol/device class.
- Improvement and latency thresholds come from measured baseline/current gate/User, not generic targets.
- Profile changes do not replace correctness, device or release verification.
