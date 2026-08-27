#!/usr/bin/env bash
# setup_cursor.sh — Configure Cursor IDE (both legacy .cursorrules and modern .cursor/rules/*.mdc)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"
LANGUAGE="${3:-en}"
DOMAIN_UPPER="$(echo "$DOMAIN" | tr '[:lower:]' '[:upper:]')"

echo "Configuring Cursor IDE for: $TARGET_DIR (domain: $DOMAIN, lang: $LANGUAGE)"
mkdir -p "$TARGET_DIR/.cursor/rules"

LANG_DIRECTIVE="Default communication language: English. Switch to Vietnamese when requested by user. Code identifiers/paths: always English."
if [ "$LANGUAGE" = "vi" ]; then
  LANG_DIRECTIVE="Default communication language: Vietnamese. Code identifiers/paths: always English."
fi

# 1. Generate consolidated .cursorrules
cat << HEADER_EOF > "$TARGET_DIR/.cursorrules"
# Cursor & Multi-Model Master Rules (Universal DevKit)
# Language Policy: $LANG_DIRECTIVE

HEADER_EOF

cat "$DEVKIT_ROOT/core/AGENTS.md" >> "$TARGET_DIR/.cursorrules"

if [ -d "$DEVKIT_ROOT/domains/$DOMAIN/rulebook" ]; then
  echo "" >> "$TARGET_DIR/.cursorrules"
  echo "---" >> "$TARGET_DIR/.cursorrules"
  echo "## Domain Specific Rules ($DOMAIN)" >> "$TARGET_DIR/.cursorrules"
  for rule in "$DEVKIT_ROOT/domains/$DOMAIN/rulebook"/*.md; do
    [ -f "$rule" ] || continue
    echo "" >> "$TARGET_DIR/.cursorrules"
    echo "### $(basename "$rule" .md)" >> "$TARGET_DIR/.cursorrules"
    cat "$rule" >> "$TARGET_DIR/.cursorrules"
  done
fi

# 2. Generate Modern Cursor Rules (.cursor/rules/*.mdc)
cat << MDC_EOF > "$TARGET_DIR/.cursor/rules/core-protocol.mdc"
---
description: Universal Quality Protocol, Pre-Code Gate, Zero-Defect, and Verification Rules
globs: *
alwaysApply: true
---

# Core Protocol (Language: $LANGUAGE)
# $LANG_DIRECTIVE

MDC_EOF
cat "$DEVKIT_ROOT/core/AGENTS.md" >> "$TARGET_DIR/.cursor/rules/core-protocol.mdc"

# Domain specific MDC rule
if [ -d "$DEVKIT_ROOT/domains/$DOMAIN/rulebook" ]; then
  cat << DOMAIN_MDC_EOF > "$TARGET_DIR/.cursor/rules/${DOMAIN}-domain.mdc"
---
description: ${DOMAIN_UPPER} specific architectural, testing, and engineering guidelines
globs: **/*.kt, **/*.java, **/*.ts, **/*.tsx, **/*.js, **/*.py, **/*.swift
alwaysApply: true
---

# Domain Rules: ${DOMAIN_UPPER}

DOMAIN_MDC_EOF
  for rule in "$DEVKIT_ROOT/domains/$DOMAIN/rulebook"/*.md; do
    [ -f "$rule" ] || continue
    echo "" >> "$TARGET_DIR/.cursor/rules/${DOMAIN}-domain.mdc"
    echo "## $(basename "$rule" .md)" >> "$TARGET_DIR/.cursor/rules/${DOMAIN}-domain.mdc"
    cat "$rule" >> "$TARGET_DIR/.cursor/rules/${DOMAIN}-domain.mdc"
  done
fi

echo "✓ Cursor IDE (.cursorrules & .cursor/rules/*.mdc) ready."
