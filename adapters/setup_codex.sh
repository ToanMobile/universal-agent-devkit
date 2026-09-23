#!/usr/bin/env bash
# setup_codex.sh — Configure OpenAI Codex / ChatGPT Canvas (Non-Destructive Smart Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"
LANGUAGE="${3:-en}"

echo "Configuring OpenAI Codex / ChatGPT for: $TARGET_DIR (domain: $DOMAIN, lang: $LANGUAGE)"

# 1. Non-Destructive Smart Merge for CODEX.md and AGENTS.md
if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ] && [ -f "$TARGET_DIR/CODEX.md" ] && [ ! -f "$TARGET_DIR/CODEX_old.md" ]; then
  cp "$TARGET_DIR/CODEX.md" "$TARGET_DIR/CODEX_old.md"
  echo "  - Preserved original CODEX.md as CODEX_old.md"
fi

if [ -f "$TARGET_DIR/CODEX.md" ]; then
  CODEX_INJECT="$DEVKIT_ROOT/templates/claude_injection_block.md"
  python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$CODEX_INJECT" "$TARGET_DIR/CODEX.md" "universal-agent-devkit"
fi

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    if [ ! -f "$TARGET_DIR/AGENTS_old.md" ]; then
      cp "$TARGET_DIR/AGENTS.md" "$TARGET_DIR/AGENTS_old.md"
      echo "  - Preserved original AGENTS.md as AGENTS_old.md"
    fi
    AGENTS_INJECT="$DEVKIT_ROOT/templates/agents_injection_block.md"
    python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$AGENTS_INJECT" "$TARGET_DIR/AGENTS.md" "universal-agent-devkit"
    echo "  - Injected DevKit standards into existing AGENTS.md (Preserved custom architecture)"
  elif [ ! -f "$TARGET_DIR/AGENTS.md" ]; then
    ln -sfn "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
    echo "  - Created AGENTS.md link to DevKit SSOT"
  fi
fi

echo "✓ OpenAI Codex / ChatGPT (AGENTS.md SSOT) ready."
