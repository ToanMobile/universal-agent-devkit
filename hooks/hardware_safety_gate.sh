#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# hardware_safety_gate.sh — Physical Hardware & Embedded Device Brick Protection
#
# Intercepts dangerous shell commands that risk bricking physical test devices,
# automotive IVI head-units, or embedded Android/Linux boards.
#
# BLOCKS (exit 2) when detecting:
#   • adb remount / mount -o remount,rw /system (dm-verity corruption)
#   • dd to raw disk blocks (/dev/block/...)
#   • fastboot flash / fastboot erase
#   • rm -rf /system / /vendor / /boot
#
# Protocol: stdin JSON; exit 2 blocks (stderr -> Agent); exit 0 allows.
# ─────────────────────────────────────────────────────────────────────────────
set -u

INPUT="$(cat)"
[ -z "${INPUT}" ] && exit 0

[ "${HARDWARE_SAFETY_GATE:-1}" = "0" ] && exit 0
[ "${HARDWARE_OVERRIDE:-0}" = "1" ] && exit 0

python3 <<PY
import sys, json, re

raw = """${INPUT}"""
try:
    data = json.loads(raw) if raw.strip() else {}
    inp = data.get("tool_input") or data.get("input") or {}
    cmd = inp.get("command") or inp.get("CommandLine") or ""

    DANGEROUS_HARDWARE_PATTERNS = [
        (r"\badb\s+remount\b", "adb remount (Nguy cơ phá hủy dm-verity gây brick thiết bị)"),
        (r"\bmount\s+.*-o\s+.*rw\s+/system\b", "mount /system rw (Ghi đè phân vùng hệ điều hành)"),
        (r"\bdd\s+.*of=/dev/block/\b", "dd to raw partition (Ghi đè trực tiếp phân vùng ổ đĩa/eMMC)"),
        (r"\bfastboot\s+(flash|erase)\b", "fastboot flash/erase (Can thiệp bootloader thiết bị thật)"),
        (r"\brm\s+-rf\s+/(system|vendor|boot)\b", "Xóa phân vùng hệ thống cốt lõi")
    ]

    for pat, label in DANGEROUS_HARDWARE_PATTERNS:
        if re.search(pat, cmd):
            sys.stderr.write(f"\n🛑 [HARDWARE SAFETY GATE REJECTED]\n")
            sys.stderr.write(f"Lệnh bị chặn đứng vì có nguy cơ làm hỏng phần cứng vật lý (Device Bricking):\n")
            sys.stderr.write(f"  • Mẫu vi phạm: {label}\n")
            sys.stderr.write(f"  • Lệnh thực thi: {cmd}\n\n")
            sys.stderr.write(f"Nếu bạn chắc chắn đang ở môi trường giả lập an toàn, hãy đặt biến môi trường HARDWARE_OVERRIDE=1 để bỏ qua.\n")
            sys.exit(2)

except Exception:
    pass

sys.exit(0)
PY
