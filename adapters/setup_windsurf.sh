#!/usr/bin/env bash
# setup_windsurf.sh — Configure Windsurf / Cascade (Codeium)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"
LANGUAGE="${3:-en}"

echo "Configuring Windsurf / Cascade for: $TARGET_DIR (domain: $DOMAIN, lang: $LANGUAGE)"
mkdir -p "$TARGET_DIR/.windsurf/rules"

LANG_DIRECTIVE="Default communication language: English. Switch to Vietnamese when requested. Code identifiers/paths: always English."
if [ "$LANGUAGE" = "vi" ]; then
  LANG_DIRECTIVE="Default communication language: Vietnamese. Code identifiers/paths: always English."
fi

cat << HEADER_EOF > "$TARGET_DIR/.windsurfrules"
# Windsurf / Cascade Master Rules (Universal DevKit)
# Language Policy: $LANG_DIRECTIVE

HEADER_EOF

cat "$DEVKIT_ROOT/core/AGENTS.md" >> "$TARGET_DIR/.windsurfrules"

if [ -d "$DEVKIT_ROOT/domains/$DOMAIN/rulebook" ]; then
  echo "" >> "$TARGET_DIR/.windsurfrules"
  echo "---" >> "$TARGET_DIR/.windsurfrules"
  echo "## Domain Specific Rules ($DOMAIN)" >> "$TARGET_DIR/.windsurfrules"
  for rule in "$DEVKIT_ROOT/domains/$DOMAIN/rulebook"/*.md; do
    [ -f "$rule" ] || continue
    echo "" >> "$TARGET_DIR/.windsurfrules"
    echo "### $(basename "$rule" .md)" >> "$TARGET_DIR/.windsurfrules"
    cat "$rule" >> "$TARGET_DIR/.windsurfrules"
  done
fi

echo "✓ Windsurf / Cascade (.windsurfrules) ready."
