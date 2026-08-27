# Pre-Release Checklist

## Automated evidence

Run on the release commit:

```bash
bash scripts/qa/ci/verify_prerelease_gates.sh
python3 scripts/qa/orchestrators/qa.py
```

Both commands must exit `0` from a fresh run. Reports/state must bind to the current commit; stale,
missing, skipped or emulator-only evidence is not release evidence.

Physical-device evidence is local/user-run because the project has no self-hosted device runner.
The hosted workflow must not represent a missing physical matrix as green release evidence.

Do not bypass the fail-closed large XLSX/search gate (`d3b_large_xlsx`) or widget upgrade-path gate.
Exact gate inventory, thresholds and artifact paths live in current scripts and `scripts/qa/README.md`;
this checklist does not duplicate them.

## Solo-owner review

Project currently has one owner, so no artificial four-eyes signature is required. Before release, the
owner must still record:

- Release commit/version and generated report paths.
- Automated gate verdicts from the current run.
- `/scan` findings resolved/rejected with evidence.
- Manual/device flows that are applicable but not automated, with device/build/oracle.
- Known residuals and explicit rollout/rollback decision.

Missing evidence is `BLOCKED`; a signature or prose cannot replace an executable gate.

## External prerequisites retained after engineering-plan closure

Before a production candidate can be described as release-ready, the owner must supply and verify:

- release signing/configuration and a fresh candidate manifest binding commit, clean tree, artifact
  hash and signer;
- fixture-owner Crashlytics replay inputs plus their manifest for D10;
- a physical device that can execute the required locale probe, intent-injection, password-dialog,
  widget, format, performance and matrix checks;
- the active `armeabi-v7a` decision and deferred-device work in
  `plans/armeabi-v7a-32bit-support-2026-07-17/`;
- publish and rollout evidence after every executable prerelease gate passes.

Engineering checks run before those inputs exist are non-release evidence. Existing files under
`app/build/outputs` are not candidates unless a fresh manifest proves their provenance.

The engineering-plan closure on 2026-07-22 left these measured device prerequisites unresolved:

- D10 returned `INCOMPLETE` because the Crashlytics replay fixture/manifest was absent.
- S10 returned `INCOMPLETE` because locale readback stayed `vi-VN` on the available non-rooted
  handset.
- A first password-dialog run on `RFCW504KFKJ` was incorrectly called PASS because the legacy
  oracle only wrote rotation settings and then observed the same non-empty field. A discriminating
  follow-up on both `RFCW504KFKJ` and `RFCWA1KQT1Y` showed the display stayed at orientation `0`
  after requesting `1`; the activity remained portrait, so no rotation occurred. The gate now requires a display-orientation transition and the
  exact newly-entered field representation before/after it; current result is `INCOMPLETE`. Prevention:
  never infer configuration change from a successful settings write or field presence alone. This is
  not an Autofill assertion: `ReaderOfficeActivity` intentionally excludes descendants from Android
  Autofill.
- The hardened intent driver produced no crashes on the installed build, but all intent cases were
  `INCOMPLETE` on `RFCWA1KQT1Y` because that older build has no exact rejection/handling markers.
  The marker-enabled APK
  could not replace the installed package on either available handset because Android returned
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Re-run after a data-safe install path is authorized; do not
  uninstall an owner's app/data merely to turn this row green.

## Post-release

Monitor current Crashlytics/ANR/rollout signals using thresholds from Play/Firebase policy or an owner
decision recorded for that release. Do not reuse historic percentages/timelines as current limits.

Related: `/qa` · `/scan` · `.claude/knowledge/crashlytics_oom_alert.md` ·
`.claude/knowledge/rollback_runbook.md`.
