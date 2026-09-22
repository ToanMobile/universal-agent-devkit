#!/usr/bin/env bash
# setup_codex.sh — Configure OpenAI Codex / ChatGPT Canvas / OpenHands
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"
LANGUAGE="${3:-en}"

echo "Configuring OpenAI Codex / ChatGPT for: $TARGET_DIR (domain: $DOMAIN, lang: $LANGUAGE)"

LANG_DIRECTIVE="Default communication language: English. Switch to Vietnamese when requested. Code identifiers/paths: always English."
if [ "$LANGUAGE" = "vi" ]; then
  LANG_DIRECTIVE="Default communication language: Vietnamese. Code identifiers/paths: always English."
fi

# 1. Setup AGENTS.md (Codex natively supports AGENTS.md at root)
rm -f "$TARGET_DIR/CODEX.md"

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    cp "$TARGET_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md.bak"
  fi
  rm -f "$TARGET_DIR/AGENTS.md"
  ln -sfn "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
fi

echo "✓ OpenAI Codex / ChatGPT (AGENTS.md SSOT) ready."
