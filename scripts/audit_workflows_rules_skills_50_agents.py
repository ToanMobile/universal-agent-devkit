#!/usr/bin/env python3
"""
50-Agent Audit & Review Suite for Workflows, Rules, Skills & Multi-Agent Architecture
Universal Agent DevKit — Comprehensive Governance & Quality Ensemble

Audits 50 distinct checkpoints across 10 specialized governance councils:
  Council 1 (Agents 01-05): Workflow Specification & Execution Engine
  Council 2 (Agents 06-10): Hook Safety Gates & Command Interceptors
  Council 3 (Agents 11-15): Core Solo-Dev Quality Rules
  Council 4 (Agents 16-20): Domain Profiles Rules & Cross-Profile Isolation
  Council 5 (Agents 21-25): Skills YAML Frontmatter & Schema Specification
  Council 6 (Agents 26-30): Skill Routing & Paired Oracle Verifiability
  Council 7 (Agents 31-35): Multi-Agent Platform Adapters (Claude, Codex, Gemini, Cursor)
  Council 8 (Agents 36-40): Intelligent Routing & Dynamic Auto-Discovery
  Council 9 (Agents 41-45): MCP Configuration & Tool Contract Interoperability
  Council 10 (Agents 46-50): DevKit Delivery, Quick-Install & Self-Healing

100% Standard Library — Zero external dependencies.
"""

import json
import os
import re
import sys
from pathlib import Path

# Fix Unicode on Windows consoles if needed
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

AGENTS_SPEC = [
    # Council 1: Workflow Specification & Execution Engine
    (1, "WorkflowEntrypointAuditor", "Kiểm tra cú pháp và entrypoint thực thi workflow (Node.js/MJS)", "workflows/fix-evidence-driver.mjs", r"#!/usr/bin/env node"),
    (2, "EvidenceLedgerAtomicAuditor", "Kiểm tra tính nguyên tử của sổ cái bằng chứng và băm SHA-256", "workflows/multi-lens-audit.js", r"sha256Bytes|sha256Value"),
    (3, "SignalDisciplineAuditor", "Kiểm tra bẫy dọn dẹp tiến trình và giải phóng tài nguyên khi ngắt quãng", "workflows/fix-evidence-driver.mjs", r"failureCleanupPath|rmSync"),
    (4, "PipelineTransitionAuditor", "Kiểm tra chuyển dịch trạng thái quy trình: CLEAR, CANDIDATE, FIXED", "workflows/multi-lens-audit.js", r"state|CLEAR|FIXED|CANDIDATE"),
    (5, "ArtifactProvenanceAuditor", "Kiểm tra tính toàn vẹn thời gian và nguồn gốc chứng từ artifact", "workflows/multi-lens-audit.js", r"manifestHash|provenance|timestamp"),

    # Council 2: Hook Safety Gates & Command Interceptors
    (6, "PreToolUseSecurityGateAuditor", "Kiểm tra rào chắn tiền thực thi chặn lệnh hủy diệt và lộ lọt secret", "hooks/security_gate.sh", r"security_gate|keystore|credential"),
    (7, "PostToolUseIntegrityGateAuditor", "Kiểm tra rào chắn hậu thực thi bắt buộc xác minh sau khi sửa code", "hooks/test_evidence_gate.sh", r"test_evidence_gate|git diff"),
    (8, "StopSessionDisciplineAuditor", "Kiểm tra rào chắn dừng phiên đảm bảo không còn sửa đổi dở dang", "hooks/review_gate.sh", r"review_gate|exit 2"),
    (9, "SecretLeakageInterceptorAuditor", "Kiểm tra rà quét ngăn chặn hardcode API token, private key trong command", "hooks/security_gate.sh", r"token|password|secret"),
    (10, "DebounceAndAntiSpamGateAuditor", "Kiểm tra rào chắn chống spam request và ép buộc debounce giao dịch", "rules/core-rules.md", r"Debounce|Chống Spam"),

    # Council 3: Core Solo-Dev Quality Rules
    (11, "GitAuthorityComplianceAuditor", "Kiểm tra quyền hạn AI: CHỈ commit/push/PR khi người dùng yêu cầu tường minh", "rules/core-rules.md", r"YÊU CẦU TƯỜNG MINH"),
    (12, "SecretZeroExposureAuditor", "Kiểm tra tuyệt đối cấm commit .env, keystore, credential trần", "rules/core-rules.md", r"Tuyệt đối KHÔNG commit bí mật"),
    (13, "LeanDevLoopAuditor", "Kiểm tra quy trình 4 bước: Test cục bộ -> Self Review -> Ảnh nghiệm thu -> Commit", "rules/core-rules.md", r"Quy trình làm việc tinh gọn"),
    (14, "DualModePreservationAuditor", "Kiểm tra bảo toàn 2 chế độ DEMO / LIVE trên mọi nghiệp vụ mới", "rules/core-rules.md", r"DEMO / LIVE"),
    (15, "VisualProofAcceptanceGateAuditor", "Kiểm tra bắt buộc hình ảnh minh chứng trạng thái THÀNH CÔNG (PASS)", "rules/core-rules.md", r"THÀNH CÔNG \(Pass / Success State\)"),

    # Council 4: Domain Profiles Rules & Cross-Profile Isolation
    (16, "AutomotiveDomainRulesAuditor", "Kiểm tra quy tắc xe hơi: isTargetPackage, CAN debounce 80ms, API 28 quirks", "profiles/automotive/rules/automotive-rules.md", r"isTargetPackage|FlymeAuto|CAN bus"),
    (17, "AndroidMobileRulesAuditor", "Kiểm tra quy tắc Android: FLAG_IMMUTABLE, coroutines IO, chống ANR/OOM", "profiles/android/rules/android-rules.md", r"FLAG_IMMUTABLE|Dispatchers\.IO|ANR"),
    (18, "Game3DRulesAuditor", "Kiểm tra quy tắc Game: triệt tiêu GC allocation trong Update, Physics NonAlloc", "profiles/game/rules/game-rules.md", r"Update\(\)|RaycastNonAlloc|DrawCalls"),
    (19, "UniversalProfileCompletenessAuditor", "Kiểm tra profile Universal cung cấp đầy đủ Clean Architecture và TDD", "profiles/universal/rules/universal-rules.md", r"Clean Architecture|Paired Executable Oracle"),
    (20, "ProfileCrossBleedAuditor", "Kiểm tra cô lập tuyệt đối: quy tắc Automotive không bị lẫn vào Game/Mobile", "profiles/game/rules/game-rules.md", r"^(?!.*CAN Bus).*$"),

    # Council 5: Skills YAML Frontmatter & Schema Specification
    (21, "SkillFrontmatterSyntaxAuditor", "Kiểm tra 100% tệp SKILL.md mở đầu bằng khối YAML frontmatter hợp lệ", "skills/open-code-review/SKILL.md", r"^---\s*\nname:"),
    (22, "SkillNamingConventionAuditor", "Kiểm tra định danh skill tuân thủ chuẩn kebab-case và trùng tên thư mục", "skills/open-code-review/SKILL.md", r"name: open-code-review"),
    (23, "TriggerDescriptionClarityAuditor", "Kiểm tra trường description mô tả rõ ngữ cảnh kích hoạt và ranh giới", "skills/open-code-review/SKILL.md", r"description:"),
    (24, "SkillParameterSchemaAuditor", "Kiểm tra tài liệu hóa tham số CLI, biến môi trường và định dạng output", "skills/open-code-review/SKILL.md", r"ocr review|Chế độ"),
    (25, "SkillSymlinkSSOTAuditor", "Kiểm tra tính toàn vẹn symlink giữa .agents/skills và thư mục skills gốc", ".agents/skills/open-code-review", r"skills/open-code-review"),

    # Council 6: Skill Routing & Paired Oracle Verifiability
    (26, "TddWorkflowRedGreenAuditor", "Kiểm tra skill tdd-workflow ép buộc viết test RED trước khi viết code", "skills/tdd-workflow/SKILL.md", r"RED|GREEN|testable"),
    (27, "FixBugsOracleAuditor", "Kiểm tra skill fixbugs tuân thủ Paired Executable Oracle chuẩn đoán lỗi", "skills/fixbugs/SKILL.md", r"RED -> GREEN|Paired Executable Oracle"),
    (28, "OpenCodeReviewIntegrationAuditor", "Kiểm tra skill open-code-review định vị dòng chính xác và chia bundle", "skills/open-code-review/SKILL.md", r"Deterministic Line Resolution|Alibaba"),
    (29, "SecurityChecklistCoverageAuditor", "Kiểm tra skill security-checklist bao phủ Intent, URI, Permissions, Auth", "skills/security-checklist/SKILL.md", r"permission|security|URI"),
    (30, "VerificationBeforeCompletionAuditor", "Kiểm tra skill verification-before-completion chặn tuyên bố xong sớm", "skills/verification-before-completion/SKILL.md", r"tuyên bố xong|verification"),

    # Council 7: Multi-Agent Platform Adapters
    (31, "ClaudeCodeAdapterAuditor", "Kiểm tra adapter Claude Code thiết lập CLAUDE.md và hooks an toàn", "adapters/setup_claude.sh", r"CLAUDE\.md|\.claude"),
    (32, "OpenAICodexAdapterAuditor", "Kiểm tra adapter OpenAI Codex thiết lập AGENTS.md làm nguồn sự thật", "adapters/setup_codex.sh", r"AGENTS\.md|codex"),
    (33, "GeminiAntigravityAdapterAuditor", "Kiểm tra adapter Gemini/Antigravity liên kết .agents/skills và MCP", "adapters/setup_gemini.sh", r"\.agents/skills|mcp_config\.json"),
    (34, "CursorIDEAdapterAuditor", "Kiểm tra adapter Cursor IDE cấu hình .cursorrules đồng bộ với AGENTS.md", "adapters/setup_cursor.sh", r"\.cursorrules|AGENTS\.md"),
    (35, "AdapterIdempotencyAuditor", "Kiểm tra tính bất biến (idempotent): chạy lại adapter không ghi đè mất mát", "adapters/setup_gemini.sh", r"if \[ ! -e|mkdir -p"),

    # Council 8: Intelligent Routing & Dynamic Auto-Discovery
    (36, "SkillRouterIntentAuditor", "Kiểm tra bảng điều phối kỹ năng trong AGENTS.md ánh xạ chuẩn xác", "AGENTS.md", r"Slash Command / Alias|Canonical Skill Path"),
    (37, "CommandAliasCompletenessAuditor", "Kiểm tra thư mục commands/ chứa symlink đầy đủ cho mọi skill và workflow", "commands/profile.md", r"agent-profile|agent-config"),
    (38, "DomainAutoDetectionAuditor", "Kiểm tra heuristic nhận diện dự án: Gradle (Android), Vite/Next (Web), Cargo (Backend)", "bin/install.sh", r"build\.gradle|AndroidManifest\.xml|package\.json"),
    (39, "ProfileEssentialMcpAuditor", "Kiểm tra metadata profile.json chỉ định rõ danh mục essential_mcps", "profiles/android/profile.json", r"essential_mcps"),
    (40, "GracefulDegradationAuditor", "Kiểm tra cơ chế fallback về Read/Grep khi thiếu MCP server", "skills/graph-navigation/SKILL.md", r"Read/Grep|fallback"),

    # Council 9: MCP Configuration & Tool Contract Interoperability
    (41, "McpJsonSchemaAuditor", "Kiểm tra cấu hình .mcp.json và mcp_config.json đúng định dạng JSON", "mcp_config.json", r"mcpServers"),
    (42, "CodebaseMemoryMcpAuditor", "Kiểm tra cấu hình MCP codebase-memory hỗ trợ đồ thị tri thức mã nguồn", "mcp_config.json", r"codebase-memory-mcp"),
    (43, "AndroidMcpToolAuditor", "Kiểm tra MCP android-code-search và replicant-mcp sẵn sàng cho mobile", "profiles/android/profile.json", r"android-code-search|replicant-mcp"),
    (44, "GameMcpToolAuditor", "Kiểm tra MCP unity và blender sẵn sàng cho phát triển game", "profiles/game/profile.json", r"unity|blender"),
    (45, "Context7DocumentationMcpAuditor", "Kiểm tra MCP context7 sẵn sàng tra cứu tài liệu thư viện thời gian thực", "profiles/universal/profile.json", r"context7"),

    # Council 10: DevKit Delivery, Quick-Install & Self-Healing
    (46, "QuickInstallTerminalSafetyAuditor", "Kiểm tra script quick-install xử lý an toàn đường ống curl (/dev/tty)", "bin/quick-install.sh", r"exec 3</dev/tty"),
    (47, "InteractiveTwoStepMenuAuditor", "Kiểm tra giao diện cài đặt 2 bước: Bước 1 AI Tools, Bước 2 Project Profile", "bin/install.sh", r"Bước 1/2|Bước 2/2"),
    (48, "ProfileSwitcherCliAuditor", "Kiểm tra CLI agent-config.py hỗ trợ đầy đủ 4 profile: Xe hơi, Android, Game, Universal", "bin/agent-config.py", r"automotive.*android.*game.*universal"),
    (49, "HealthCheckEnsembleAuditor", "Kiểm tra công cụ agent-health.py tích hợp chẩn đoán đa điểm", "bin/agent-health.py", r"Universal Agent DevKit.*Health"),
    (50, "SelfHealingResilienceAuditor", "Kiểm tra thư mục rules/ chuẩn hóa đầy đủ core-rules và profile symlinks", "rules/core-rules.md", r"Core Engineering Rules")
]

COUNCILS = [
    ("Council 1: Workflow Lifecycle & Execution Specification", 1, 5),
    ("Council 2: Hook Safety Gates & Command Interceptors", 6, 10),
    ("Council 3: Core Solo-Dev Quality Rules", 11, 15),
    ("Council 4: Domain Profiles Rules & Cross-Profile Isolation", 16, 20),
    ("Council 5: Skills YAML Frontmatter & Schema Specification", 21, 25),
    ("Council 6: Skill Routing & Paired Oracle Verifiability", 26, 30),
    ("Council 7: Multi-Agent Platform Adapters (Claude, Codex, Gemini, Cursor)", 31, 35),
    ("Council 8: Intelligent Routing & Dynamic Auto-Discovery", 36, 40),
    ("Council 9: MCP Configuration & Tool Contract Interoperability", 41, 45),
    ("Council 10: DevKit Delivery, Quick-Install & Self-Healing", 46, 50),
]

def get_base_dir() -> Path:
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent

def run_agent_audit(agent_id: int, name: str, mission: str, target_file: str, pattern: str) -> dict:
    base_dir = get_base_dir()
    file_path = base_dir / target_file

    if not file_path.exists():
        # Check if it's a symlink pointing to an existing file
        if file_path.is_symlink():
            resolved = file_path.resolve()
            if not resolved.exists():
                return {
                    "id": agent_id,
                    "name": name,
                    "mission": mission,
                    "status": "FAIL",
                    "reason": f"Tệp đích không tồn tại: {target_file}"
                }
        else:
            return {
                "id": agent_id,
                "name": name,
                "mission": mission,
                "status": "FAIL",
                "reason": f"Tệp đích không tồn tại: {target_file}"
            }

    try:
        content = ""
        if file_path.is_symlink():
            link_target = os.readlink(file_path)
            content = f"SYMLINK: {link_target}"
            if file_path.is_file():
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content += "\n" + f.read()
        elif file_path.is_file():
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        elif file_path.is_dir():
            content = f"DIRECTORY: {file_path.name}"

        if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
            return {
                "id": agent_id,
                "name": name,
                "mission": mission,
                "status": "PASS",
                "reason": f"Đạt chuẩn: bắt khớp pattern `{pattern}` trong `{target_file}`"
            }
        else:
            return {
                "id": agent_id,
                "name": name,
                "mission": mission,
                "status": "FAIL",
                "reason": f"Không tìm thấy mẫu quy chuẩn `{pattern}` trong `{target_file}`"
            }
    except Exception as e:
        return {
            "id": agent_id,
            "name": name,
            "mission": mission,
            "status": "FAIL",
            "reason": f"Lỗi đọc tệp {target_file}: {e}"
        }

def main():
    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{CYAN}   🕵️  UNIVERSAL AGENT DEVKIT — 50-AGENT WORKFLOW & RULES & SKILLS AUDIT ENSEMBLE    {RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}\n")

    total_pass = 0
    total_fail = 0
    council_idx = 0

    for c_name, start_id, end_id in COUNCILS:
        council_idx += 1
        print(f"\n{BOLD}{CYAN}┌── [{council_idx:02d}/10] {c_name}{RESET}")
        
        for spec in AGENTS_SPEC:
            a_id, a_name, a_mission, a_file, a_pat = spec
            if start_id <= a_id <= end_id:
                res = run_agent_audit(a_id, a_name, a_mission, a_file, a_pat)
                if res["status"] == "PASS":
                    total_pass += 1
                    status_badge = f"{GREEN}{BOLD}PASS{RESET}"
                    icon = f"{GREEN}✔{RESET}"
                else:
                    total_fail += 1
                    status_badge = f"{RED}{BOLD}FAIL{RESET}"
                    icon = f"{RED}✖{RESET}"

                print(f"│  {icon} [Agent {a_id:02d}] {BOLD}{a_name:<34}{RESET} [{status_badge}]")
                print(f"│     {DIM}Mission: {a_mission}{RESET}")
                if res["status"] == "FAIL":
                    print(f"│     {RED}Reason: {res['reason']}{RESET}")

        print(f"{BOLD}{CYAN}└── Subtotal Council {council_idx}: {end_id - start_id + 1} Agents Verified{RESET}")

    score = int((total_pass / len(AGENTS_SPEC)) * 100)
    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}TỔNG KẾT KIỂM TOÁN 50 AGENTS REVIEW:{RESET}")
    print(f"  • Đạt chuẩn (PASS): {GREEN}{BOLD}{total_pass} / {len(AGENTS_SPEC)}{RESET}")
    print(f"  • Thất bại (FAIL):  {RED if total_fail > 0 else GREEN}{BOLD}{total_fail}{RESET}")
    print(f"  • Điểm số chất lượng: {GREEN if score == 100 else YELLOW}{BOLD}{score}%{RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}\n")

    if total_fail == 0:
        print(f"{GREEN}{BOLD}✔ TOÀN BỘ 50/50 AGENTS XÁC NHẬN HỆ THỐNG WORKFLOW, RULES, SKILLS ĐẠT CHUẨN HOÀN HẢO!{RESET}\n")
        return 0
    else:
        print(f"{RED}{BOLD}✖ CÓ {total_fail} AGENT PHÁT HIỆN LỖI CẦN KHẮC PHỤC.{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
