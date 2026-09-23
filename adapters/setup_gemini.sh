#!/usr/bin/env bash
# setup_gemini.sh — Configure Antigravity & Google Gemini integration (Non-Destructive Smart Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy
LANGUAGE="${3:-en}"
SKIP_EXISTING="${SKIP_EXISTING:-0}"

source "$DEVKIT_ROOT/scripts/backup_conflict.sh"

echo "Configuring Antigravity / Google Gemini for: $TARGET_DIR (mode: $MODE, lang: $LANGUAGE, skip_existing: $SKIP_EXISTING)"

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  backup_dir_if_user_content "$TARGET_DIR/.agents/skills" "$DEVKIT_ROOT"
fi
mkdir -p "$TARGET_DIR/.agents/skills"

# 1. Non-Destructive Smart Merge for AGENTS.md, GEMINI.md, and Agent.md
if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/GEMINI.md" ] && [ ! -f "$TARGET_DIR/GEMINI_old.md" ]; then
    cp "$TARGET_DIR/GEMINI.md" "$TARGET_DIR/GEMINI_old.md"
  fi
  if [ -f "$TARGET_DIR/Agent.md" ] && [ ! -f "$TARGET_DIR/Agent_old.md" ]; then
    cp "$TARGET_DIR/Agent.md" "$TARGET_DIR/Agent_old.md"
  fi
fi

if [ -f "$TARGET_DIR/GEMINI.md" ] || [ -f "$TARGET_DIR/Agent.md" ]; then
  GEMINI_TARGET="${TARGET_DIR}/GEMINI.md"
  [ -f "$TARGET_DIR/Agent.md" ] && GEMINI_TARGET="${TARGET_DIR}/Agent.md"
  GEMINI_INJECT="$DEVKIT_ROOT/templates/claude_injection_block.md"
  python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$GEMINI_INJECT" "$GEMINI_TARGET" "universal-agent-devkit"
fi

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    if [ ! -f "$TARGET_DIR/AGENTS_old.md" ]; then
      cp "$TARGET_DIR/AGENTS.md" "$TARGET_DIR/AGENTS_old.md"
      echo "  - Preserved original AGENTS.md as AGENTS_old.md"
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
if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ] && [ -f "$TARGET_DIR/mcp_config.json" ] && [ ! -f "$TARGET_DIR/mcp_config_old.json" ]; then
  cp "$TARGET_DIR/mcp_config.json" "$TARGET_DIR/mcp_config_old.json"
fi
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
  if [ -e "$target_skill_path" ] && [ ! -L "$target_skill_path" ]; then
    backup_conflict "$target_skill_path" "$DEVKIT_ROOT"
  fi
  rm -rf "$target_skill_path"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$skill" "$target_skill_path"
  else
    cp -R "$skill" "$target_skill_path"
  fi
done

# Clean broken symlinks if any
find "$TARGET_DIR/.agents/skills" -type l ! -exec test -e {} \; -delete 2>/dev/null || true

echo "✓ Antigravity & Google Gemini (.agents/skills, AGENTS.md, mcp_config.json) ready."
