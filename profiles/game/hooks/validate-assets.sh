#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# validate-assets.sh — Unity Asset Database Hygiene Hook
#
# Intercepts file writes inside Unity's `Assets/` directory.
# Strictly forbids creating documentation, logs, or temporary files (.md, .tmp,
# .bak, .log, .rst, notes.txt) inside `Assets/`, which forces the Unity Editor
# to generate rogue `.meta` files, polluting Git and corrupting GUID references.
#
# Documentation belongs in `docs/` or project root.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Dynamic toolchain activation: Skip if this is not a Unity project
if [ ! -d "${REPO_ROOT}/Assets" ] && [ ! -d "${REPO_ROOT}/ProjectSettings" ]; then
  exit 0
fi

# Scan for staged or uncommitted rogue files in Assets/
ROGUE_FILES="$( { git status --porcelain 2>/dev/null || true; } | \
  grep -E '^[ ?A-Z][ ?A-Z] Assets/.*(\.md|\.tmp|\.bak|\.log|\.rst|notes\.txt)$' || true )"

if [ -n "${ROGUE_FILES}" ]; then
  echo "❌ [UNITY ASSET HYGIENE VIOLATION]" >&2
  echo "Phát hiện file tài liệu hoặc file rác được tạo bên trong thư mục 'Assets/':" >&2
  echo "${ROGUE_FILES}" >&2
  echo "" >&2
  echo "NGUY CƠ: Unity Editor sẽ tự động sinh file '.meta' rác, gây gãy GUID và xung đột Git!" >&2
  echo "GIẢI PHÁP: Hãy di chuyển toàn bộ tệp markdown/tài liệu ra ngoài thư mục 'docs/' hoặc thư mục gốc dự án." >&2
  exit 1
fi

exit 0
