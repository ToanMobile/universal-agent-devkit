#!/bin/bash
# block-dangerous-git.sh — PreToolUse guard cho Bash tool.
# Adapted từ mattpocock/skills (git-guardrails-claude-code).
# CHỈ chặn lệnh git KHÓ REVERSE / mất việc; CHO PHÉP `git push` thường
# (User thường chủ động yêu cầu push — CLAUDE.md: commit/push khi User yêu cầu).
# Contract: exit 2 + stderr = chặn tool call và trả lý do cho model; exit 0 = cho chạy.
# Bypass khi cần thật: User tự gõ lệnh qua prefix `!` trong prompt.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0

# Mỗi pattern là ERE. CHỈ thao tác phá huỷ / bỏ commit / xoá working tree.
DANGEROUS_PATTERNS=(
  "git[[:space:]]+reset[[:space:]]+--hard"      # vứt commit + working tree
  "reset[[:space:]]+--hard"
  "git[[:space:]]+clean[[:space:]]+-[A-Za-z]*f"  # xoá file chưa track (force)
  "git[[:space:]]+branch[[:space:]]+-D"          # xoá branch chưa merge (force)
  "git[[:space:]]+checkout[[:space:]]+--[[:space:]]+" # discard file/hunk khỏi working tree
  "git[[:space:]]+checkout[[:space:]]+\."             # discard toàn bộ working tree
  "git[[:space:]]+restore([[:space:]]|$)"              # discard working tree/index state
  "push[[:space:]]+.*--force"                    # force push (ghi đè remote)
  "push[[:space:]]+.*--force-with-lease"
  "push[[:space:]]+-f([[:space:]]|$)"            # -f = --force
)

# Quoted text is DATA unless something in the command can execute it. Measured
# 2026-07-28: a mutation-test script was blocked because a human-readable label
# — "M3 dangerous-git: gỡ pattern reset --hard" — sat inside a quoted argument.
# No git command was ever going to run.
#
# FAIL-CLOSED on purpose: if the command contains anything that can execute a
# string (bash/sh/zsh/ssh/eval/xargs/env, `-c`, backticks, $( )), the WHOLE
# command is scanned exactly as before — `bash -c "git reset --hard"` must stay
# blocked. Only when no such executor is present are quoted spans treated as
# prose (echo text, commit messages, labels) and dropped before matching.
# Unbalanced quotes are left untouched, so nothing can hide behind a stray quote.
SCAN="$COMMAND"
if ! echo "$COMMAND" | grep -qE '(`|\$\(|(^|[^[:alnum:]_])(eval|bash|sh|zsh|ssh|xargs|env)([^[:alnum:]_]|$)|[[:space:]]-c[[:space:]])'; then
  SCAN=$(echo "$COMMAND" | sed -E "s/'[^']*'/ /g; s/\"[^\"]*\"/ /g")
fi

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$SCAN" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' khớp lệnh git phá huỷ ('$pattern'). User đã chặn thao tác khó revert này. Nếu thực sự cần, User sẽ tự chạy qua prefix '!'." >&2
    exit 2
  fi
done

exit 0
