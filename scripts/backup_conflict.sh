#!/usr/bin/env bash
# backup_conflict.sh — Safe Isolation for Existing Project Collisions (X_old Protection)
# Preserves user's existing skills, rules, commands, hooks, and configs without overwriting.

has_user_content() {
  local dir="$1"
  local devkit_root="${2:-}"

  [ -d "$dir" ] || return 1
  [ -L "$dir" ] && return 1

  local count
  count="$(find "$dir" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | xargs)"
  [ "$count" -eq 0 ] && return 1

  if [ -n "$devkit_root" ]; then
    local non_devkit=0
    while IFS= read -r item; do
      [ -e "$item" ] || [ -L "$item" ] || continue
      if [ -L "$item" ]; then
        local target
        target="$(readlink "$item" || true)"
        if [[ "$target" != "$devkit_root"* ]]; then
          non_devkit=1
          break
        fi
      else
        non_devkit=1
        break
      fi
    done < <(find "$dir" -mindepth 1 -maxdepth 1)
    [ "$non_devkit" -eq 1 ] && return 0
    return 1
  fi

  return 0
}

backup_conflict() {
  local target="$1"
  local devkit_root="${2:-}"

  [ -e "$target" ] || [ -L "$target" ] || return 0

  # If it is a symlink pointing into devkit_root, it is our own managed link -> safe to replace
  if [ -L "$target" ] && [ -n "$devkit_root" ]; then
    local link_target
    link_target="$(readlink "$target" || true)"
    if [[ "$link_target" == "$devkit_root"* ]]; then
      return 0
    fi
  fi

  # Determine backup path (X_old)
  local parent_dir
  parent_dir="$(dirname "$target")"
  local base_name
  base_name="$(basename "$target")"

  local backup_name
  if [ -d "$target" ] && [ ! -L "$target" ]; then
    # Directory: skills -> skills_old, rules -> rules_old
    backup_name="${base_name}_old"
  else
    # File: CLAUDE.md -> CLAUDE_old.md, or .cursorrules -> .cursorrules_old
    if [[ "$base_name" == *.* ]] && [[ "$base_name" != .* ]]; then
      local name_no_ext="${base_name%.*}"
      local ext="${base_name##*.}"
      backup_name="${name_no_ext}_old.${ext}"
    else
      backup_name="${base_name}_old"
    fi
  fi

  local backup_path="$parent_dir/$backup_name"

  # If X_old already exists, don't overwrite it! Append counter or timestamp
  if [ -e "$backup_path" ] || [ -L "$backup_path" ]; then
    local ts
    ts="$(date +%Y%m%d_%H%M%S)"
    if [ -d "$target" ] && [ ! -L "$target" ]; then
      backup_path="${parent_dir}/${base_name}_old_${ts}"
    else
      if [[ "$base_name" == *.* ]] && [[ "$base_name" != .* ]]; then
        local name_no_ext="${base_name%.*}"
        local ext="${base_name##*.}"
        backup_path="${parent_dir}/${name_no_ext}_old_${ts}.${ext}"
      else
        backup_path="${parent_dir}/${base_name}_old_${ts}"
      fi
    fi
  fi

  # Move conflicting folder/file to backup path
  mv "$target" "$backup_path"

  # Colored user-friendly notification
  local YELLOW='\033[1;33m'
  local CYAN='\033[0;36m'
  local GREEN='\033[0;32m'
  local RESET='\033[0m'

  echo -e "${YELLOW}  ⚠️ [X_old Protection] Phát hiện xung đột dự án cũ:${RESET} ${CYAN}${base_name}${RESET}"
  echo -e "     ➔ ${GREEN}ĐÃ ĐỔI TÊN THÀNH:${RESET} ${CYAN}$(basename "$backup_path")${RESET} để bạn tự merge theo ý mình (Không ghi đè làm mất mã nguồn)!"

  # Record to a session backup ledger in target root
  local ledger_dir="$parent_dir"
  [ -d "$ledger_dir" ] && echo "$(date '+%Y-%m-%d %H:%M:%S') | $target -> $backup_path" >> "$ledger_dir/.devkit_backups.log" 2>/dev/null || true

  return 0
}

backup_dir_if_user_content() {
  local dir="$1"
  local devkit_root="${2:-}"
  if has_user_content "$dir" "$devkit_root"; then
    backup_conflict "$dir" "$devkit_root"
  fi
}

backup_file_if_user_content() {
  local file="$1"
  local marker="${2:-universal-agent-devkit}"
  [ -f "$file" ] || return 0
  [ -L "$file" ] && return 0
  if ! grep -q "$marker" "$file" 2>/dev/null; then
    backup_conflict "$file" ""
  fi
}

list_old_backups() {
  local root_dir="${1:-$PWD}"
  echo "================================================================="
  echo "  🔍 Danh Sách Các Mục Đã Được Bảo Vệ (*_old) Trong Dự Án:"
  echo "  Thư mục kiểm tra: $root_dir"
  echo "================================================================="
  local found=0
  while IFS= read -r item; do
    [ -n "$item" ] || continue
    found=1
    local rel_path="${item#$root_dir/}"
    if [ -d "$item" ]; then
      echo "  📁 [Thư mục cũ] $rel_path"
    else
      echo "  📄 [Tập tin cũ]  $rel_path"
    fi
  done < <(find "$root_dir" -maxdepth 3 \( -name "*_old" -o -name "*_old.*" -o -name "*_old_*" \) 2>/dev/null | grep -v "/\.git/")

  if [ "$found" -eq 0 ]; then
    echo "  ✔ Không có mục *_old nào (Dự án sạch hoặc chưa phát sinh xung đột)."
  else
    echo "-----------------------------------------------------------------"
    echo "  👉 Lời khuyên: Bạn có thể xem lại mã nguồn trong các mục *_old"
    echo "     và chủ động copy/merge các kỹ năng, quy tắc riêng vào thư mục mới."
    echo "================================================================="
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  cmd="${1:-}"
  case "$cmd" in
    list|list-old)
      list_old_backups "${2:-$PWD}"
      ;;
    *)
      if [ $# -ge 1 ]; then
        backup_conflict "$1" "${2:-}"
      else
        echo "Usage: $0 <target_path> [devkit_root] OR $0 list [project_dir]"
        exit 1
      fi
      ;;
  esac
fi
