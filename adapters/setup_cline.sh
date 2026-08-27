#!/usr/bin/env bash
# setup_cline.sh — Configure Cline & Roo Code (.clinerules & .roomodes)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${2:-general}"

echo "Configuring Cline / Roo Code for: $TARGET_DIR (domain: $DOMAIN)"

# 1. Generate .clinerules
cat << 'HEADER_EOF' > "$TARGET_DIR/.clinerules"
# Cline & Roo Code Master Rules (Universal DevKit)
# Zero-Defect, Paired Executable Oracle, Pre-Code Gate

HEADER_EOF

cat "$DEVKIT_ROOT/core/AGENTS.md" >> "$TARGET_DIR/.clinerules"

# 2. Generate .roomodes for specialized roles
cat << 'ROOMODES_EOF' > "$TARGET_DIR/.roomodes"
{
  "customModes": [
    {
      "slug": "architect",
      "name": "Principal Architect",
      "roleDefinition": "You are a Principal Software Architect specializing in clean modular design, seam isolation, and API design.",
      "groups": ["read", "browser", "command"]
    },
    {
      "slug": "reviewer",
      "name": "Multi-Lens Code Reviewer",
      "roleDefinition": "You are a Zero-Defect Code Reviewer conducting strict 7-lens reviews (Compile, Runtime, State, Test, UX, Security, Architecture).",
      "groups": ["read"]
    },
    {
      "slug": "seti",
      "name": "SETI Test Architect",
      "roleDefinition": "You are a Software Engineer in Test (SETI) specializing in TDD (RED->GREEN), test harnesses, and mutation testing.",
      "groups": ["read", "edit", "command"]
    }
  ]
}
ROOMODES_EOF

echo "✓ Cline & Roo Code (.clinerules & .roomodes) ready."
