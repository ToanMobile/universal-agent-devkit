# 11 — Analyzer Enforcement

- Run analyzer/style task configured for the touched module and risk: compile, ktlint, detekt, lint,
  Compose reports or native/static tools as applicable.
- Only current task output with exit code/report is evidence. IDE hints, stale report and another module's
  clean result are not PASS.
- Compare against baseline when the tool supports it; new finding in task-owned code must be fixed or
  rejected with evidence. Do not suppress broadly or edit baseline to hide a finding.
- Numeric targets (coverage, stability, warning count, performance) are enforced only by a real current
  gate or User acceptance.
- Analyzer success cannot prove runtime, device, lifecycle, security or performance behavior.
