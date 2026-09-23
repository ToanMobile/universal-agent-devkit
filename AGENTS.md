# AGENTS.md — Master Rules & Universal Multi-Agent Architecture

Shared baseline and **Single Source of Truth (SSOT)** for 4 core AI coding platforms: **Claude Code (Anthropic)**, **OpenAI Codex / ChatGPT Canvas**, **Antigravity (Google / Gemini)**, and **Cursor IDE**.

---

## 1. Project Architecture & Modularization

**Project Type:** Modular Architecture & Clean Engineering Practices.
Every repository adopting this framework follows Clean Architecture, Unidirectional Data Flow, strict separation of concerns, and testability.

### 1.1 Architecture Baseline
- **Core Layer:** Shared primitives, domain models, utility abstractions, dispatchers, analytics, test rules.
- **Feature Layer:** Isolated feature modules/packages, UI components, ViewModels/StateHolders.
- **Infrastructure / Data Layer:** Storage, database, network clients, external integrations.
- **Engine / Libs Layer:** Performance-critical algorithms, parsers, low-level bindings.

---

## 2. Slash Commands & Skills Router

All automated skills reside in `.agents/skills/` (SSOT) or are loaded directly via the DevKit Plugin:

| Slash Command / Alias | Canonical Skill Path | Description / Trigger | Primary Scope |
|---|---|---|---|
| `/qc`, `/test`, `/qa` | [qc](skills/qc/SKILL.md) | Automated testing, lint checks, unit tests, and QA release gates | Test / Build Gates |
| `/deploy`, `/build` | [deploy](skills/deploy/SKILL.md) | Build binaries/bundles, verify ProGuard/R8/bundling, release checks | Build / Deploy |
| `/fixbugs`, `/bugs`, `/fix`, `/crashlytics` | [fixbugs](skills/fixbugs/SKILL.md) | Standard bug-fixing with Paired Executable Oracle (RED→GREEN) & Crashlytics/ANR triage | Repro / Fix / Verification |
| `/plan` | [spec-driven-development](skills/spec-driven-development/SKILL.md) | Spec-driven plan for changes ≥3 files or ≥2 modules | Spec / Plan / Tasks |
| `/scan` | [security-checklist](skills/security-checklist/SKILL.md) | Security audit: Input validation, URI/Permissions, Secrets, Auth | Security Gate |
| `/tdd` | [tdd-workflow](skills/tdd-workflow/SKILL.md) | TDD Workflow: Write failing RED test before implementation logic | Test-First |
| `/verify` | [verification-before-completion](skills/verification-before-completion/SKILL.md) | Verification gate before declaring task completion | Verification Gate |
| `/conflict` | [merge-conflict-resolver](skills/merge-conflict-resolver/SKILL.md) | Resolve Git merge / rebase / cherry-pick / stash conflicts | Git 3-way merge |
| `/handoff` | [session-handoff](skills/session-handoff/SKILL.md) | Transfer work-in-progress context across sessions | Session Handoff |
| `/graph`, `/codebase-memory` | [codebase-memory](skills/codebase-memory/SKILL.md) | Explore codebase, trace call flow, blast radius, AST knowledge graph & Cypher | Codebase Navigation & Graph |
| `/review`, `/qa-review` | [qa-review](skills/qa-review/SKILL.md) | Audit diff before PR, acceptance criteria, test scenario matrix | Code / PR Review |
| `/ocr`, `/open-code-review` | [open-code-review](skills/open-code-review/SKILL.md) | Alibaba OpenCodeReview: Deterministic line resolver, file bundling, code audit | Automated Diff Review |
| `/visual`, `/qa-visual` | [qa-visual](skills/qa-visual/SKILL.md) | Automated screenshot capture and DOM layout audit | Visual UI QA |
| `/audit-gate`, `/postfix-gate` | [audit-gate](commands/audit-gate.md) | Post-fix 5-layer audit, anti-laziness, DESIGN.md a11y, and TIA checklist | Post-Fix Quality Shield |

---

## 3. Role & Language

- **Default Communication Language:** User-facing replies are in **English** by default, concise, and evidence-backed.
- **Language Switch Option (Vietnamese / Multilingual):** When `--lang=vi` is configured, or whenever the user communicates or requests in **Vietnamese** (or another language), the agent seamlessly responds in that preferred language.
- Code identifiers, commands, file paths, and commit subjects ALWAYS stay in **English**.
- **TASK COMPLETION CARD:** After every progress update, checkpoint, reviewer finding, or failed investigation path, automatically continue the remaining work until the full assigned scope reaches a valid terminal state. Progress updates are not final responses; never prompt the user to type `continue`.

---

## 4. Priority

1. User instruction in the current task.
2. This `AGENTS.md` (Master Rules & Universal Multi-Agent Architecture).
3. Project contracts, commands, and memory.
4. Existing code patterns and tests.

---

## 5. Pre-Code Gate (Run before the first Edit/Write)

Five boxes. If any cannot be filled, you are **NOT** allowed to write code yet — collect evidence or escalate as a labeled hypothesis:

1. **Target + authority** — what you change and which authority covers it (a: verified error, b: necessity, c: user-instructed).
2. **Real source read** for the exact area you touch — read the file directly, never trust stale cache.
3. **Consumer list** if you touch a signature, base-class member, public API, or shared object — **including tests**.
4. **Failure mechanism + how you will prove the fix changes observable behavior** — decided BEFORE editing.
5. **Residual** — what will stay unverified, and why.

Risky flow (crash fix, parsing, auth, navigation, lifecycle, security/privacy, module boundary, 2+ modules): boxes 1–5 must be reviewed BEFORE code is written.

### 5.1 Plan Convergence & Human Gates
**Review the PLAN to convergence before writing code. Code is the LAST step, not the first.**
Required order: plan → reviewer approves the *plan* → gaps found → revise plan and review AGAIN → no gaps left → **GATE 1: User approves the plan** → **write the RED test FIRST** → only then code → green + review on diff → **GATE 2 (Narrow Scope)**.

- **Gate 1:** Applies to work crossing planning threshold (≥2 modules, ≥3 files, >200 LOC net diff, or risky flow) or approval boundary.
- **Gate 2 (Strict Narrow Scope):** Applies ONLY when touching:
  (a) Approval boundary (auth policy, billing, destructive migrations, global architecture);
  (b) Attack surface narrowly defined by security gates;
  (c) Irreversible external action (commit/push/PR, release/publish, deleting shared device/server state);
  (d) Meta-tooling or rule files (`AGENTS.md`, `scripts/qa`).
  Inside this scope, Gate 2 is a full STOP. Outside this scope, issue the verdict and carry on.

---

## 6. Non-Negotiable Rules

- **No fabrication:** Do not invent file paths, APIs, line numbers, metrics, dates, versions, root causes, test results, or past actions.
- **Verify BEFORE speaking:** Do not state conclusions or diagnoses before evidence is collected — say "checking X" instead of provisional claims.
- **PAIRED EXECUTABLE ORACLE (bắt buộc cho mọi bug fix — không có waiver / mandatory with no waiver):** Trước khi sửa bất kỳ dòng code production nào, phải thực thi một oracle ở failure boundary thật và quan sát RED; sau khi sửa, thực thi lại cùng oracle và quan sát GREEN. Compile chỉ hợp lệ khi chính acceptance là lỗi compile/build failure.
- **Discriminating Evidence:** Root cause requires discriminating evidence (pass/fail contrast), not mere source-reasoning.
- **Statement Decision Table:**
  - **C1:** Structural fact from source → Fresh source/graph output.
  - **C2:** Version/metric/hash/docs → Tool measurement or official doc.
  - **C3:** Consequence/runtime/fix works → Discriminating evidence cited inline.
  - **C4:** Negative/scope claim ("X unaffected") → Broad search scaled to claim risk.
  - **C5:** Past action / fix outcome → Exit-0 tool call + before/after repro.
  - **C6:** Preference/trade-off → Labeled suggestion with verified reasons.
  - **C7:** Hypothesis → Labeled hypothesis + discriminating test needed.
  - **C8:** Future estimate → Labeled "unverified estimate".
  - **C9:** Unknown / data missing → Explicit statement of missing data/tool.
- **Anti-Loop:** After 2 failed fixes for the same root cause, STOP and abandon the failing hypothesis; change approach.
- **Protection of Working Code:** Working code is protected. Touch only with: (a) real evidence of error, (b) unavoidable necessity for the task, or (c) explicit user instruction.
- **Surgical Changes:** No drive-by refactoring, formatting sweeps, or gratuitous abstractions.

---

## 7. Multi-Agent Integration Guide

`AGENTS.md` is the universal, open industry standard for AI coding agents. The 4 supported platforms natively consume this single file:
- **Claude Code (Anthropic):** Reads `AGENTS.md` at project root, loads `.claude-plugin/plugin.json`, executes slash commands, and enforces safety hooks.
- **OpenAI Codex / ChatGPT:** Reads `AGENTS.md` as project instructions and coding guidelines.
- **Antigravity (Google / Gemini):** Reads `AGENTS.md` at project root and discovers skills in `.agents/skills/*/SKILL.md`.
- **Cursor IDE:** Natively reads `AGENTS.md` from the project root for workspace rules.
- **Synchronization:** Run `./bin/agent-kit sync` anytime skills, commands, or hooks are updated.

---

## 8. Universal Zero-Regression & Autonomous Intent Router

Synthesizing the foundational methodologies of `obra/superpowers` (Anti-Rationalization, Rulings-not-stalls, strict TDD), `alirezarezvani/claude-skills` (Surgical Scoping, Context-First), and `alibaba/open-code-review` (Deterministic Line Resolution, Zero-Noise Review):

### 8.1 Autonomous Pipeline (Zero-Effort for Developer)
Whenever the user asks to fix a bug, refactor code, or change behavior in a complex codebase, the agent MUST automatically execute this multi-phase loop without requiring manual skill invocation:

1. **Anti-Rationalization Gate:** STOP any thought of "this is a trivial fix" or "I don't need tests". Every change to shared flows, central dispatchers, base classes, or middleware carries high regression risk.
2. **Blast Radius & Call-Site Audit:**
   - Automatically inspect 100% of inbound callers using AST / MCP graph (`trace_path`) or grep BEFORE modifying shared functions.
   - Map all dependent components across modules, listeners, and background services.
3. **Surgical Scope (Zero Collateral Damage):**
   - If an issue occurs on a specific target client, tenant, platform, or app, isolate the fix strictly inside that condition (e.g., Strategy pattern, adapter, or `if (isTargetScope(...))`).
   - Leave default shared logic for other consumers 100% untouched.
4. **Preserve Immutable Platform & Legacy Guards:**
   - Never delete or relax legacy `if (...)` conditions established for OS versions, platform quirks, or historical edge-case fixes.
5. **Two-Way Regression Verification:**
   - Execute the targeted test for the fix (RED → GREEN).
   - Re-run the existing module test suite to verify all existing tests remain 100% GREEN. Never alter existing assertions to mask regressions.
6. **Deterministic Review with OpenCodeReview (`ocr`):**
   - Run `ocr review` or `ocr delegate preview` to audit the diff before declaring completion.

> **Modular Domain Packs:**
> Domain-specific and project-specific rules (such as Automotive Hardware, FlymeAuto, or CAN Bus specifics) are kept isolated in `domain-packs/` (e.g. `domain-packs/automotive/`) to keep the DevKit core 100% universal and domain-agnostic.

### 8.2 Autonomous Skill Routing Matrix (Bảng Điều Phối Tự Động Toàn Bộ 23 Kỹ Năng - Zero Manual Effort)
AI Agent BẮT BUỘC PHẢI TỰ ĐỘNG nhận diện ngữ cảnh và kích hoạt các kỹ năng sau ĐỘC LẬP TỰ ĐỘNG, TUYỆT ĐỐI KHÔNG bắt người dùng phải gõ lệnh slash command hay chạy bằng tay. Người dùng (Senior Dev) chỉ cần đưa ra yêu cầu tự nhiên, hệ thống tự động điều phối toàn bộ:

| Giai Đoạn Vòng Đời | Kỹ Năng Tự Động Kích Hoạt | Ngữ Cảnh / Tình Huống Kỹ Thuật Tự Động Kích Hoạt | Hành Động Tự Động Của Agent |
|---|---|---|---|
| **0. Gateway & Context** | `context-enricher` | **MỌI YÊU CẦU ĐẦU VÀO / PROMPT NGẮN CỦA USER** | **CỔNG BẮT BUỘC:** Tự động mở rộng 5 chiều: dò tìm AST/Graph, nạp active profile, bẫy instincts, tiêm yêu cầu ngầm định (debounce >= 1000ms, a11y >= 48dp, non-blocking main thread, mask PII, paired oracle). |
| **0. Gateway & Context** | `session-handoff` | Phiên làm việc dài, context window > 50%, trước refactor lớn | Tự động tóm tắt tiến độ (checkpoint), dọn sạch ngữ cảnh thừa, chống suy thoái năng lực suy luận. |
| **1. Discovery & Arch** | `codebase-memory` | Khám phá dự án, tìm symbol, hàm, route, truy vết blast radius, Cypher | **SSOT ĐỒ THỊ:** Tự động resolve symbol, trace inbound/outbound callers, truy vấn Cypher, hoặc fallback Read/Grep an toàn. |
| **1. Discovery & Arch** | `spec-driven-development` | Tính năng mới phức tạp chạm $\ge 2$ module, $\ge 3$ files hoặc > 200 LOC | Tự động soạn thảo spec kỹ thuật, phân tích assumptions và edge cases trước khi code. |
| **1. Discovery & Arch** | `grill-plan` | Kế hoạch có rủi ro kiến trúc cao, thay đổi shared flow | Tự động phản biện đối lập, stress-test kế hoạch, tìm lỗ hổng kiến trúc trước khi code. |
| **1. Discovery & Arch** | `documentation-and-adrs` | Quyết định kiến trúc, chọn pattern/thư viện, đổi data model | Tự động tạo hồ sơ ADR (Architecture Decision Record) lưu trữ rationale và trade-offs. |
| **1. Discovery & Arch** | `deep-module-design` | Thiết kế interface, seam kiểm thử, phân tách trừu tượng | Tự động đánh giá interface sâu, tính đóng gói, Dependency Inversion (DIP) và mockability. |
| **2. Dual-Agent Orchestration** | `giao` | Tác vụ code phức tạp khi Claude Code đóng vai Leader PM | Tự động kích hoạt quy trình 7 giai đoạn: Task ➔ Plan ➔ Review ➔ Implement ➔ Audit ➔ Test ➔ Proof ➔ Accept. |
| **3. Implementation & TDD** | `fixbugs` | Sửa mọi loại lỗi / bug, Crashlytics, stack trace, ANR traces.txt | **PAIRED ORACLE & INCIDENT TRIAGE:** Bóc tách stack trace, phân loại failure mechanism, bắt buộc Paired Oracle (RED ➔ GREEN). |
| **3. Implementation & TDD** | `tdd-workflow` | Viết logic nghiệp vụ mới có thể kiểm thử (testable) | Tự động viết unit/integration test trước khi viết code logic (RED-first). |
| **3. Implementation & TDD** | `incremental-implementation` | Thay đổi nhiều file hoặc task khó kiểm chứng trong 1 bước | Tự động chia nhỏ thành các bước phẫu thuật tăng dần, kiểm chứng liên tục từng bước. |
| **3. Implementation & TDD** | `deprecation-migration` | Sunset API cũ, xóa code cũ, di trú schema CSDL | Tự động rà soát callers, lập kế hoạch di trú 3 pha (Soft ➔ Hard ➔ Sunset), bảo toàn tương thích. |
| **3. Implementation & TDD** | `security-checklist` | Thay đổi Intent, URI, auth, permissions, WebView, secret | Tự động rà soát bề mặt tấn công, nguyên tắc quyền tối thiểu, che giấu credential trần. |
| **3. Implementation & TDD** | `observability-instrumentation` | Thêm log, metric, trace, chẩn đoán lỗi thiếu dữ liệu | Tự động chuẩn hóa structured logging, phân cấp DEBUG/INFO/ERROR, mask 100% PII. |
| **3. Implementation & TDD** | `writing-skills` | Tạo mới hoặc chuẩn hóa Skill / Rules cho Agent | Tự động tuân thủ cấu trúc YAML frontmatter, mô tả ngữ cảnh kích hoạt và quy chuẩn kebab-case. |
| **4. Device & Visual QA** | `android-real-device-qa` | Kiểm thử Android trên thiết bị thật / máy ảo emulator | Tự động đo FPS SurfaceFlinger, dump view hierarchy XML, triage ANR logcat, quét DEX. |
| **4. Device & Visual QA** | `qa-visual` | Kiểm tra giao diện, audit layout, chống vỡ màn hình | Tự động audit tràn khung, lệch align, touch target >= 48dp, upload screenshot lên R2. |
| **4. Device & Visual QA** | `qa-review` | Chuẩn bị trước khi tạo PR / bàn giao Tech Lead | Tự động chất vấn diff, tạo acceptance criteria kiểm chứng được và dựng ma trận test scenario. |
| **5. Acceptance & Delivery** | `merge-conflict-resolver` | Xung đột git khi merge, rebase, cherry-pick | Tự động phân tích AST và ngữ cảnh để giải quyết xung đột mà không làm mất mát logic. |
| **5. Acceptance & Delivery** | `qc` | Chạy bộ kiểm thử tự động, lint check (ktlint), unit test | Tự động thực thi toàn bộ test runner, Translation gate, và Metalava API check. |
| **5. Acceptance & Delivery** | `open-code-review` | Soát mã nguồn tự động trước khi bàn giao | Tự động chạy phân tích hunk tất định (Alibaba OCR), quét rò rỉ bộ nhớ và code lười biếng. |
| **5. Acceptance & Delivery** | `verification-before-completion` | Trước khi tuyên bố Xong / Pass / Hoàn tất | Tự động chạy cổng kiểm toán `postfix-gate` 8 lớp, kiểm tra máy thật và SHA-256 visual proof. |
| **5. Acceptance & Delivery** | `deploy` | Đóng gói APK/AAB, kiểm tra signing, xuất bản release | Tự động kiểm tra chứng chỉ ký (signing key), version bump và sẵn sàng phát hành. |


### 8.3 The 10 Quality Audit Councils (50 Specialized Agents)
The DevKit provides a multi-lens audit council organized in `agents/councils/`:
- **Council 1 — Subsystem & Shared Flow Isolation (5 Agents):** Shared flow surgical isolation, legacy platform guards preservation, shared resource & session arbitration, hardware event & interrupt throttling, multi-window & responsive boundary.
- **Council 2 — Architecture & Blast Radius (5 Agents):** AST inbound caller tracing, circular dependency detection, clean layered architecture, API contract breaking, dead code zombie scanning.
- **Council 3 — Zero-Defect & TDD (5 Agents):** Paired executable oracle enforcement, regression matrix orchestration, assertion integrity, flaky test hunting, mutation coverage.
- **Council 4 — Deterministic Code Review (Alibaba OCR) (5 Agents):** Hunk position resolver (`resolver.go`), semantic file bundling, zero-noise precision filtering, suggested diff verification, delegation bridge.
- **Council 5 — Security & Vulnerabilities (5 Agents):** Raw secret/credential leak hunting, IPC/Intent security, data exfiltration detection, OWASP Mobile & API Top 10, tamper defense.
- **Council 6 — Game Engine & 3D Assets (Unity & Blender) (5 Agents):** Mono GC memory leaks, draw call batching & UI canvas, scene hierarchy integrity, Blender poly count & mesh topology, game asset memory budget.
- **Council 7 — Performance, ANR & Thermal (5 Agents):** Main thread blocking (>16ms/ANR), frame drop jank, battery drain & thermal throttling, bitmap OOM prevention, Binder transaction limits (1MB).
- **Council 8 — Tiered Memory Governance (L0-L3) (5 Agents):** Session trace harvesting, recurrence pattern promotion, on-demand domain context routing, master rulebook bloat control, anti-rationalization policing.
- **Council 9 — Solo Dev & Operational Process (5 Agents):** Anti-spam click & debounce verification, mandatory acceptance screenshot with PASS badge, audit trail logging, DEMO vs LIVE isolation, fail-closed receipt signing.
- **Council 10 — Standards Compliance & Delivery (5 Agents):** Bidirectional requirement traceability, protocol & data stream integrity, accessibility & UX visual safety, offline resilience & fault tolerance, Tech Lead handover formatting.

### 8.4 Engineering Excellence & Failure Prevention
- **`DESIGN.md` Design System Baseline:** Every UI change adheres to the semantic color tokens, 8pt/4px typography grid, and accessibility touch target ($\ge 48\times 48\text{dp}$ / $\ge 44\times 44\text{px}$) defined in `DESIGN.md`.
- **Instincts & Failure Memory (`.agents/instincts.md`):** Traps, anti-patterns, and past regressions are recorded so that the agent never falls into the same mistake twice.
- **Triết lý Kỹ sư Già "Lười biếng" (Lazy Senior Dev Principle):** Always reuse internal utilities before creating new ones; avoid dependency bloat; celebrate negative net diff (deleting dead code).
- **Anti-Laziness & File Integrity:** Strictly prohibit `// ... existing code ...` or placeholder omissions; enforce full contiguous block replacement and backward compatibility.
- **Compiler AST Self-Healing:** Parse compiler diagnostic logs to extract exact `file:line:col`, error codes, and caller blast radius to fix build issues methodically.

Health Diagnostic Command:
```bash
./bin/agent-health.py
```
