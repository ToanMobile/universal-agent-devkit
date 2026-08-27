#!/usr/bin/env bash
# sync_commands.sh — Populate commands/ from skills/ with canonical links and aliases
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$ROOT_DIR/skills"
COMMANDS_DIR="$ROOT_DIR/commands"

# Clean old commands directory
rm -rf "$COMMANDS_DIR"
mkdir -p "$COMMANDS_DIR"

# 1. Link each canonical skill
for skill_dir in "$SKILLS_DIR"/*; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  if [ -f "$skill_dir/SKILL.md" ]; then
    ln -sf "../skills/${skill_name}/SKILL.md" "$COMMANDS_DIR/${skill_name}.md"
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
  "adr:documentation-and-adrs"
  "conflict:merge-conflict-resolver"
  "grill:grill-plan"
  "incremental:incremental-implementation"
  "migration:deprecation-migration"
  "observability:observability-instrumentation"
  "handoff:session-handoff"
  "crashlytics:triage-crashlytics-bug"
  "deep-design:deep-module-design"
  "graph:graph-navigation"
  "skills-author:skill-development"
  "docx:documents"
  "xlsx:spreadsheets"
  "pptx:presentations"
)

for mapping in "${ALIASES[@]}"; do
  alias_name="${mapping%%:*}"
  target_skill="${mapping##*:}"
  if [ -f "$SKILLS_DIR/$target_skill/SKILL.md" ]; then
    ln -sf "../skills/${target_skill}/SKILL.md" "$COMMANDS_DIR/${alias_name}.md"
  fi
done

echo "Commands synchronized successfully in $COMMANDS_DIR ($(ls -1 "$COMMANDS_DIR" | wc -l | xargs) commands created)."
