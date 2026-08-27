# Dependency Update Policy

## Prioritize by evidence

Classify updates by reachable security impact, build/runtime compatibility and task need. CVSS alone does
not prove app reachability; generic SLA hours/days are not project policy unless User/release process sets
them.

## Workflow

1. Read pinned version/catalog and every module using the dependency.
2. Read official release notes/advisory for current → target versions; verify affected symbols/config.
3. Trace reachable usage and transitive conflicts. For a security advisory, record package/version,
   reachable path and mitigation status without exposing credentials.
4. Prefer the smallest supported update. Do not bundle unrelated dependency upgrades.
5. Run targeted compile/tests and the integration/runtime checks required by the dependency surface.
6. Update lock/catalog/docs and remove obsolete compatibility code only when verified orphaned.

Major platform/plugin changes, module-boundary changes, release/signing behavior, auth/file-parsing policy
or new dependency beyond task authority must follow `AGENTS.md` approval rules. If no safe fixed version
exists, document mitigation/residual and ask for the policy decision; do not silently suppress the alert.

Use official docs/advisories or Context7 for behavior. Never infer “safe”, “no breaking changes” or
performance improvement from version number alone.
