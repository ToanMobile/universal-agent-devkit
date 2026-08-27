# 🔌 MCP (Model Context Protocol) Integration Hub

Universal configuration and schemas for Model Context Protocol (MCP) servers used across **Claude Code**, **Antigravity / Gemini**, **Cursor**, and **Windsurf**.

---

## 📋 MCP Servers Inventory

| Server Name | Command / Transport | Key Capabilities & Tools |
|---|---|---|
| **`codebase-memory-mcp`** | `codebase-memory-mcp` (stdio) | Knowledge Graph discovery, AST symbol navigation, call trace paths (`search_graph`, `trace_path`, `get_code_snippet`, `query_graph`). |
| **`context7`** | `npx -y @upstash/context7-mcp` | Tra cứu official documentation của thư viện bên thứ ba theo phiên bản chính xác (`resolve-library-id`, `query-docs`). |
| **`android-code-search`** | `npx -y cs-android-mcp` | Tìm kiếm mã nguồn và symbol trong Android Open Source Project (AOSP) (`search_android_code`, `suggest_symbols`). |
| **`android-skills`** | `npx -y android-skills-mcp` | Tra cứu kỹ năng phát triển Android chính thức (`list_skills`, `search_skills`, `get_skill`). |
| **`replicant-mcp`** | `npx -y replicant-mcp` | Điều khiển thiết bị Android qua ADB, capture màn hình, query UI node, click/swipe UI, đọc logcat, chạy Gradle build & test (`adb-device`, `ui-query`, `ui-action`, `adb-logcat`, `gradle-build`). |
| **`play-store`** | Python stdio (`play-store-mcp`) | Quản lý Google Play Console, triển khai APK/AAB, track crash rate, ANR rate, review response, subscriptions, vitals summary (`deploy_app`, `get_crash_rate`, `get_reviews`, `get_vitals_summary`). |

---

## 🛠️ Setup Instructions per Agent

### 1. Claude Code
File cấu hình: `.mcp.json` tại root dự án hoặc `~/.claude/.mcp.json`.
```json
{
  "mcpServers": {
    "codebase-memory-mcp": { "command": "codebase-memory-mcp" },
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "android-code-search": { "command": "npx", "args": ["-y", "cs-android-mcp"] },
    "replicant-mcp": { "command": "npx", "args": ["-y", "replicant-mcp"], "env": { "ANDROID_HOME": "/Volumes/Data/AndroidSDK" } }
  }
}
```

### 2. Google Antigravity & Gemini CLI
File cấu hình: `mcp_config.json` tại root dự án hoặc `~/.gemini/config/mcp_config.json`.

### 3. Cursor & Windsurf
Thêm cấu hình vào Settings -> MCP Servers hoặc copy từ `mcp/.mcp.json`.

---

## 📂 Tool Schemas
Toàn bộ schemas định nghĩa chi tiết của 100+ MCP tools được lưu trữ tại thư mục `mcp/schemas/`.
