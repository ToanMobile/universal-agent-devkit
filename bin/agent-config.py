#!/usr/bin/env python3
"""
Agent Profile Configuration CLI Tool
Universal Agent DevKit — Dynamic Domain Profile Switcher
Provides 4 specialized configuration options:
  [1] 🚗 Automotive (Xe hơi: AAOS / IVI / Flyme Auto / CAN Bus)
  [2] 📱 Android    (Mobile App: Jetpack Compose / Clean Architecture)
  [3] 🎮 Game       (Game 3D: Unity 6 / Blender 3D / Shaders & Mesh)
  [4] 🌐 Universal  (General: Full-Stack / Clean Architecture / TDD)
100% Standard Library — Zero external dependencies.
"""

import argparse
import json
import os
import shutil
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

PROFILES = {
    "1": "automotive",
    "automotive": "automotive",
    "car": "automotive",
    "xehoi": "automotive",
    
    "2": "android",
    "android": "android",
    "mobile": "android",
    
    "3": "game",
    "game": "game",
    "unity": "game",
    "blender": "game",

    "4": "universal",
    "universal": "universal",
    "general": "universal",
    "all": "universal",
    "default": "universal",

    "5": "voice-assistant",
    "voice": "voice-assistant",
    "voice-assistant": "voice-assistant",
    "audio": "voice-assistant"
}

def log_ok(msg):
    print(f"  {GREEN}✔{RESET} {msg}")

def log_warn(msg):
    print(f"  {YELLOW}⚠{RESET} {msg}")

def log_err(msg):
    print(f"  {RED}✖{RESET} {msg}")

def get_base_dir() -> Path:
    return Path(__file__).resolve().parent.parent

def load_profile_meta(profile_id: str) -> dict:
    base_dir = get_base_dir()
    profile_json = base_dir / "profiles" / profile_id / "profile.json"
    if profile_json.exists():
        with open(profile_json, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def get_current_profile() -> str:
    base_dir = get_base_dir()
    active_file = base_dir / ".active-profile.json"
    if active_file.exists():
        try:
            with open(active_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("profile", "universal")
        except Exception:
            return "universal"
    return "universal"

def apply_profile(profile_id: str):
    base_dir = get_base_dir()
    profile_dir = base_dir / "profiles" / profile_id
    if not profile_dir.exists():
        log_err(f"Profile `{profile_id}` không tồn tại trong thư mục profiles/")
        return 1

    meta = load_profile_meta(profile_id)
    profile_name = meta.get("name", profile_id.upper())

    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{CYAN}   ⚙️  Kích hoạt Profile Dự án: {profile_name}{RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}\n")

    # 1. Ghi tệp trạng thái active
    active_file = base_dir / ".active-profile.json"
    status_data = {
        "profile": profile_id,
        "name": profile_name,
        "updated_at": "2026-09-22T21:20:00Z",
        "description": meta.get("description", ""),
        "essential_mcps": meta.get("essential_mcps", []),
        "active_councils": meta.get("active_councils", []),
        "rules_file": meta.get("rules_file", ""),
        "regression_matrix": meta.get("regression_matrix", "")
    }
    with open(active_file, "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2, ensure_ascii=False)
    log_ok(f"Đã lưu trạng thái cấu hình vào `{active_file.name}`")

    # 2. Tạo liên kết .agents/active-profile
    agents_dir = base_dir / ".agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    active_link = agents_dir / "active-profile"
    if active_link.is_symlink() or active_link.exists():
        if active_link.is_dir() and not active_link.is_symlink():
            shutil.rmtree(active_link)
        else:
            active_link.unlink()
    try:
        active_link.symlink_to(f"../profiles/{profile_id}")
        log_ok("Đã liên kết `.agents/active-profile` -> `profiles/" + profile_id + "`")
    except Exception as e:
        log_warn(f"Không thể tạo symlink `.agents/active-profile`: {e}")

    # 3. Kích hoạt Ma trận Kiểm thử Hồi quy tương ứng
    reg_src = profile_dir / "regression_matrix.json"
    reg_dest = base_dir / "templates" / "regression_matrix.active.json"
    if reg_src.exists():
        shutil.copy2(reg_src, reg_dest)
        log_ok(f"Đã kích hoạt ma trận kiểm thử: `{reg_dest.name}`")

    # 4. Kiểm tra sự sẵn sàng của MCP Server chuyên dụng
    print(f"\n{BOLD}Kiểm tra MCP Servers yêu cầu cho profile `{profile_id}`:{RESET}")
    global_mcp_config = Path.home() / ".gemini" / "config" / "mcp_config.json"
    active_mcps = []
    if global_mcp_config.exists():
        try:
            with open(global_mcp_config, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                active_mcps = list(cfg.get("mcpServers", {}).keys())
        except Exception:
            pass

    essential_mcps = meta.get("essential_mcps", [])
    for mcp in essential_mcps:
        if mcp in active_mcps:
            log_ok(f"MCP Server `{mcp}`: {GREEN}SẴN SÀNG (Active){RESET}")
        else:
            log_warn(f"MCP Server `{mcp}`: {YELLOW}CHƯA BẬT trong mcp_config.json{RESET}")

    # 5. Tóm tắt Hội đồng & Quy tắc áp dụng
    councils = meta.get("active_councils", [])
    print(f"\n{BOLD}Các Hội đồng & Quy tắc chuyên trách được áp dụng:{RESET}")
    for c in councils:
        print(f"  • {c}")

    print(f"\n{GREEN}{BOLD}✔ Hoàn tất cấu hình Profile: {profile_name}{RESET}")
    print(f"{DIM}Mọi yêu cầu tương tác và kiểm tra hồi quy sẽ tự động tuân thủ cấu hình này.{RESET}\n")
    return 0

def show_interactive_menu():
    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{CYAN}       🎯 Universal Agent DevKit — Profile Configuration              {RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}\n")

    current = get_current_profile()
    print(f"  {DIM}Profile đang kích hoạt hiện tại:{RESET} {BOLD}{CYAN}{current.upper()}{RESET}\n")
    print(f"  Vui lòng chọn 1 trong các Option cấu hình chuyên biệt:\n")
    print(f"    {BOLD}[1] 🚗 Xe hơi (Automotive){RESET}")
    print(f"        {DIM}Android Automotive OS, IVI, Flyme Auto, CAN Bus, vô lăng, split-screen.{RESET}\n")
    print(f"    {BOLD}[2] 📱 Android (Mobile App){RESET}")
    print(f"        {DIM}Solo-Dev workflow, anti-spam debounce, Jetpack Compose, an toàn mobile, ANR/OOM.{RESET}\n")
    print(f"    {BOLD}[3] 🎮 Game (Unity 6 & Blender){RESET}")
    print(f"        {DIM}Unity 6, Blender 3D, GC memory leak, DrawCall batching, mesh topology.{RESET}\n")
    print(f"    {BOLD}[4] 🌐 Universal (General / Clean Arch){RESET}")
    print(f"        {DIM}Full-Stack, Clean Architecture, TDD Paired Oracle, Zero Secret Leakage.{RESET}\n")
    print(f"    {DIM}[q] Thoát mà không thay đổi{RESET}\n")

    try:
        choice = input(f"{BOLD}Nhập lựa chọn của bạn (1, 2, 3, 4): {RESET}").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\nĐã hủy.")
        return 0

    if choice in ("q", "quit", "exit"):
        print("Đã thoát.")
        return 0

    if choice in PROFILES:
        target_profile = PROFILES[choice]
        return apply_profile(target_profile)
    else:
        log_err(f"Lựa chọn không hợp lệ: `{choice}`. Vui lòng nhập 1, 2, 3, hoặc 4.")
        return 1

def main():
    parser = argparse.ArgumentParser(description="Universal Agent DevKit Profile Configurator")
    parser.add_argument("-p", "--profile", choices=["automotive", "android", "game", "universal", "voice-assistant", "voice", "audio", "1", "2", "3", "4", "5", "car", "mobile", "unity", "general"],
                        help="Tên hoặc mã số profile cần kích hoạt (1=automotive, 2=android, 3=game, 4=universal, 5=voice-assistant)")
    parser.add_argument("-s", "--status", action="store_true", help="Hiển thị profile đang kích hoạt")
    args = parser.parse_args()

    if args.status:
        current = get_current_profile()
        meta = load_profile_meta(current)
        print(f"\n{BOLD}Profile hiện tại:{RESET} {GREEN}{meta.get('name', current)}{RESET}")
        print(f"{DIM}{meta.get('description', '')}{RESET}\n")
        return 0

    if args.profile:
        target = PROFILES.get(args.profile.lower())
        if target:
            return apply_profile(target)
        else:
            log_err(f"Profile không hợp lệ: {args.profile}")
            return 1

    return show_interactive_menu()

if __name__ == "__main__":
    sys.exit(main())
