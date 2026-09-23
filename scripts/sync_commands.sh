#!/usr/bin/env bash
# sync_commands.sh — Populate commands/ from skills/ with canonical links and aliases
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$ROOT_DIR/skills"
COMMANDS_DIR="$ROOT_DIR/commands"

mkdir -p "$COMMANDS_DIR"

# 1. Link each canonical skill
for skill_dir in "$SKILLS_DIR"/*; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  if [ -f "$skill_dir/SKILL.md" ]; then
    ln -sfn "../skills/${skill_name}/SKILL.md" "$COMMANDS_DIR/${skill_name}.md"
  fi
done

# 2. Setup Aliases
ALIASES=(
  "test:qc"
  "qa:qc"
  "bugs:fixbugs"
  "fix:fixbugs"
  "build:deploy"
  "plan:spec-driven-development"
  "scan:security-checklist"
  "tdd:tdd-workflow"
  "verify:verification-before-completion"
  "conflict:merge-conflict-resolver"
  "handoff:session-handoff"
  "crashlytics:fixbugs"
  "graph:codebase-memory"
  "review:qa-review"
  "visual:qa-visual"
  "ocr:open-code-review"
)

# Clean broken symlinks in commands/
find "$COMMANDS_DIR" -type l ! -exec test -e {} \; -delete

for mapping in "${ALIASES[@]}"; do
  alias_name="${mapping%%:*}"
  target_skill="${mapping##*:}"
  if [ -f "$SKILLS_DIR/$target_skill/SKILL.md" ]; then
    rm -rf "$COMMANDS_DIR/${alias_name}.md"
    ln -sfn "../skills/${target_skill}/SKILL.md" "$COMMANDS_DIR/${alias_name}.md"
  fi
done

echo "Commands synchronized successfully in $COMMANDS_DIR ($(ls -1 "$COMMANDS_DIR" | wc -l | xargs) commands created)."
