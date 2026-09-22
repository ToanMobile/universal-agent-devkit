#!/usr/bin/env bash
# setup_cursor.sh — Configure Cursor IDE (both legacy .cursorrules and modern .cursor/rules/*.mdc)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"
LANGUAGE="${3:-en}"
DOMAIN_UPPER="$(echo "$DOMAIN" | tr '[:lower:]' '[:upper:]')"

echo "Configuring Cursor IDE for: $TARGET_DIR (domain: $DOMAIN, lang: $LANGUAGE)"
rm -rf "$TARGET_DIR/.cursor/rules" "$TARGET_DIR/.cursorrules.bak"

LANG_DIRECTIVE="Default communication language: English. Switch to Vietnamese when requested by user. Code identifiers/paths: always English."
if [ "$LANGUAGE" = "vi" ]; then
  LANG_DIRECTIVE="Default communication language: Vietnamese. Code identifiers/paths: always English."
fi

# 1. Setup AGENTS.md (Cursor natively supports AGENTS.md at root)
rm -rf "$TARGET_DIR/.cursor/rules" "$TARGET_DIR/.cursorrules" "$TARGET_DIR/.cursorrules.bak"

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    cp "$TARGET_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md.bak"
  fi
  rm -f "$TARGET_DIR/AGENTS.md"
  ln -sfn "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
fi

echo "✓ Cursor IDE (AGENTS.md SSOT) ready."
