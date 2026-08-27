#!/usr/bin/env bash
# setup_gemini.sh — Configure Antigravity & Google Gemini integration
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy

echo "Configuring Antigravity / Google Gemini for: $TARGET_DIR (mode: $MODE)"
mkdir -p "$TARGET_DIR/.agents/rules"

# 1. Setup AGENTS.md & GEMINI.md
if [ "$MODE" = "symlink" ]; then
  ln -sf "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  ln -sf "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/GEMINI.md"
else
  [ -f "$TARGET_DIR/AGENTS.md" ] || cp "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  [ -f "$TARGET_DIR/GEMINI.md" ] || cp "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/GEMINI.md"
fi

# 2. Setup mcp_config.json if not present
if [ ! -f "$TARGET_DIR/mcp_config.json" ]; then
  if [ "$MODE" = "symlink" ]; then
    ln -sf "$DEVKIT_ROOT/mcp/mcp_config.json" "$TARGET_DIR/mcp_config.json"
  else
    cp "$DEVKIT_ROOT/mcp/mcp_config.json" "$TARGET_DIR/mcp_config.json"
  fi
  echo "  - Configured mcp_config.json"
fi

# 3. Setup .agents/skills & rules
if [ "$MODE" = "symlink" ]; then
  rm -rf "$TARGET_DIR/.agents/skills"
  ln -sf "$DEVKIT_ROOT/skills" "$TARGET_DIR/.agents/skills"
  rm -rf "$TARGET_DIR/.agents/rules"
  ln -sf "$DEVKIT_ROOT/core/rules" "$TARGET_DIR/.agents/rules"
else
  mkdir -p "$TARGET_DIR/.agents/skills" "$TARGET_DIR/.agents/rules"
  cp -R "$DEVKIT_ROOT/skills/"* "$TARGET_DIR/.agents/skills/"
  cp -R "$DEVKIT_ROOT/core/rules/"* "$TARGET_DIR/.agents/rules/"
fi

echo "✓ Antigravity & Google Gemini (.agents/skills, .agents/rules, GEMINI.md, AGENTS.md, mcp_config.json) ready."
