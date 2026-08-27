#!/usr/bin/env bash
# setup_gemini.sh — Configure Antigravity & Google Gemini integration (Additive Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy
LANGUAGE="${3:-en}"

echo "Configuring Antigravity / Google Gemini for: $TARGET_DIR (mode: $MODE, lang: $LANGUAGE)"
mkdir -p "$TARGET_DIR/.agents/skills" "$TARGET_DIR/.agents/rules"

# 1. Setup AGENTS.md & GEMINI.md (Safely backup if existing regular file)
for md_file in "AGENTS.md" "GEMINI.md"; do
  if [ -f "$TARGET_DIR/$md_file" ] && [ ! -L "$TARGET_DIR/$md_file" ]; then
    cp "$TARGET_DIR/$md_file" "$TARGET_DIR/${md_file}.bak"
    echo "  - Backed up existing $md_file to ${md_file}.bak"
  fi
  if [ "$MODE" = "symlink" ]; then
    ln -sf "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/$md_file"
  else
    cp "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/$md_file"
  fi
done

# 2. Additive Merge for mcp_config.json
python3 "$DEVKIT_ROOT/scripts/merge_json.py" "$DEVKIT_ROOT/mcp/mcp_config.json" "$TARGET_DIR/mcp_config.json"
echo "  - Merged MCP servers into mcp_config.json (preserved existing custom MCPs)"

# 3. Additive Item-by-Item Link for Skills (Preserving custom user skills)
for skill in "$DEVKIT_ROOT/skills"/*; do
  [ -e "$skill" ] || continue
  skill_name="$(basename "$skill")"
  if [ "$MODE" = "symlink" ]; then
    ln -sf "$skill" "$TARGET_DIR/.agents/skills/$skill_name"
  else
    cp -R "$skill" "$TARGET_DIR/.agents/skills/$skill_name"
  fi
done

# 4. Additive Item-by-Item Link for Rules (Preserving custom user rules)
for rule in "$DEVKIT_ROOT/core/rules"/*; do
  [ -e "$rule" ] || continue
  rule_name="$(basename "$rule")"
  if [ "$MODE" = "symlink" ]; then
    ln -sf "$rule" "$TARGET_DIR/.agents/rules/$rule_name"
  else
    cp -R "$rule" "$TARGET_DIR/.agents/rules/$rule_name"
  fi
done

echo "✓ Antigravity & Google Gemini (.agents/skills, .agents/rules, GEMINI.md, AGENTS.md, mcp_config.json) ready (Custom skills/rules preserved)."
