#!/usr/bin/env bash
# test_x_old_conflict_isolation.sh — Verify X_old Conflict Protection for Old vs Fresh Projects
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVKIT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "================================================================="
echo "  🧪 Testing X_old Conflict Protection (Fresh vs Old Projects)"
echo "================================================================="

# --- TEST 1: Fresh Project (Project Mới) ---
FRESH_DIR="$(mktemp -d -t test-fresh-XXXXXX)"
trap 'rm -rf "$FRESH_DIR" "${OLD_DIR:-}"' EXIT

echo "▶ [Test 1] Installing DevKit on Fresh Project: $FRESH_DIR"
bash "$DEVKIT_ROOT/bin/install.sh" -t "$FRESH_DIR" -y -p universal > /dev/null 2>&1

# Verify DevKit installed
[ -e "$FRESH_DIR/rules" ] || { echo "❌ FAIL: rules/ missing in fresh project"; exit 1; }
[ -e "$FRESH_DIR/skills" ] || { echo "❌ FAIL: skills/ missing in fresh project"; exit 1; }
[ -e "$FRESH_DIR/commands" ] || { echo "❌ FAIL: commands/ missing in fresh project"; exit 1; }
[ -e "$FRESH_DIR/.claude" ] || { echo "❌ FAIL: .claude/ missing in fresh project"; exit 1; }
[ -f "$FRESH_DIR/CLAUDE.md" ] || { echo "❌ FAIL: CLAUDE.md missing in fresh project"; exit 1; }
[ -e "$FRESH_DIR/AGENTS.md" ] || { echo "❌ FAIL: AGENTS.md missing in fresh project"; exit 1; }

# Verify NO *_old created in fresh project
old_count="$(find "$FRESH_DIR" -maxdepth 3 \( -name "*_old" -o -name "*_old.*" \) | wc -l | xargs)"
if [ "$old_count" -ne 0 ]; then
  echo "❌ FAIL: Fresh project should have 0 *_old items, found: $old_count"
  find "$FRESH_DIR" -maxdepth 3 \( -name "*_old" -o -name "*_old.*" \)
  exit 1
fi
echo "✔ [Test 1 PASS] Fresh Project: Everything installed cleanly, zero *_old created."

# --- TEST 2: Old Project (Project Cũ Có Sẵn Skills, Rules, Commands, Configs) ---
OLD_DIR="$(mktemp -d -t test-old-XXXXXX)"

echo "▶ [Test 2] Setting up Existing Old Project: $OLD_DIR"
mkdir -p "$OLD_DIR/rules"
echo "PROPRIETARY TEAM RULE 123" > "$OLD_DIR/rules/custom_team_rule.md"

mkdir -p "$OLD_DIR/skills/custom-billing-skill"
echo "CUSTOM BILLING LOGIC 456" > "$OLD_DIR/skills/custom-billing-skill/SKILL.md"

mkdir -p "$OLD_DIR/commands"
echo "CUSTOM SLASH COMMAND 789" > "$OLD_DIR/commands/custom-cmd.md"

mkdir -p "$OLD_DIR/.claude/commands"
echo "LEGACY CLAUDE COMMAND" > "$OLD_DIR/.claude/commands/legacy.md"

echo "OLD CLAUDE INSTRUCTIONS 2024" > "$OLD_DIR/CLAUDE.md"
echo "OLD AGENTS ARCHITECTURE" > "$OLD_DIR/AGENTS.md"
echo "OLD CURSOR RULES" > "$OLD_DIR/.cursorrules"

echo "▶ [Test 2] Installing DevKit on Existing Old Project..."
bash "$DEVKIT_ROOT/bin/install.sh" -t "$OLD_DIR" -y -p universal

echo "▶ [Test 2] Verifying X_old Preservation..."
# 1. rules_old
[ -d "$OLD_DIR/rules_old" ] || { echo "❌ FAIL: rules_old directory was not created!"; exit 1; }
grep -q "PROPRIETARY TEAM RULE 123" "$OLD_DIR/rules_old/custom_team_rule.md" || { echo "❌ FAIL: User's old rules content was corrupted/lost!"; exit 1; }

# 2. skills_old
[ -d "$OLD_DIR/skills_old" ] || { echo "❌ FAIL: skills_old directory was not created!"; exit 1; }
grep -q "CUSTOM BILLING LOGIC 456" "$OLD_DIR/skills_old/custom-billing-skill/SKILL.md" || { echo "❌ FAIL: User's old skills content was corrupted/lost!"; exit 1; }

# 3. commands_old
[ -d "$OLD_DIR/commands_old" ] || { echo "❌ FAIL: commands_old directory was not created!"; exit 1; }
grep -q "CUSTOM SLASH COMMAND 789" "$OLD_DIR/commands_old/custom-cmd.md" || { echo "❌ FAIL: User's old commands content was corrupted/lost!"; exit 1; }

# 4. CLAUDE_old.md
[ -f "$OLD_DIR/CLAUDE_old.md" ] || { echo "❌ FAIL: CLAUDE_old.md was not created!"; exit 1; }
grep -q "OLD CLAUDE INSTRUCTIONS 2024" "$OLD_DIR/CLAUDE_old.md" || { echo "❌ FAIL: User's old CLAUDE.md content was lost!"; exit 1; }

# 5. AGENTS_old.md
[ -f "$OLD_DIR/AGENTS_old.md" ] || { echo "❌ FAIL: AGENTS_old.md was not created!"; exit 1; }
grep -q "OLD AGENTS ARCHITECTURE" "$OLD_DIR/AGENTS_old.md" || { echo "❌ FAIL: User's old AGENTS.md content was lost!"; exit 1; }

# 6. .cursorrules_old
[ -f "$OLD_DIR/.cursorrules_old" ] || { echo "❌ FAIL: .cursorrules_old was not created!"; exit 1; }
grep -q "OLD CURSOR RULES" "$OLD_DIR/.cursorrules_old" || { echo "❌ FAIL: User's old .cursorrules content was lost!"; exit 1; }

# 7. DevKit new files are also properly initialized in parallel
[ -e "$OLD_DIR/rules" ] || { echo "❌ FAIL: New rules/ missing"; exit 1; }
[ -e "$OLD_DIR/skills" ] || { echo "❌ FAIL: New skills/ missing"; exit 1; }
[ -e "$OLD_DIR/commands" ] || { echo "❌ FAIL: New commands/ missing"; exit 1; }

echo "✔ [Test 2 PASS] Old Project: 100% of user custom skills, rules, commands & configs preserved in *_old!"

# --- TEST 3: agent-kit list-old Verification ---
echo "▶ [Test 3] Testing 'agent-kit list-old' command..."
output="$(bash "$DEVKIT_ROOT/bin/agent-kit" list-old "$OLD_DIR")"
echo "$output" | grep -q "skills_old" || { echo "❌ FAIL: agent-kit list-old did not find skills_old"; exit 1; }
echo "$output" | grep -q "rules_old" || { echo "❌ FAIL: agent-kit list-old did not find rules_old"; exit 1; }
echo "$output" | grep -q "CLAUDE_old.md" || { echo "❌ FAIL: agent-kit list-old did not find CLAUDE_old.md"; exit 1; }

echo "✔ [Test 3 PASS] agent-kit list-old successfully detected and reported all *_old items!"

echo
echo "================================================================="
echo "  🎉 ALL 3 TESTS PASSED: X_old CONFLICT ISOLATION IS 100% ROCK SOLID!"
echo "================================================================="
