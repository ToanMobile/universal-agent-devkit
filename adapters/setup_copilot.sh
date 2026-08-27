#!/usr/bin/env bash
# setup_copilot.sh — Configure GitHub Copilot (.github/copilot-instructions.md)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"
LANGUAGE="${3:-en}"

echo "Configuring GitHub Copilot for: $TARGET_DIR (domain: $DOMAIN, lang: $LANGUAGE)"
mkdir -p "$TARGET_DIR/.github"

LANG_DIRECTIVE="Default communication language: English. Switch to Vietnamese when requested. Code identifiers/paths: always English."
if [ "$LANGUAGE" = "vi" ]; then
  LANG_DIRECTIVE="Default communication language: Vietnamese. Code identifiers/paths: always English."
fi

cat << HEADER_EOF > "$TARGET_DIR/.github/copilot-instructions.md"
# GitHub Copilot Custom Instructions
# Language Policy: $LANG_DIRECTIVE

HEADER_EOF

cat "$DEVKIT_ROOT/core/AGENTS.md" >> "$TARGET_DIR/.github/copilot-instructions.md"

if [ -d "$DEVKIT_ROOT/domains/$DOMAIN/rulebook" ]; then
  echo "" >> "$TARGET_DIR/.github/copilot-instructions.md"
  echo "---" >> "$TARGET_DIR/.github/copilot-instructions.md"
  echo "## Domain Specific Guidelines ($DOMAIN)" >> "$TARGET_DIR/.github/copilot-instructions.md"
  for rule in "$DEVKIT_ROOT/domains/$DOMAIN/rulebook"/*.md; do
    [ -f "$rule" ] || continue
    echo "" >> "$TARGET_DIR/.github/copilot-instructions.md"
    echo "### $(basename "$rule" .md)" >> "$TARGET_DIR/.github/copilot-instructions.md"
    cat "$rule" >> "$TARGET_DIR/.github/copilot-instructions.md"
  done
fi

echo "✓ GitHub Copilot (.github/copilot-instructions.md) ready."
