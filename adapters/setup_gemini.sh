#!/usr/bin/env bash
# setup_gemini.sh — Configure Antigravity & Google Gemini integration (Additive Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy
LANGUAGE="${3:-en}"

echo "Configuring Antigravity / Google Gemini for: $TARGET_DIR (mode: $MODE, lang: $LANGUAGE)"
mkdir -p "$TARGET_DIR/.agents/skills"
rm -rf "$TARGET_DIR/.agents/rules"

# 1. Setup AGENTS.md (Sole SSOT)
rm -f "$TARGET_DIR/Agent.md" "$TARGET_DIR/GEMINI.md"
if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    cp "$TARGET_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md.bak"
    echo "  - Backed up existing AGENTS.md to AGENTS.md.bak"
  fi
  rm -f "$TARGET_DIR/AGENTS.md"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  else
    cp "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  fi
fi

# 2. Additive Merge for mcp_config.json
python3 "$DEVKIT_ROOT/scripts/merge_json.py" "$DEVKIT_ROOT/mcp/mcp_config.json" "$TARGET_DIR/mcp_config.json"
echo "  - Merged MCP servers into mcp_config.json (preserved existing custom MCPs)"

# 3. Additive Item-by-Item Link for Skills (Preserving custom user skills)
for skill in "$DEVKIT_ROOT/skills"/*; do
  [ -e "$skill" ] || continue
  skill_name="$(basename "$skill")"
  target_skill_path="$TARGET_DIR/.agents/skills/$skill_name"
  rm -rf "$target_skill_path"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$skill" "$target_skill_path"
  else
    cp -R "$skill" "$target_skill_path"
  fi
done

echo "✓ Antigravity & Google Gemini (.agents/skills, AGENTS.md, mcp_config.json) ready."
