#!/usr/bin/env bash
# setup_claude.sh — Configure Claude Code integration in target project (Non-Destructive Smart Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy
LANGUAGE="${3:-en}"
SKIP_EXISTING="${SKIP_EXISTING:-0}"

source "$DEVKIT_ROOT/scripts/backup_conflict.sh"

echo "Configuring Claude Code for: $TARGET_DIR (mode: $MODE, lang: $LANGUAGE, skip_existing: $SKIP_EXISTING)"

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  backup_dir_if_user_content "$TARGET_DIR/.claude/hooks" "$DEVKIT_ROOT"
  backup_dir_if_user_content "$TARGET_DIR/.claude/commands" "$DEVKIT_ROOT"
  backup_dir_if_user_content "$TARGET_DIR/.claude/agents" "$DEVKIT_ROOT"
fi

mkdir -p "$TARGET_DIR/.claude/hooks" "$TARGET_DIR/.claude/commands" "$TARGET_DIR/.claude/agents"

# 1. Non-Destructive Smart Merge for CLAUDE.md and AGENTS.md
if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ] && [ -f "$TARGET_DIR/CLAUDE.md" ] && [ ! -L "$TARGET_DIR/CLAUDE.md" ]; then
  if ! grep -q "universal-agent-devkit" "$TARGET_DIR/CLAUDE.md" 2>/dev/null && [ ! -f "$TARGET_DIR/CLAUDE_old.md" ]; then
    cp "$TARGET_DIR/CLAUDE.md" "$TARGET_DIR/CLAUDE_old.md"
    echo "  - Preserved original CLAUDE.md as CLAUDE_old.md"
  fi
fi

CLAUDE_INJECT="$DEVKIT_ROOT/templates/claude_injection_block.md"
python3 "$DEVKIT_ROOT/scripts/merge_markdown.py" "$CLAUDE_INJECT" "$TARGET_DIR/CLAUDE.md" "universal-agent-devkit"

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ]; then
  if [ -f "$TARGET_DIR/AGENTS.md" ] && [ ! -L "$TARGET_DIR/AGENTS.md" ]; then
    # Target already has its own custom AGENTS.md -> Preserve as AGENTS_old.md and Inject DevKit block
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

# 2. Additive Merge for .mcp.json
if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ] && [ -f "$TARGET_DIR/.mcp.json" ] && [ ! -f "$TARGET_DIR/.mcp_old.json" ]; then
  cp "$TARGET_DIR/.mcp.json" "$TARGET_DIR/.mcp_old.json"
fi
python3 "$DEVKIT_ROOT/scripts/merge_json.py" "$DEVKIT_ROOT/mcp/.mcp.json" "$TARGET_DIR/.mcp.json"
echo "  - Merged MCP servers into .mcp.json (preserved existing custom MCPs)"

# 3. Additive Merge for .claude/settings.json
DEFAULT_SETTINGS="$DEVKIT_ROOT/templates/claude_settings.json"
mkdir -p "$DEVKIT_ROOT/templates"
cat << 'SETTINGS_EOF' > "$DEFAULT_SETTINGS"
{
  "permissions": {
    "deny": [
      "Read(**/build/**)",
      "Read(**/.gradle/**)",
      "Read(**/node_modules/**)",
      "Read(**/dist/**)",
      "Read(**/generated/**)",
      "Read(**/*.apk)",
      "Read(**/*.aab)",
      "Read(**/*.hprof)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PROJECT_DIR:-$PWD}\"/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/precode_gate.sh\"",
            "timeout": 15
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/churn_guard.sh\"",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/testsourceset_gate.sh\"",
        "timeout": 60
      },
      {
        "type": "command",
        "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/test_evidence_gate.sh\"",
        "timeout": 30
      },
      {
        "type": "command",
        "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/security_gate.sh\"",
        "timeout": 15
      }
    ]
  }
}
SETTINGS_EOF

if [ "$TARGET_DIR" != "$DEVKIT_ROOT" ] && [ -f "$TARGET_DIR/.claude/settings.json" ] && [ ! -f "$TARGET_DIR/.claude/settings_old.json" ]; then
  cp "$TARGET_DIR/.claude/settings.json" "$TARGET_DIR/.claude/settings_old.json"
fi

python3 "$DEVKIT_ROOT/scripts/merge_json.py" "$DEFAULT_SETTINGS" "$TARGET_DIR/.claude/settings.json"
echo "  - Merged safety gates into .claude/settings.json (preserved custom settings)"

# 4. Smart Item-by-Item Link for Hooks (Preserving custom user hooks)
for hook in "$DEVKIT_ROOT/hooks"/*; do
  [ -e "$hook" ] || continue
  hook_name="$(basename "$hook")"
  target_hook="$TARGET_DIR/.claude/hooks/$hook_name"
  if [ "$SKIP_EXISTING" = "1" ] && [ -e "$target_hook" ] && [ ! -L "$target_hook" ]; then
    echo "  - Preserved custom hook: $hook_name (--skip-existing active)"
    continue
  fi
  if [ -e "$target_hook" ] && [ ! -L "$target_hook" ]; then
    backup_conflict "$target_hook" "$DEVKIT_ROOT"
  fi
  rm -rf "$target_hook"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$hook" "$target_hook"
  else
    cp -R "$hook" "$target_hook"
  fi
done

# 5. Smart Item-by-Item Link for Commands (Preserving custom user commands)
for cmd in "$DEVKIT_ROOT/commands"/*; do
  [ -e "$cmd" ] || continue
  cmd_name="$(basename "$cmd")"
  target_cmd="$TARGET_DIR/.claude/commands/$cmd_name"
  if [ "$SKIP_EXISTING" = "1" ] && [ -e "$target_cmd" ] && [ ! -L "$target_cmd" ]; then
    echo "  - Preserved custom command: $cmd_name (--skip-existing active)"
    continue
  fi
  if [ -e "$target_cmd" ] && [ ! -L "$target_cmd" ]; then
    backup_conflict "$target_cmd" "$DEVKIT_ROOT"
  fi
  rm -rf "$target_cmd"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$cmd" "$target_cmd"
  else
    cp -R "$cmd" "$target_cmd"
  fi
done

# 6. Smart Item-by-Item Link for Agents (Preserving custom user subagents)
for agent in "$DEVKIT_ROOT/agents"/*; do
  [ -e "$agent" ] || continue
  agent_name="$(basename "$agent")"
  target_agent="$TARGET_DIR/.claude/agents/$agent_name"
  if [ "$SKIP_EXISTING" = "1" ] && [ -e "$target_agent" ] && [ ! -L "$target_agent" ]; then
    echo "  - Preserved custom agent: $agent_name (--skip-existing active)"
    continue
  fi
  if [ -e "$target_agent" ] && [ ! -L "$target_agent" ]; then
    backup_conflict "$target_agent" "$DEVKIT_ROOT"
  fi
  rm -rf "$target_agent"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$agent" "$target_agent"
  else
    cp -R "$agent" "$target_agent"
  fi
done

# Clean broken symlinks if any
find "$TARGET_DIR/.claude/hooks" "$TARGET_DIR/.claude/commands" "$TARGET_DIR/.claude/agents" -type l ! -exec test -e {} \; -delete 2>/dev/null || true

echo "✓ Claude Code integration complete (Non-destructive smart merge; custom files preserved)."
