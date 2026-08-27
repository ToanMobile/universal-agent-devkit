# Rollback Runbook

## Trigger

Use current Play/Firebase/security evidence and the release-specific rollout policy. Do not reuse generic
crash/ANR/review percentages, hours or rollout steps from old incidents. Immediate data loss, exploitable
security issue, widespread startup/open failure or irreversible migration damage is a blocker regardless
of aggregate rate.

## Decision

1. Confirm affected version/variant, first/last seen, reachability and user impact.
2. Distinguish app regression from dashboard/device/network/test-infrastructure noise.
3. Choose halt rollout, rollback, hotfix or monitor using current store capabilities and owner-approved
   thresholds. Release/publish/rollout actions require explicit User authority.
4. Verify compatibility: installed data/schema, cached files, widget/deep link, auth state and downgrade
   support. Do not assume an older APK can read data written by the new version.

## Execution safety

- Never run store action, push, publish or destructive data operation from this runbook without the
  explicit request and exact target.
- Preserve evidence/artifacts and record commit/version, decision, operator and timestamps.
- Build/sign/upload from canonical release workflow; do not modify signing/config to make rollback easy.
- If downgrade is unsafe, halt rollout and issue a forward fix instead.

## Verify

Run the release/device gates applicable to the rollback/hotfix, then monitor the same symptom oracle that
triggered the decision. Report residuals and current dashboard links; prose/sign-off cannot replace gate
evidence.
