#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# dump-view-hierarchy.sh — Real Device UIAutomator Hierarchy Dump
#
# Dumps the active window's UI layout hierarchy to local XML for automated
# layout inspection, touch target auditing, and accessibility verification.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

OUT_FILE="${1:-build/view_hierarchy.xml}"
mkdir -p "$(dirname "${OUT_FILE}")"

DEVICES="$(adb devices | grep -v "List" | grep "device" || true)"
if [ -z "${DEVICES}" ]; then
  echo "⚠️ [DEVICE QA GATE] Không phát hiện thiết bị Android online!"
  exit 0
fi

echo "📱 [UI DUMP] Đang trích xuất cây phân cấp giao diện (UIAutomator dump)..."
adb shell uiautomator dump /sdcard/view_dump.xml > /dev/null 2>&1
adb pull /sdcard/view_dump.xml "${OUT_FILE}" > /dev/null 2>&1
adb shell rm -f /sdcard/view_dump.xml > /dev/null 2>&1

echo "✔ Đã xuất cây giao diện thành công vào: ${OUT_FILE}"
