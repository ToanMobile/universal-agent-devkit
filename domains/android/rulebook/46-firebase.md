# 46 — Firebase

## Contract

- Verify Firebase SDK/API behavior against official docs for the pinned BOM/version.
- Apply consent before collection and keep analytics/ads signals separate per approved policy.
- Never log PII, secret/token, document content, content URI/full path or unbounded/free-form metric label.
- Crashlytics receives unexpected actionable failures; classify expected cancellation/network/permission/
  user errors first and retain safe breadcrumbs where useful.
- Remote Config defaults are safe/offline and typed; fetch failure cannot block critical app flow.
- Performance traces have balanced start/stop on success/error/cancel and stable low-cardinality attributes.

## Verification

Trace every emitter/caller graph-first, inspect config/literals directly, and verify controlled signals in
debug/staging. Console/device access missing is residual. Latency, event coverage, retention and alert
thresholds require current measured baseline/gate/owner policy; this rulebook defines none.

Auth/consent/collection policy, secret/credential and release behavior changes require authority under
`AGENTS.md`/`CLAUDE.md`.

Liên kết: [[observability-instrumentation]] · [[rulebook/16-security]].
