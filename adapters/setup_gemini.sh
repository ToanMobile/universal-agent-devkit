#!/usr/bin/env bash
# setup_gemini.sh — Configure Antigravity & Google Gemini integration (Non-Destructive Smart Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy
LANGUAGE="${3:-en}"
SKIP_EXISTING="${SKIP_EXISTING:-0}"

echo "Configuring Antigravity / Google Gemini for: $TARGET_DIR (mode: $MODE, lang: $LANGUAGE, skip_existing: $SKIP_EXISTING)"
mkdir -p "$TARGET_DIR/.agents/skills"

# 1. Non-Destructive Smart Merge for AGENTS.md, GEMINI.md, and Agent.md
if [ -f "$TARGET_DIR/GEMINI.md" ] || [ -f "$TARGET_DIR/Agent.md" ]; then
  GEMINI_TARGET="${TARGET_DIR}/GEMINI.md"
  [ -f "$TARGET_DIR/Agent.md" ] && GEMINI_TARGET="${TARGET_DIR}/Agent.md"
  GEMINI_INJECT="$DEVKIT_ROOT/templates/claude_injection_block.md"
  python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$GEMINI_INJECT" "$GEMINI_TARGET" "universal-agent-devkit"
fi

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    if [ ! -f "$TARGET_DIR/AGENTS.md.bak" ]; then
      cp "$TARGET_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md.bak"
    fi
    AGENTS_INJECT="$DEVKIT_ROOT/templates/agents_injection_block.md"
    python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$AGENTS_INJECT" "$TARGET_DIR/AGENTS.md" "universal-agent-devkit"
    echo "  - Injected DevKit standards into existing AGENTS.md (Preserved custom architecture)"
  elif [ ! -f "$TARGET_DIR/AGENTS.md" ]; then
    if [ "$MODE" = "symlink" ]; then
      ln -sfn "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
    else
      cp "$DEVKIT_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
    fi
    echo "  - Created AGENTS.md link to DevKit SSOT"
  fi
fi

# 2. Additive Merge for mcp_config.json
python3 "$DEVKIT_ROOT/scripts/merge_json.py" "$DEVKIT_ROOT/mcp/mcp_config.json" "$TARGET_DIR/mcp_config.json"
echo "  - Merged MCP servers into mcp_config.json (preserved existing custom MCPs)"

# 3. Smart Item-by-Item Link for Skills (Preserving custom user skills)
for skill in "$DEVKIT_ROOT/skills"/*; do
  [ -e "$skill" ] || continue
  skill_name="$(basename "$skill")"
  target_skill_path="$TARGET_DIR/.agents/skills/$skill_name"
  if [ "$SKIP_EXISTING" = "1" ] && [ -e "$target_skill_path" ] && [ ! -L "$target_skill_path" ]; then
    echo "  - Preserved custom skill: $skill_name (--skip-existing active)"
    continue
  fi
  rm -rf "$target_skill_path"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$skill" "$target_skill_path"
  else
    cp -R "$skill" "$target_skill_path"
  fi
done

echo "✓ Antigravity & Google Gemini (.agents/skills, AGENTS.md, mcp_config.json) ready."
