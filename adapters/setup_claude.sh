#!/usr/bin/env bash
# setup_claude.sh — Configure Claude Code integration in target project (Additive Merge)
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy
LANGUAGE="${3:-en}"

echo "Configuring Claude Code for: $TARGET_DIR (mode: $MODE, lang: $LANGUAGE)"
mkdir -p "$TARGET_DIR/.claude/hooks" "$TARGET_DIR/.claude/commands" "$TARGET_DIR/.claude/agents"

# 1. Setup AGENTS.md (Sole SSOT)
rm -f "$TARGET_DIR/CLAUDE.md"
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

# 2. Additive Merge for .mcp.json
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
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/read_ledger.sh\"",
            "timeout": 10
          }
        ]
      },
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/churn_guard.sh\"",
            "timeout": 15
          },
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/comment_claim_guard.sh\"",
            "timeout": 15
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/claim_check.sh\"",
            "timeout": 15
          },
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/review_gate.sh\"",
            "timeout": 20
          },
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/testsourceset_gate.sh\"",
            "timeout": 600
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
    ]
  }
}
SETTINGS_EOF

python3 "$DEVKIT_ROOT/scripts/merge_json.py" "$DEFAULT_SETTINGS" "$TARGET_DIR/.claude/settings.json"
echo "  - Merged safety gates into .claude/settings.json (preserved custom settings)"

# 4. Additive Item-by-Item Link for Hooks (Preserving custom user hooks)
for hook in "$DEVKIT_ROOT/hooks"/*; do
  [ -e "$hook" ] || continue
  hook_name="$(basename "$hook")"
  target_hook="$TARGET_DIR/.claude/hooks/$hook_name"
  rm -rf "$target_hook"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$hook" "$target_hook"
  else
    cp -R "$hook" "$target_hook"
  fi
done

# 5. Additive Item-by-Item Link for Commands (Preserving custom user commands)
for cmd in "$DEVKIT_ROOT/commands"/*; do
  [ -e "$cmd" ] || continue
  cmd_name="$(basename "$cmd")"
  target_cmd="$TARGET_DIR/.claude/commands/$cmd_name"
  rm -rf "$target_cmd"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$cmd" "$target_cmd"
  else
    cp -R "$cmd" "$target_cmd"
  fi
done

# 6. Additive Item-by-Item Link for Agents (Preserving custom user subagents)
for agent in "$DEVKIT_ROOT/agents"/*; do
  [ -e "$agent" ] || continue
  agent_name="$(basename "$agent")"
  target_agent="$TARGET_DIR/.claude/agents/$agent_name"
  rm -rf "$target_agent"
  if [ "$MODE" = "symlink" ]; then
    ln -sfn "$agent" "$target_agent"
  else
    cp -R "$agent" "$target_agent"
  fi
done

echo "✓ Claude Code integration complete (All custom skills/hooks/commands preserved)."
