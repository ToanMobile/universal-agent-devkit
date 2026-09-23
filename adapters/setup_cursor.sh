#!/usr/bin/env bash
# setup_cursor.sh — Configure Cursor IDE (Non-Destructive Smart Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"
LANGUAGE="${3:-en}"

echo "Configuring Cursor IDE for: $TARGET_DIR (domain: $DOMAIN, lang: $LANGUAGE)"

# 1. Non-Destructive Smart Merge for .cursorrules and AGENTS.md
if [ -f "$TARGET_DIR/.cursorrules" ]; then
  CURSOR_INJECT="$DEVKIT_ROOT/templates/claude_injection_block.md"
  python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$CURSOR_INJECT" "$TARGET_DIR/.cursorrules" "universal-agent-devkit"
fi

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    if [ ! -f "$TARGET_DIR/AGENTS.md.bak" ]; then
      cp "$TARGET_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md.bak"
    fi
    AGENTS_INJECT="$DEVKIT_ROOT/templates/agents_injection_block.md"
    python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$AGENTS_INJECT" "$TARGET_DIR/AGENTS.md" "universal-agent-devkit"
    echo "  - Injected DevKit standards into existing AGENTS.md (Preserved custom architecture)"
  elif [ ! -f "$TARGET_DIR/AGENTS.md" ]; then
    ln -sfn "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
    echo "  - Created AGENTS.md link to DevKit SSOT"
  fi
fi

echo "✓ Cursor IDE (AGENTS.md SSOT) ready."
