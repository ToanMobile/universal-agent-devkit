#!/usr/bin/env bash
# setup_claude.sh — Configure Claude Code integration in target project
set -euo pipefail

TARGET_DIR="${1:-$PWD}"
DEVKIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${2:-symlink}" # symlink or copy

echo "Configuring Claude Code for: $TARGET_DIR (mode: $MODE)"
mkdir -p "$TARGET_DIR/.claude"

# 1. Copy or Symlink CLAUDE.md & AGENTS.md
if [ "$MODE" = "symlink" ]; then
  ln -sf "$DEVKIT_ROOT/core/CLAUDE.md" "$TARGET_DIR/CLAUDE.md"
  ln -sf "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/AGENTS.md"
else
  [ -f "$TARGET_DIR/CLAUDE.md" ] || cp "$DEVKIT_ROOT/core/CLAUDE.md" "$TARGET_DIR/CLAUDE.md"
  [ -f "$TARGET_DIR/AGENTS.md" ] || cp "$DEVKIT_ROOT/core/AGENTS.md" "$TARGET_DIR/AGENTS.md"
fi

# 2. Setup .mcp.json if not present
if [ ! -f "$TARGET_DIR/.mcp.json" ]; then
  if [ "$MODE" = "symlink" ]; then
    ln -sf "$DEVKIT_ROOT/mcp/.mcp.json" "$TARGET_DIR/.mcp.json"
  else
    cp "$DEVKIT_ROOT/mcp/.mcp.json" "$TARGET_DIR/.mcp.json"
  fi
  echo "  - Configured .mcp.json"
fi

# 3. Setup .claude/settings.json if not present
if [ ! -f "$TARGET_DIR/.claude/settings.json" ]; then
  cat << 'SETTINGS_EOF' > "$TARGET_DIR/.claude/settings.json"
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
  echo "  - Created .claude/settings.json"
fi

# 4. Setup hooks, commands, and agents
if [ "$MODE" = "symlink" ]; then
  rm -rf "$TARGET_DIR/.claude/hooks" "$TARGET_DIR/.claude/commands" "$TARGET_DIR/.claude/agents"
  ln -sf "$DEVKIT_ROOT/hooks" "$TARGET_DIR/.claude/hooks"
  ln -sf "$DEVKIT_ROOT/commands" "$TARGET_DIR/.claude/commands"
  ln -sf "$DEVKIT_ROOT/agents" "$TARGET_DIR/.claude/agents"
else
  mkdir -p "$TARGET_DIR/.claude/hooks" "$TARGET_DIR/.claude/commands" "$TARGET_DIR/.claude/agents"
  cp -R "$DEVKIT_ROOT/hooks/"* "$TARGET_DIR/.claude/hooks/"
  cp -R "$DEVKIT_ROOT/commands/"* "$TARGET_DIR/.claude/commands/"
  cp -R "$DEVKIT_ROOT/agents/"* "$TARGET_DIR/.claude/agents/"
fi

echo "✓ Claude Code integration complete."
