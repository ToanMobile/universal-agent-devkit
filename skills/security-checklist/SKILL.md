---
name: security-checklist
description: Dùng khi đổi external Intent/URI/file handling, exported component, permission, WebView, auth/cloud, network security, telemetry privacy hoặc trước release/security review. Bỏ qua UI thuần và rename không đổi behavior.
---

# Android Security Checklist

Adapter cho `/scan` và rulebooks canonical:
[[rulebook/16-security]] · [[rulebook/33-deep-linking]] · [[rulebook/35-file-permissions]] ·
[[rulebook/30-r8-proguard]] · [[rulebook/49-supabase]] · [[rulebook/46-firebase]].

## Surfaces bắt buộc

- **Intent/deep link/content URI:** validate action, scheme/authority/type, required extras, permission và
  size/format bằng API đáng tin cậy; không tin filename/extension/path thô. Chặn traversal/canonical
  escape và xử lý revoked grant.
- **Exported components/FileProvider:** mỗi component export phải có lý do, narrow intent-filter và
  permission/validation tại entry point. FileProvider dùng `${applicationId}` authority, least-privilege
  paths, không `root-path` rộng.
- **File parsing:** input untrusted; enforce guard có provenance, bounded allocation/recursion, cleanup
  và error classification. Thay file-parsing strategy cần User approval.
- **WebView:** JavaScript/file/content/universal access off trừ khi requirement đã verify; JavaScript
  interface và navigation origin phải allowlist.
- **Auth/cloud/storage:** secret/service credential không nằm client/repo/log. Verify Supabase RLS/auth
  policy và SDK behavior bằng official docs/Context7; auth policy change cần approval.
- **Permissions/network:** least privilege, denial/revocation handled, release cleartext disabled.
- **Telemetry:** không PII, token, document content, URI/full path; custom key/label cardinality bounded.
- **Dependencies/R8:** pinned dependencies, no unreviewed snapshot/dynamic version, mapping/keep rules
  không leak artifact hoặc keep quá rộng.

## Audit method

Code discovery graph-first cho handlers/callers; dùng Read/Grep cho Manifest, XML, Gradle, config và
literal. Mỗi finding phải có source evidence, reachable attack path, impact và severity; grep match đơn
thuần chưa phải vulnerability. Không in secret value trong output.

Fix surgical theo pattern đã verify; dependency/library behavior phải dựa official docs. Authority theo
`AGENTS.md`/`AGENTS.md`.

## Verification

- Targeted tests cho malicious/denied/malformed/oversized input và từng exposed entry point.
- Manifest/config merge hoặc release variant phải verify đúng variant; debug config không chứng minh
  release-safe.
- Trước release chạy `bash scripts/qa/ci/verify_prerelease_gates.sh`; không bypass large XLSX/search
  gates. Chỉ báo PASS khi command thật exit 0.
- Thiếu device, backend/RLS access hoặc release credential thì báo residual, không gọi CLEAN.
