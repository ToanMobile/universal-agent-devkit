#!/usr/bin/env bash
# setup_aider.sh — Configure Aider (.aider.conf.yml & CONVENTIONS.md)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Configuring Aider for: $TARGET_DIR"

# 1. Generate CONVENTIONS.md
cat << 'HEADER_EOF' > "$TARGET_DIR/CONVENTIONS.md"
# Project Coding Conventions & Rules (Aider Compatible)
# Auto-generated from Universal Multi-Agent DevKit

HEADER_EOF

cat "$DEVKIT_ROOT/core/AGENTS.md" >> "$TARGET_DIR/CONVENTIONS.md"

# 2. Setup .aider.conf.yml
if [ ! -f "$TARGET_DIR/.aider.conf.yml" ]; then
  cat << 'AIDER_EOF' > "$TARGET_DIR/.aider.conf.yml"
read:
  - CONVENTIONS.md
auto-commits: false
lint-cmd: "git diff --check"
test-cmd: "./gradlew testDebugUnitTest --tests '*Test*' || npm test || pytest"
AIDER_EOF
fi

echo "✓ Aider (CONVENTIONS.md & .aider.conf.yml) ready."
