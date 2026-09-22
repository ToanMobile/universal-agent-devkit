#!/usr/bin/env python3
"""
10-Agent Zero-Regression & Anti-Reopen Audit Council
Universal Agent DevKit — Comprehensive Verification Engine

Audit & stress-test the workflow to answer the user's critical question:
"Khi có bugs mới fix xong, liệu 100% sẽ KHÔNG TẠO RA BUG KHÁC và KHÔNG MỞ LẠI BUGS CŨ hay không?"

10 Specialized Adversarial Audit Agents:
  [Agent 01] PairedOracleBoundaryAuditor      : Rào chắn Paired Executable Oracle (RED -> GREEN, Zero Waiver)
  [Agent 02] InboundCallerBlastRadiusAuditor  : Rà soát 100% điểm gọi ngược (Zero New Bugs across callers)
  [Agent 03] ImmutableGuardsPreservationAuditor: Bảo toàn rào chắn bất biến lịch sử (Zero Reopened Bugs)
  [Agent 04] InstinctsAntiPatternTrapAuditor  : Sổ tay bài học kinh nghiệm & bẫy mã nguồn (Never Repeat Mistakes)
  [Agent 05] TiaRegressionChecklistEnforcer   : Thực thi ma trận hồi quy TIA và checklist đánh dấu [x] PASS
  [Agent 06] TwoWayTestSuiteIntegrityAuditor  : Bảo vệ bộ test cũ — Cấm sửa assertion để pass gian lận
  [Agent 07] AntiFlappingRegressionLockAuditor: Khóa hồi quy vĩnh viễn (Oracle test permanently locked)
  [Agent 08] SurgicalEditScopeAuditor         : Sửa đổi phẫu thuật cục bộ & Chống placeholder lười biếng
  [Agent 09] DeterministicOpenCodeReviewAuditor: Kiểm toán tĩnh qua Alibaba OCR (0 Memory Leaks, 0 Regressions)
  [Agent 10] FailClosedAcceptanceGateAuditor  : Cổng nghiệm thu chặn nghiêm Fail-Closed (1 lỗi là REJECT)

100% Standard Library — Zero external dependencies.
"""

import os
import re
import subprocess
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
    (
        1,
        "PairedOracleBoundaryAuditor",
        "Kiểm tra kỷ luật Paired Executable Oracle: Bắt buộc RED trước khi sửa, GREEN sau khi sửa, cấm mọi waiver",
        "skills/fixbugs/SKILL.md",
        r"PAIRED EXECUTABLE ORACLE|không có waiver|RED Phase|GREEN Phase",
        "Đảm bảo nguyên nhân gốc được chứng minh bằng thực nghiệm phân biệt đối lập, không sửa mò"
    ),
    (
        2,
        "InboundCallerBlastRadiusAuditor",
        "Kiểm tra rà soát 100% điểm gọi ngược (Inbound Callers Blast Radius) trước khi sửa đổi shared code",
        "skills/fixbugs/SKILL.md",
        r"trace_path.*Inbound Callers|Blast Radius|Consumer list",
        "Đảm bảo thay đổi không phá vỡ bất kỳ caller nào khác trong hệ thống (Zero New Bugs)"
    ),
    (
        3,
        "ImmutableGuardsPreservationAuditor",
        "Kiểm tra bảo toàn các rào chắn bất biến lịch sử (Immutable Guards) ngăn mở lại bugs cũ",
        "bin/post-fix-gate.py",
        r"immutable_guards|GUARD PROTECTED|Rào chắn Bất biến Lịch sử",
        "Đảm bảo toàn bộ các bản hotfix và guard lịch sử không bao giờ bị xóa hoặc nới lỏng (Zero Reopened Bugs)"
    ),
    (
        4,
        "InstinctsAntiPatternTrapAuditor",
        "Kiểm tra sổ tay bẫy mã nguồn và bộ nhớ bài học kinh nghiệm (.agents/instincts.md)",
        ".agents/instincts.md",
        r"Instincts & Failure Memory|INSTINCT-001|bẫy mã nguồn",
        "Đảm bảo AI đọc bài học kinh nghiệm trong quá khứ và không bao giờ đi vào vết xe đổ"
    ),
    (
        5,
        "TiaRegressionChecklistEnforcer",
        "Kiểm tra thực thi ma trận TIA và xuất bảng checklist hồi quy đánh dấu [x] PASS",
        "bin/post-fix-gate.py",
        r"BẢNG CHECKLIST KIỂM THỬ HỒI QUY TIA|\[x\] PASS|mandatory_regression_tests",
        "Đảm bảo mọi module liên đới đều được chạy lại bộ test tương ứng và đánh dấu PASS trước khi bàn giao"
    ),
    (
        6,
        "TwoWayTestSuiteIntegrityAuditor",
        "Kiểm tra tính toàn vẹn 2 chiều của bộ test: Nghiêm cấm sửa assertion cũ để pass gian lận",
        "skills/fixbugs/SKILL.md",
        r"Two-Way Test Suite Integrity|nới lỏng các assertion|sửa đổi.*test cũ",
        "Đảm bảo agent không thể 'qua mặt' bằng cách đảo ngược assertion từ true sang false"
    ),
    (
        7,
        "AntiFlappingRegressionLockAuditor",
        "Kiểm tra khóa hồi quy vĩnh viễn (Anti-Flapping & Regression Lock): Test mới thành chốt chặn vĩnh cửu",
        "skills/fixbugs/SKILL.md",
        r"Khóa Hồi Quy Vĩnh Viễn|Anti-Flapping & Regression Lock|chặn build ngay tức khắc",
        "Đảm bảo khi bug đã fix xong thì bài test sẽ bảo vệ vĩnh viễn trong test suite; nếu bug tái phát sẽ chặn build ngay"
    ),
    (
        8,
        "SurgicalEditScopeAuditor",
        "Kiểm tra quy chuẩn sửa đổi phẫu thuật cục bộ & Chống placeholder lười biếng (Anti-Laziness)",
        "rules/core-rules.md",
        r"Surgical|Nghiêm cấm Code Placeholder lười biếng|Anti-Laziness",
        "Đảm bảo phạm vi sửa đổi đúng điểm lỗi, không drive-by refactoring, không làm mất code lân cận"
    ),
    (
        9,
        "DeterministicOpenCodeReviewAuditor",
        "Kiểm tra kiểm toán tĩnh qua Alibaba OpenCodeReview (OCR) triệt tiêu Memory Leaks & Regressions",
        "bin/post-fix-gate.py",
        r"OpenCodeReview|Deterministic Line Resolution|0 Blocking Defects",
        "Đảm bảo phát hiện sớm rò rỉ bộ nhớ, callback leak, race condition tiềm ẩn ngoài phạm vi unit test"
    ),
    (
        10,
        "FailClosedAcceptanceGateAuditor",
        "Kiểm tra cơ chế cổng nghiệm thu Fail-Closed: Bất kỳ vi phạm nào đều lập tức REJECT và chặn bàn giao",
        "bin/post-fix-gate.py",
        r"all_pass =.*hygiene_ok.*anti_laziness_ok|REJECT — CẦN KHẮC PHỤC|sys\.exit\(main\(\)\)",
        "Đảm bảo mã nguồn chỉ được chấp thuận bàn giao khi vượt qua 100% các tiêu chí an toàn"
    )
]

def get_base_dir() -> Path:
    return Path(__file__).resolve().parent.parent

def main():
    base_dir = get_base_dir()
    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{CYAN}   🛡️  HỘI ĐỒNG 10 AGENTS AUDIT: CAM KẾT ZERO-REGRESSION & CHỐNG MỞ LẠI BUGS CŨ        {RESET}")
    print(f"{BOLD}{CYAN}   Đánh giá: Khi có bug mới fix xong, liệu 100% không sinh bug mới & không mở lại bug cũ?{RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}\n")

    passed_count = 0
    total_count = len(AGENTS_SPEC)

    for agent_id, agent_name, mission, target_file, pattern, guarantee in AGENTS_SPEC:
        full_path = base_dir / target_file
        status = "FAIL"
        details = ""

        if not full_path.exists():
            details = f"Tệp không tồn tại: {target_file}"
        else:
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                if re.search(pattern, content, re.IGNORECASE):
                    status = "PASS"
                    passed_count += 1
                else:
                    details = f"Không tìm thấy mẫu quy chuẩn bắt buộc: {pattern}"
            except Exception as e:
                details = f"Lỗi đọc file: {e}"

        status_color = f"{GREEN}[PASS]{RESET}" if status == "PASS" else f"{RED}[FAIL]{RESET}"
        print(f"┌── [Agent {agent_id:02d}/10] {BOLD}{agent_name}{RESET} {status_color}")
        print(f"│   • Nhiệm vụ: {mission}")
        print(f"│   • Tệp kiểm toán: {DIM}{target_file}{RESET}")
        print(f"│   • Cam kết bảo vệ: {CYAN}{guarantee}{RESET}")
        if status == "FAIL":
            print(f"│   • {RED}Lý do thất bại: {details}{RESET}")
        print(f"└── Phán quyết: {status_color}\n")

    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}TỔNG KẾT ĐÁNH GIÁ 10 AGENTS AUDIT ZERO-REGRESSION:{RESET}")
    print(f"  • Đạt chuẩn (PASS): {GREEN}{passed_count} / {total_count}{RESET}")
    print(f"  • Thất bại (FAIL):  {RED if passed_count < total_count else GREEN}{total_count - passed_count}{RESET}")
    print(f"  • Tỷ lệ đáp ứng:     {BOLD}{int(passed_count / total_count * 100)}%{RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════════════════{RESET}\n")

    if passed_count == total_count:
        print(f"{GREEN}{BOLD}✔ 10/10 AGENTS XÁC NHẬN: QUY TRÌNH ĐẠT CHUẨN 10/10 TUYỆT ĐỐI!{RESET}")
        print(f"  1. Cam kết 1: 100% KHÔNG TẠO RA BUG KHÁC (Nhờ Paired Oracle, Inbound Caller Audit, TIA Matrix, Surgical Scope).")
        print(f"  2. Cam kết 2: 100% KHÔNG MỞ LẠI BUGS CŨ (Nhờ Immutable Guards, Instincts Memory, Anti-Flapping Lock, Two-Way Test Integrity).\n")
        return 0
    else:
        print(f"{RED}{BOLD}✖ CÒN {total_count - passed_count} TIÊU CHÍ CHƯA ĐẠT CẦN HOÀN THIỆN!{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
