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

cat << HEADER_EOF > "$TARGET_DIR/CODEX.md"
# CODEX.md — Master Rules for OpenAI Codex & ChatGPT Canvas
# Language Policy: $LANG_DIRECTIVE

HEADER_EOF

cat "$DEVKIT_ROOT/core/AGENTS.md" >> "$TARGET_DIR/CODEX.md"

if [ -d "$DEVKIT_ROOT/domains/$DOMAIN/rulebook" ]; then
  echo "" >> "$TARGET_DIR/CODEX.md"
  echo "---" >> "$TARGET_DIR/CODEX.md"
  echo "## Domain Specific Guidelines ($DOMAIN)" >> "$TARGET_DIR/CODEX.md"
  for rule in "$DEVKIT_ROOT/domains/$DOMAIN/rulebook"/*.md; do
    [ -f "$rule" ] || continue
    echo "" >> "$TARGET_DIR/CODEX.md"
    echo "### $(basename "$rule" .md)" >> "$TARGET_DIR/CODEX.md"
    cat "$rule" >> "$TARGET_DIR/CODEX.md"
  done
fi

echo "✓ OpenAI Codex / ChatGPT (CODEX.md) ready."
