<div align="center">

# 🚀 Universal AI Agent DevKit & Quality Protocol
### *Enterprise-Grade Engineering Standards, Zero-Defect Protocols, 50+ Rules & 45 Curated Skills*

[![GitHub Repository](https://img.shields.io/badge/GitHub-ToanMobile%2Funiversal--agent--devkit-blue.svg?style=for-the-badge&logo=github)](https://github.com/ToanMobile/universal-agent-devkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Tests Passing](https://img.shields.io/badge/Tests-294%20PASS%20(100%25)-success.svg?style=for-the-badge)](./hooks/tests)
[![Supported Agents](https://img.shields.io/badge/Agents-8%20Ecosystems-orange.svg?style=for-the-badge)](#-universal-multi-agent-matrix)
[![Rulebook](https://img.shields.io/badge/Rules-67%20Chapters-red.svg?style=for-the-badge)](#-complete-rulebook--engineering-standards-catalog)
[![Skills Catalog](https://img.shields.io/badge/Skills-45%20Curated-purple.svg?style=for-the-badge)](#-45-curated-engineering-skills-catalog)
[![MCP Servers](https://img.shields.io/badge/MCP-6%20Integrated-brightgreen.svg?style=for-the-badge)](#-mcp-model-context-protocol-hub)

<p align="center">
  <b>One DevKit to rule them all:</b> Elevate your AI assistants from conversational LLMs into rigorous, disciplined, and evidence-backed <b>Principal Pair Programmers</b>.
</p>

[Quick Start](#-quick-start--installation) • [Architecture](#-system-architecture) • [Multi-Agent Matrix](#-universal-multi-agent-matrix) • [Rulebook Catalog](#-complete-rulebook--engineering-standards-catalog) • [Skills Catalog](#-45-curated-engineering-skills-catalog) • [MCP Hub](#-mcp-model-context-protocol-hub) • [Verification](#-verification--test-evidence)

---

</div>

## 📖 Tổng quan (Executive Summary)

**Universal Agent DevKit** là framework chuẩn hóa toàn diện dành cho mọi AI Coding Agent (**Claude Code**, **Google Antigravity & Gemini**, **Cursor IDE**, **Windsurf**, **GitHub Copilot**, **Cline & Roo Code**, **OpenAI Codex**, **Aider**) và mọi mô hình nền tảng (**Claude 3.5/3.7 Sonnet**, **GPT-4o / o1 / o3**, **Gemini 2.0/3.0**, **DeepSeek R1/V3**, **Llama 3**).

DevKit cung cấp một hệ sinh thái khép kín:
1. **Quy chuẩn lập trình tối thượng:** Zero-Defect Protocol, Paired Executable Oracle, No-Fabrication Engine.
2. **Bộ Rulebook Đồ Sộ (67 Chapters):** 17 quy chuẩn Universal cốt lõi + 50 quy chuẩn chuyên sâu cho từng nền tảng (Android/Compose, Web, Backend).
3. **Tầng phòng thủ bằng máy (Machine Safety Gates):** 9+ lifecycle hooks và 160+ unit contract tests tự động bắt lỗi và chặn code ảo giác/phỏng đoán.
4. **Kho 45 Kỹ Năng Tinh Gọn (Curated Engineering Skills):** Phân thành 5 nhóm chuyên biệt bao quát 100% vòng đời phát triển phần mềm.
5. **Hệ sinh thái MCP Hub:** Tích hợp sẵn 6 MCP servers mạnh mẽ nhất cho AST Codebase Memory, Tra cứu Docs thực tế, Điều khiển thiết bị qua ADB, và Play Console.

---

## 🌟 6 Trụ Cột Chất Lượng Cốt Lõi (Core Pillars)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        UNIVERSAL AGENT QUALITY PROTOCOL                                │
├────────────────────────────┬────────────────────────────┬──────────────────────────────┤
│ 🛡️ Zero-Defect Protocol    │ 🚫 No-Fabrication Engine   │ 🔒 160+ Machine Safety Gates │
│ Paired Executable Oracle   │ Bảng quyết định C1-C9      │ Lifecycle Hooks chặn lỗi     │
│ (Bắt buộc RED → GREEN)     │ Không bịa số, dòng, metric │ Pre-Code & Stop Gates        │
├────────────────────────────┼────────────────────────────┼──────────────────────────────┤
│ ⚡ 7-Lens Multi-Audit      │ 📜 67 Rulebook Chapters    │ 🧰 45 Curated Skills         │
│ Compile, Runtime, State,   │ Universal + 50 Android     │ 5 nhóm chuyên sâu từ QA, TDD │
│ UX, Security, Architecture │ Domain Specialized Rules   │ đến Office Engines & DevTools│
└────────────────────────────┴────────────────────────────┴──────────────────────────────┘
```

<details>
<summary><b>🔍 Xem chi tiết 6 trụ cột chất lượng (Click để mở)</b></summary>

### 1. 🛡️ Zero-Defect Protocol & Paired Executable Oracle
- **Nguyên tắc bất khả xâm phạm:** Trước khi sửa bất kỳ dòng code production nào, Agent **bắt buộc phải thực thi một oracle kiểm thử** ở failure boundary thật và quan sát trạng thái thất bại (**RED**). Sau khi sửa code, thực thi lại đúng oracle đó và quan sát trạng thái thành công (**GREEN**).
- **Bảo vệ mã nguồn đang chạy đúng:** Mọi đoạn code hiện hữu mặc định được bảo vệ; cấm refactor tiện tay hoặc tự ý thay đổi contract không có bằng chứng lỗi.

### 2. 🚫 No-Fabrication Engine (Bảng Quyết Định C1–C9)
- **Triệt tiêu ảo giác:** Cấm tuyệt đối việc suy đoán file path, số dòng code, version thư viện, metric benchmark hoặc kết quả test.
- **Phân loại claim chặt chẽ:**
  - `C1`: Fact cấu trúc → Trích dẫn trực tiếp từ AST Graph/Source tươi.
  - `C2`: Phiên bản/API behavior → Đo kiểm hoặc tra cứu official documentation qua Context7.
  - `C3/C5`: Outcome / "Đã fix" → Bắt buộc có bằng chứng thực nghiệm phân biệt (discriminating evidence).
  - `C4`: Negative claim ("X không ảnh hưởng") → Bắt buộc search đối chiếu toàn bộ codebase.

### 3. 🔒 160+ Automated Safety Gates (Lifecycle Hooks)
- `precode_gate.sh`: Chặn sửa code nếu file chưa từng được đọc kỹ trong phiên làm việc.
- `review_gate.sh`: Bắt buộc thực hiện multi-lens review độc lập trước khi hoàn thành task.
- `test_evidence_gate.sh`: Kiểm tra trực tiếp file XML test kết quả trên ổ đĩa để xác thực `tests > 0, failures = 0, errors = 0`.
- `block-dangerous-git.sh`: Chặn đứng các lệnh Git phá hủy working tree.
- `churn_guard.sh` & `comment_claim_guard.sh`: Chặn sửa lặp lại một file quá 3 lần và quét claim sai trong code comment.

### 4. ⚡ 7-Lens Multi-Audit Engine
Hệ thống audit 7 góc nhìn độc lập (`multi-lens-audit.js`):
1. 🔬 **Compile-time Lens:** Type-safety, nullability, deprecation, binary compatibility.
2. ⚡ **Runtime Lens:** Resource leaks, memory allocation, OOM risk, boundary exceptions.
3. 🔄 **State & Concurrency Lens:** Race conditions, thread safety, state immutability.
4. 🧪 **Test Quality Lens:** Mutation coverage, boundary test cases, oracle precision.
5. 🎨 **UX & Accessibility Lens:** Visual hierarchy, a11y standards, responsiveness.
6. 🔒 **Security & Privacy Lens:** Intent injection, permission boundaries, credential safety.
7. 📐 **Architecture Lens:** Seam isolation, clean DI, unidirectional data flow.

</details>

---

## 📐 System Architecture

```mermaid
graph TD
    subgraph DevKit_Core ["📦 Universal Agent DevKit Core"]
        CoreRules["Core Protocols (AGENTS.md, CLAUDE.md)"]
        Rulebook["67 Rulebook Chapters (Universal + Android/Web)"]
        Gates["160+ Safety Gates & Lifecycle Hooks"]
        SkillsCatalog["45 Curated Engineering Skills"]
        Workflows["Multi-Lens Audit & Evidence Engines"]
        MCPHub["6-Server MCP Integration Hub"]
    end

    subgraph Adapters ["🔌 Multi-Agent Adapters"]
        Installer["bin/install.sh / agent-kit"]
    end

    DevKit_Core --> Installer

    Installer -->|Auto-Config| Claude["🤖 Claude Code<br/>(CLAUDE.md, .claude/hooks)"]
    Installer -->|Auto-Config| Gemini["✨ Google Antigravity & Gemini<br/>(AGENTS.md, .agents/skills)"]
    Installer -->|Auto-Config| Cursor["⚡ Cursor IDE<br/>(.cursorrules, .cursor/rules/*.mdc)"]
    Installer -->|Auto-Config| Windsurf["🌊 Windsurf / Cascade<br/>(.windsurfrules)"]
    Installer -->|Auto-Config| Copilot["🐙 GitHub Copilot<br/>(copilot-instructions.md)"]
    Installer -->|Auto-Config| Cline["🛠️ Cline & Roo Code<br/>(.clinerules, .roomodes)"]
    Installer -->|Auto-Config| Codex["🧠 OpenAI Codex<br/>(CODEX.md)"]
    Installer -->|Auto-Config| Aider["⌨️ Aider Terminal<br/>(CONVENTIONS.md)"]
```

---

## 📜 Complete Rulebook & Engineering Standards Catalog

DevKit sở hữu hệ thống quy chuẩn chia thành **Universal Core Rules (17 chapters)** dùng chung cho mọi dự án và **Domain Rulebooks (50 chapters)** chuyên sâu:

### 1. 🌐 Universal Core Rules (`core/rules/`)

| File Quy Chuẩn | Chủ Đề / Lĩnh Vực | Mục Đích & Nguyên Tắc Cốt Lõi |
|---|---|---|
| [`01-testing.md`](file://core/rules/01-testing.md) | Unit & Integration Testing | Bắt buộc Paired Executable Oracle (RED→GREEN), cấm waiver, bắt buộc đo kiểm XML test report thật. |
| [`02-general.md`](file://core/rules/02-general.md) | General Engineering Policy | Tiêu chuẩn kỹ sư Level-4, Graph-First protocol, chính sách ngôn ngữ mặc định English / tùy chọn Vietnamese. |
| [`03-architecture.md`](file://core/rules/03-architecture.md) | Clean Architecture | Phân tầng nghiêm ngặt (Presentation → Domain → Data), Unidirectional Data Flow, Dependency Inversion. |
| [`04-style-guide.md`](file://core/rules/04-style-guide.md) | Code Formatting & Style | Chuẩn đặt tên, cấu trúc file, nullability, immutability và clean code guidelines. |
| [`05-anti-patterns.md`](file://core/rules/05-anti-patterns.md) | Anti-Patterns | Danh mục các lỗi cấm: God classes, leaky abstractions, side-effects trong getter, blocking I/O trên Main thread. |
| [`07-dry.md`](file://core/rules/07-dry.md) | DRY & Code Reuse | Nguyên tắc tái sử dụng mã nguồn an toàn, tránh trùng lặp logic nghiệp vụ và utility functions. |
| [`09-performance.md`](file://core/rules/09-performance.md) | Performance Optimization | Tối ưu bộ nhớ, ngăn ngừa OOM, kiểm soát frame budget (16ms/60fps, 8ms/120fps), tối ưu loop/allocations. |
| [`11-analyzer.md`](file://core/rules/11-analyzer.md) | Static Analyzers | Ràng buộc kiểm tra tĩnh qua ktlint, Detekt, Dependency Guard, Metalava API check. |
| [`12-refactoring.md`](file://core/rules/12-refactoring.md) | Surgical Refactoring | Quy tắc chỉnh sửa phẫu thuật (Surgical Edits), cấm drive-by refactoring hoặc format lan man ngoài task scope. |
| [`13-systematic-debugging.md`](file://core/rules/13-systematic-debugging.md) | Systematic Debugging | Quy trình chuẩn đoán lỗi 4 bước: Tái hiện → Phân lập → Kiểm chứng bằng chứng phân biệt → Sửa tối thiểu. |
| [`14-task-completion.md`](file://core/rules/14-task-completion.md) | Task Completion Gate | Định nghĩa Terminal State hoàn thành, cấm dừng nửa chừng hoặc yêu cầu user gõ 'continue' khi chưa xong task. |
| [`15-ai-workflow.md`](file://core/rules/15-ai-workflow.md) | Multi-Agent Orchestration | Quy tắc điều phối Subagent, nén ngữ cảnh (compaction), quản lý hội thoại và chia tách task lớn. |
| [`18-naming-conventions.md`](file://core/rules/18-naming-conventions.md) | Naming Conventions | Chuẩn đặt tên class, function, variable, package name, test class, resource ID đồng nhất. |
| [`19-security.md`](file://core/rules/19-security.md) | Security & Attack Surface | Ràng buộc an ninh: Input validation, Intent injection, SAF traversal, cấm hardcode credentials. |
| [`22-git-conventions.md`](file://core/rules/22-git-conventions.md) | Git Conventions | Chuẩn Conventional Commits (`feat`, `fix`, `refactor`...), branch naming, cấm force-push phá hủy lịch sử. |
| [`30-r8-proguard.md`](file://core/rules/30-r8-proguard.md) | Code Shrinking & ProGuard | Giữ nguyên class model serialization, mapping rules, kiểm thử release APK với R8 minification. |
| [`45-tdd-enforcement.md`](file://core/rules/45-tdd-enforcement.md) | TDD Gate Enforcement | Ràng buộc viết test thất bại (RED) trước khi viết code production, cấm bypass TDD. |

<details>
<summary><b>📱 Xem 50 Chapters Chuyên Sâu cho Android (`domains/android/rulebook/`)</b></summary>

Bao quát 100% hệ sinh thái Android hiện đại:
- **UI & Compose:** `04-compose.md`, `06-compose-advanced.md`, `08-compose-performance.md`, `26-animations.md`, `27-accessibility.md`, `32-edge-to-edge.md`, `38-adaptive-layouts.md`, `41-custom-views.md`, `44-internationalization.md`.
- **Architecture & State:** `03-architecture.md`, `16-viewmodel.md`, `24-process-death.md`, `31-workmanager.md`, `34-state-restoration.md`, `39-offline-first.md`, `40-modularization.md`, `48-dependency-injection.md`.
- **Data & Storage:** `17-room.md`, `20-datastore.md`, `21-paging3.md`, `35-storage-access-framework.md`, `36-file-io.md`.
- **Concurrency & Networking:** `05-coroutines.md`, `07-flow.md`, `10-networking.md`, `28-caching.md`.
- **Quality, Perf & Benchmarks:** `01-testing.md`, `09-performance.md`, `11-analyzer-enforcement.md`, `23-memory-leaks.md`, `25-startup-optimization.md`, `29-battery-optimization.md`, `30-r8-proguard.md`, `33-baseline-profiles.md`, `37-microbenchmarks.md`, `42-ndk-jni.md`, `43-crash-reporting.md`, `45-tdd-enforcement.md`, `46-camera-media.md`, `47-deep-links.md`, `49-app-size.md`, `50-gradle-build-speed.md`.

</details>

---

## 🧰 45 Curated Engineering Skills Catalog

Kho 45 kỹ năng chuẩn hóa theo định dạng `SKILL.md` (YAML frontmatter + Progressive Disclosure), chia thành **5 nhóm chức năng chuyên biệt**:

### 1. 🧪 Testing & Zero-Defect QA (6 Skills)
| Skill | Slash Command | Chức Năng & Mục Đích Sử Dụng |
|---|---|---|
| **`qc`** | `/qc`, `/test`, `/qa` | Chạy kiểm thử tự động, lint check (ktlint), unit tests, Metalava API check, Translation gate và QA release gates. |
| **`fixbugs`** | `/fixbugs`, `/fix`, `/bugs` | Quy trình chẩn đoán và sửa lỗi tuân thủ nghiêm ngặt **Paired Executable Oracle (RED → GREEN)**. |
| **`tdd-workflow`** | `/tdd` | TDD Workflow: viết RED test kiểm chứng lỗi trước khi viết bất kỳ dòng code logic nào. |
| **`verification-before-completion`** | `/verify` | Verification gate cuối cùng trước khi tuyên bố hoàn thành task hoặc tạo PR. |
| **`triage-crashlytics-bug`** | `/crashlytics` | Phân tích Crashlytics stack trace, native crash, OOM leak và đề xuất phương án xử lý gốc rễ. |
| **`deploy`** | `/deploy`, `/build` | Quy trình đóng gói APK/AAB, kiểm tra signing, ProGuard/R8 mappings và release readiness. |

---

### 2. 📐 Architecture, Planning & Operations (11 Skills)
| Skill | Slash Command | Chức Năng & Mục Đích Sử Dụng |
|---|---|---|
| **`spec-driven-development`** | `/plan` | Lập kế hoạch theo mô hình Spec-Kit Lite cho mọi thay đổi chạm ≥3 files hoặc ≥2 modules. |
| **`deep-module-design`** | `/deep-design` | Đánh giá seam, interface contract, testability và abstraction độc lập của module. |
| **`grill-plan`** | `/grill` | Phản biện, stress-test kế hoạch thiết kế và truy vết edge-cases trước khi viết code. |
| **`incremental-implementation`** | `/incremental` | Chia tách và triển khai từng bước nhỏ cho tính năng lớn theo step-by-step TDD an toàn. |
| **`session-handoff`** | `/handoff` | Đóng gói toàn bộ ngữ cảnh, công việc dở dang và bằng chứng để chuyển giao sang session mới. |
| **`merge-conflict-resolver`** | `/conflict` | Giải quyết Git merge / rebase / stash conflict an toàn dựa trên phân tích ngữ nghĩa 3-way merge. |
| **`deprecation-migration`** | `/migration` | Quy trình thay thế API/thư viện deprecated, dọn code cũ mà không làm vỡ các consumer. |
| **`documentation-and-adrs`** | `/adr` | Ghi nhận Architecture Decision Record (ADR) dài hạn cho các quyết định kiến trúc quan trọng. |
| **`graph-navigation`** | `/graph` | Khám phá codebase, trace call/data flow, phân tích blast radius bằng AST Knowledge Graph. |
| **`security-checklist`** | `/scan` | Audit an ninh: Intent filter, URI traversal, Storage Access Framework, exported components, permissions. |
| **`observability-instrumentation`** | `/observability` | Thêm và audit telemetry, structured logging, Firebase Analytics, Crashlytics & Perf metrics. |

---

### 3. 📄 Document & Data Processing Engines (4 Skills)
| Skill | Slash Command | Chức Năng & Mục Đích Sử Dụng |
|---|---|---|
| **`documents`** | `/documents`, `/docx` | Engine tạo, chỉnh sửa, redline và render tài liệu Microsoft Word (`.docx`) & Google Docs chất lượng cao. |
| **`spreadsheets`** | `/spreadsheets`, `/xlsx` | Engine tính toán công thức, phân tích tài chính, tạo biểu đồ và xử lý Microsoft Excel (`.xlsx`). |
| **`presentations`** | `/presentations`, `/pptx` | Engine thiết kế, dàn trang layout, dựng slide thuyết trình Microsoft PowerPoint (`.pptx`). |
| **`pdf`** | `/pdf` | Bộ công cụ đọc, trích xuất text/table, OCR, merge/split, mã hóa và điền biểu mẫu PDF. |

---

### 4. 🛠️ Agent, Plugin & MCP Development (18 Skills)
| Skill | Slash Command | Chức Năng & Mục Đích Sử Dụng |
|---|---|---|
| **`plugin-creator`** | `/plugin-creator` | Scaffold và tạo mới plugin directory theo chuẩn Claude Code và Antigravity. |
| **`plugin-structure`** | `/plugin-structure` | Chuẩn hóa cấu trúc thư mục plugin, manifest `plugin.json` và auto-discovery. |
| **`plugin-settings`** | `/plugin-settings` | Quản lý cấu hình per-project qua file YAML frontmatter `.local.md`. |
| **`skill-creator`** | `/skill-creator` | Tạo skill mới từ đầu, đo lường benchmark và tối ưu trigger description. |
| **`skill-development`** | `/skill-development` | Hướng dẫn cấu trúc Progressive Disclosure cho SKILL.md. |
| **`skill-installer`** | `/skill-installer` | Tìm kiếm và cài đặt skills trực tiếp từ GitHub hoặc package registry. |
| **`command-development`** | `/command-development` | Xây dựng Slash Commands và thiết lập alias router cho Agent. |
| **`hook-development`** | `/hook-development` | Xây dựng Lifecycle Safety Hooks (PreToolUse, PostToolUse, Stop, SessionStart). |
| **`agent-development`** | `/agent-development` | Thiết kế subagents chuyên biệt, phân quyền tools và system prompt. |
| **`build-mcp-server`** | `/build-mcp-server` | Hướng dẫn lập trình và đóng gói custom MCP server (stdio, SSE, HTTP). |
| **`build-mcp-app`** | `/build-mcp-app` | Xây dựng interactive UI widgets và form controls nhúng trực tiếp trong chat MCP. |
| **`build-mcpb`** | `/build-mcpb` | Đóng gói local MCP server thành file `.mcpb` chạy độc lập không cần cài runtime. |
| **`mcp-integration`** | `/mcp-integration` | Hướng dẫn tích hợp và cấu hình MCP server vào các hệ thống AI coding agent. |
| **`review-agent`** | `/review-agent` | Thực hiện defect-first code review độc lập trước khi commit hoặc merge PR. |
| **`codebase-memory`** | `/codebase-memory` | Quản trị và đồng bộ AST Knowledge Graph Database cho dự án lớn. |
| **`writing-rules`** | `/writing-rules` | Hướng dẫn viết và chuẩn hóa các rule chapters và hookify safety rules. |
| **`writing-skills`** | `/writing-skills` | Quy chuẩn tác giả, audit và bảo trì hệ thống skills trong kho DevKit. |
| **`schedule`** | `/schedule` | Quản lý recurring cron jobs và one-shot timers chạy ngầm cho Agent. |

---

### 5. 🎨 Frontend, Visualization & Platform Tools (6 Skills)
| Skill | Slash Command | Chức Năng & Mục Đích Sử Dụng |
|---|---|---|
| **`frontend-design`** | `/frontend-design` | Hướng dẫn thiết kế giao diện UI hiện đại, phối màu, typography aesthetic. |
| **`visualize`** | `/visualize` | Dựng trực quan hóa tương tác (HTML/SVG widgets, flowcharts, data graphs). |
| **`playground`** | `/playground` | Tạo single-file HTML playground tương tác với các control trực quan. |
| **`imagegen`** | `/imagegen` | Tạo mockup hình ảnh, wireframe và asset đồ họa bằng AI image generator. |
| **`control-in-app-browser`** | `/control-in-app-browser` | Điều khiển browser nội bộ để inspect trang web, click, gõ text và chụp screenshot. |
| **`android-cli`** | `/android-cli` | Quản lý Android SDK, điều khiển emulator/AVD và chụp UI screenshot từ CLI. |

---

## 🌐 Universal Multi-Agent Matrix

DevKit tự động sinh và đồng bộ cấu hình tương thích 100% cho 8 hệ sinh thái agent phổ biến:

| Nền tảng / IDE | File Cấu Hình Tự Động Sinh | Tính Năng Được Kích Hoạt | Trạng Thái |
|---|---|---|:---:|
| **Claude Code** | `CLAUDE.md`, `.claude/settings.json`, `.claude/commands/`, `.claude/hooks/`, `.mcp.json` | Slash Commands (`/qc`, `/fix`, `/plan`), Safety Hooks chặn lỗi runtime, Subagents, MCP Tools | `READY` 🟢 |
| **Antigravity / Gemini** | `AGENTS.md`, `GEMINI.md`, `.agents/skills/`, `.agents/rules/`, `mcp_config.json` | Auto-discovery Skills, phân tầng nạp Rules theo ngữ cảnh dự án | `READY` 🟢 |
| **Cursor IDE** | `.cursorrules`, `.cursor/rules/*.mdc` | Modular Rules chuẩn mới (`.mdc`), `alwaysApply` cho Core Protocol | `READY` 🟢 |
| **Windsurf / Cascade** | `.windsurfrules`, `.windsurf/rules/` | Cascade System Rules, Zero-Defect & Pre-Code Gate enforcement | `READY` 🟢 |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Workspace custom instructions cho VS Code & JetBrains Copilot | `READY` 🟢 |
| **Cline & Roo Code** | `.clinerules`, `.roomodes` | Tùy chỉnh vai trò: *Principal Architect*, *Code Reviewer*, *SETI Test Architect* | `READY` 🟢 |
| **OpenAI Codex** | `CODEX.md` | Zero-Defect & Pre-Code Gate instructions cho GPT models | `READY` 🟢 |
| **Aider** | `CONVENTIONS.md`, `.aider.conf.yml` | Auto test-command bindings, git diff verification, coding conventions | `READY` 🟢 |

---

## 🔌 MCP (Model Context Protocol) Hub

Hệ sinh thái MCP được tích hợp sẵn sàng trong thư mục `mcp/` với hơn 100+ JSON tool schemas:

```
universal-agent-devkit/mcp/
├── .mcp.json               # Cấu hình chuẩn cho Claude Code & Cursor
├── mcp_config.json         # Cấu hình chuẩn cho Antigravity & Gemini
├── README.md               # Hướng dẫn chi tiết thiết lập biến môi trường
└── schemas/                # 100+ Tool Definitions & Schemas
    ├── codebase-memory-mcp/
    ├── context7/
    ├── android-code-search/
    ├── android-skills/
    ├── replicant-mcp/
    └── play-store/
```

| Server Name | Transport | Khả năng & Công cụ nổi bật |
|---|---|---|
| **`codebase-memory-mcp`** | stdio | Knowledge Graph AST, tìm kiếm symbol, truy vết call path (`search_graph`, `trace_path`, `get_code_snippet`). |
| **`context7`** | npx | Tra cứu tài liệu chính thức của thư viện theo version thực tế (`resolve-library-id`, `query-docs`). |
| **`android-code-search`** | npx | Tìm kiếm mã nguồn và symbol trong toàn bộ Android Open Source Project (`search_android_code`). |
| **`android-skills`** | npx | Tra cứu kỹ năng phát triển Android chính thức (`list_skills`, `get_skill`). |
| **`replicant-mcp`** | npx | Điều khiển ADB, capture màn hình, query UI node, click/swipe UI, đọc logcat, chạy Gradle. |
| **`play-store`** | Python stdio | Triển khai APK/AAB, track crash rate, ANR rate, review response, vitals summary. |

---

## 🚀 Quick Start & Installation

### Option 1: Cài đặt từ xa 1 dòng lệnh (Remote 1-Liner — Không cần clone trước)
Chạy trực tiếp trên terminal của bạn:
```bash
curl -fsSL https://raw.githubusercontent.com/ToanMobile/universal-agent-devkit/main/bin/quick-install.sh | bash
```

---

### Option 2: Clone về máy và cài đặt CLI toàn cục (Khuyến nghị)
```bash
# 1. Clone repository
git clone https://github.com/ToanMobile/universal-agent-devkit.git
cd universal-agent-devkit

# 2. Cài đặt agent-kit vào ~/.local/bin
make install

# 3. Kích hoạt tức thì cho BẤT KỲ dự án nào trên máy tính
cd /path/to/your-project
agent-kit init
```

---

### Option 3: Cài đặt dạng Claude Code Plugin
```bash
claude plugin install github.com/ToanMobile/universal-agent-devkit
# hoặc từ thư mục local:
claude plugin install /path/to/universal-agent-devkit
```

---

## 🧪 Verification & DevKit CLI (`agent-kit`)

DevKit đi kèm công cụ dòng lệnh quản trị và kiểm thử chuyên dụng:

```bash
# 1. Khởi tạo dự án (Tự động nhận diện domain & agents):
agent-kit init

# 2. Chạy trọn bộ 294+ Regression Test Suite:
agent-kit test

# 3. Liệt kê toàn bộ Skills:
agent-kit list

# 4. Liệt kê toàn bộ Slash Commands:
agent-kit commands

# 5. Đồng bộ hóa Skills & Slash Commands:
agent-kit sync
```

### 📊 Báo Cáo Kiểm Thử (Test Evidence):
- **Hook Contract Tests:** `160 / 160 PASS (100%)` ✅
- **Workflow Engine Tests:** `134 / 134 PASS (100%)` ✅
- **Multi-Agent Sandbox Matrix:** `8 / 8 Ecosystems Verified` ✅

---

## 📁 Cấu Trúc Thư Mục Chuẩn (Project Layout)

```
universal-agent-devkit/
├── .claude-plugin/              # Claude Code Plugin Manifest (plugin.json)
├── bin/                         # CLI entrypoints (install.sh, agent-kit, quick-install.sh)
├── core/                        # Universal SSOT (AGENTS.md, CLAUDE.md, rules, knowledge)
│   ├── rules/                   # 17 Universal Rule Chapters (Testing, Architecture, DRY, Security...)
│   └── knowledge/               # Universal Runbooks & Gate Layers
├── domains/                     # Domain Rulebooks
│   └── android/rulebook/        # 50 chapters Android/Compose/Room/Kotlin rulebook
├── skills/                      # 45 Curated Engineering Skills (SKILL.md standard)
├── commands/                    # Auto-discovered Slash Commands & Aliases (68 commands)
├── agents/                      # Specialized Subagents (.md)
├── hooks/                       # 9+ Lifecycle Safety Gates & 160+ Contract Tests
├── workflows/                   # Audit & Test Engines (134+ JS/MJS Tests)
├── mcp/                         # MCP Hub (.mcp.json, mcp_config.json, schemas)
├── setup.sh                     # Root setup entrypoint
├── Makefile                     # Build & Global install automation
└── adapters/                    # Setup scripts cho 8 nền tảng Agent & IDE
```

---

## 📄 License & Repository

- **GitHub:** [https://github.com/ToanMobile/universal-agent-devkit](https://github.com/ToanMobile/universal-agent-devkit)
- **License:** Distributed under the **MIT License**.

<div align="center">
  <sub>Built with precision by Senior AI Software Engineers. Powered by Universal Agent Architecture.</sub>
</div>
