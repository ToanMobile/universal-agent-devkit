# 19 — Documentation & Resources

- Document why, invariant, ownership, failure mode and non-obvious trade-off; do not restate code.
- Public API docs describe observable contract, nullability, threading/cancellation, errors and resource
  ownership. Do not promise latency/heap/size without a measured source.
- Code/file/API/line/version references must be verified current. Prefer stable path/symbol over stale line
  number.
- External behavior links to official docs/release notes for the pinned version.
- Android strings/colors/dimensions/icons use resources/design tokens and localization conventions; do not
  hardcode user-visible text.
- Update docs in the same task when public behavior, command, gate, path or operational runbook changes.
- Remove obsolete generated/sample guidance rather than preserving misleading examples.

Long-lived decision belongs in ADR/knowledge; reusable gotcha in memory; in-progress state in plan/handoff.
