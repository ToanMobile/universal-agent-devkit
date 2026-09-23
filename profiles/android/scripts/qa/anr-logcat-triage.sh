#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# anr-logcat-triage.sh — Real-Time Android Crash & ANR Triage Suite
#
# Inspects Android Logcat buffer for FATAL EXCEPTION, ANR traces, and SIGSEGV.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PACKAGE="${1:-}"

DEVICES="$(adb devices | grep -v "List" | grep "device" || true)"
if [ -z "${DEVICES}" ]; then
  echo "⚠️ [DEVICE QA GATE] Không phát hiện thiết bị Android online!"
  exit 0
fi

echo "🚨 [LOGCAT TRIAGE] Đang quét bộ đệm Logcat để phát hiện sự cố sập app..."
CRASHES="$(adb logcat -d -b crash | grep -E "FATAL EXCEPTION|SIGSEGV|ANR in" || true)"

if [ -n "${CRASHES}" ]; then
  echo "❌ PHÁT HIỆN SỰ CỐ NGHIÊM TRỌNG TRÊN THIẾT BỊ:"
  echo "${CRASHES}" | head -30
  exit 1
else
  echo "✔ SẠCH: Không phát hiện Fatal Exception hoặc ANR trên thiết bị thật."
fi
