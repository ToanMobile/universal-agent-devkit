# 13 — Anti-Patterns

- Blocking I/O/heavy parsing/allocation on main thread.
- Unbounded allocation/loop/recursion from external file, URI, network or native data.
- Global mutable state or lifecycle object retained beyond owner.
- Coroutine launched without explicit scope/cancellation/exception ownership.
- Catching broad errors to hide failure, swallowing cancellation, or reporting expected noise as crash.
- `!!`, unchecked cast, path/permission assumption or fabricated framework guarantee at an external
  boundary.
- One-use abstraction, pass-through layer, premature caching/pooling or drive-by refactor.
- Magic number/line-count rule without project source, measurement or platform contract.
- Test that asserts implementation details, uses sleep/retry to mask races or passes with zero execution.
- Completion claim based on compile/mock/cache/stale report for a runtime outcome.

Validate reachability and impact before flagging. A pattern match is a candidate, not automatically a
defect.
