#!/usr/bin/env bash
# install.sh — Universal Multi-Agent & Multi-Model DevKit Installer
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVKIT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_DIR="$PWD"
DOMAIN="auto"
AGENTS="ask"
MODE="symlink"
LANGUAGE="en"

show_help() {
  cat << HELP_EOF
Universal Multi-Agent & Multi-Model DevKit Installer

Supports 4 core coding agents & LLMs:
  - Claude Code (Anthropic)
  - OpenAI Codex / ChatGPT Canvas
  - Google Antigravity & Gemini CLI
  - Cursor IDE

Usage:
  ./install.sh [OPTIONS]

Options:
  -t, --target <path>     Target project directory (default: current directory)
  -d, --domain <name>     Project domain: auto | android | web | backend | general (default: auto)
  -a, --agents <list>     Comma-separated agents or 'all'
                          Supported: claude, codex, gemini, cursor, all
  -m, --mode <mode>       Install mode: symlink | copy (default: symlink)
  -l, --lang <code >      Primary communication language: en | vi (default: en)
  -y, --yes               Non-interactive mode (configure all agents without asking)
  -h, --help              Show this help message

Examples:
  # Interactive setup (choose agents from list):
  ./install.sh

  # Quick zero-config setup for ALL agents:
  ./install.sh -y

  # Setup specifically for Cursor and Claude only:
  ./install.sh -t /path/to/my-project -a claude,cursor
HELP_EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--target)
      TARGET_DIR="$2"
      shift 2
      ;;
    --target=*)
      TARGET_DIR="${1#*=}"
      shift
      ;;
    -d|--domain)
      DOMAIN="$2"
      shift 2
      ;;
    --domain=*)
      DOMAIN="${1#*=}"
      shift
      ;;
    -a|--agents)
      AGENTS="$2"
      shift 2
      ;;
    --agents=*)
      AGENTS="${1#*=}"
      shift
      ;;
    -m|--mode)
      MODE="$2"
      shift 2
      ;;
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    -l|--lang|--language)
      LANGUAGE="$2"
      shift 2
      ;;
    --lang=*|--language=*)
      LANGUAGE="${1#*=}"
      shift
      ;;
    -y|--yes|--all)
      AGENTS="all"
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      ;;
  esac
done

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# Interactive Agent Selection Menu if not specified via CLI
if [ "$AGENTS" = "ask" ]; then
  echo "================================================================="
  echo "  🤖 Universal AI Agent DevKit — Agent Selection Menu"
  echo "================================================================="
  echo "  [1] 🤖 Claude Code          (AGENTS.md, .claude/commands/, hooks, .mcp.json)"
  echo "  [2] 🧠 OpenAI Codex         (AGENTS.md SSOT)"
  echo "  [3] ✨ Google Gemini / AGY  (AGENTS.md, .agents/skills, mcp_config.json)"
  echo "  [4] ⚡ Cursor IDE           (AGENTS.md SSOT)"
  echo "  [A] 🌟 All Agents           (Configure all 4 ecosystems)"
  echo "-----------------------------------------------------------------"
  user_choice="A"
  if [ -t 0 ]; then
    read -r -p "Select agents (e.g. 1,2 or 1,2,3 or A for all) [Default: A]: " input_choice || input_choice=""
    user_choice="${input_choice:-A}"
  elif (exec 3</dev/tty) 2>/dev/null; then
    read -r -p "Select agents (e.g. 1,2 or 1,2,3 or A for all) [Default: A]: " input_choice < /dev/tty || input_choice=""
    user_choice="${input_choice:-A}"
  fi

  if [[ "$user_choice" =~ ^[aA]$ ]] || [ "$user_choice" = "all" ]; then
    AGENTS="all"
  else
    selected_agents=()
    IFS=',' read -ra CHOICES <<< "$user_choice"
    for c in "${CHOICES[@]}"; do
      c_trim="$(echo "$c" | xargs)"
      case "$c_trim" in
        1|claude) selected_agents+=("claude") ;;
        2|codex|chatgpt|openai) selected_agents+=("codex") ;;
        3|gemini|antigravity) selected_agents+=("gemini") ;;
        4|cursor) selected_agents+=("cursor") ;;
      esac
    done
    if [ ${#selected_agents[@]} -eq 0 ]; then
      AGENTS="all"
    else
      AGENTS="$(IFS=','; echo "${selected_agents[*]}")"
    fi
  fi
fi

# Smart Auto-Detection of Project Domain
if [ "$DOMAIN" = "auto" ]; then
  if [ -f "$TARGET_DIR/build.gradle" ] || [ -f "$TARGET_DIR/build.gradle.kts" ] || [ -f "$TARGET_DIR/settings.gradle" ] || [ -f "$TARGET_DIR/settings.gradle.kts" ] || [ -f "$TARGET_DIR/AndroidManifest.xml" ]; then
    DOMAIN="android"
  elif [ -f "$TARGET_DIR/next.config.js" ] || [ -f "$TARGET_DIR/next.config.ts" ] || [ -f "$TARGET_DIR/vite.config.ts" ] || [ -f "$TARGET_DIR/package.json" ]; then
    DOMAIN="web"
  elif [ -f "$TARGET_DIR/pyproject.toml" ] || [ -f "$TARGET_DIR/requirements.txt" ] || [ -f "$TARGET_DIR/go.mod" ] || [ -f "$TARGET_DIR/Cargo.toml" ]; then
    DOMAIN="backend"
  else
    DOMAIN="general"
  fi
fi

echo
echo "================================================================="
echo "  🚀 Universal Multi-Agent & Multi-Model DevKit Installer"
echo "  Target Project:  $TARGET_DIR"
echo "  Domain Detected: $DOMAIN"
echo "  Selected Agents: $AGENTS"
echo "  Language Mode:   $LANGUAGE"
echo "  Link Mode:       $MODE"
echo "================================================================="
echo

# 1. Sync internal commands first
bash "$DEVKIT_ROOT/scripts/sync_commands.sh" > /dev/null 2>&1 || true

# 2. Configure selected agents
IFS=',' read -ra AGENT_LIST <<< "$AGENTS"

configure_agent() {
  local ag="$1"
  case "$ag" in
    claude)
      echo "  🤖 [Claude Code]"
      bash "$DEVKIT_ROOT/adapters/setup_claude.sh" "$TARGET_DIR" "$MODE" "$LANGUAGE"
      ;;
    codex|chatgpt|openai)
      echo "  🧠 [OpenAI Codex / ChatGPT]"
      bash "$DEVKIT_ROOT/adapters/setup_codex.sh" "$TARGET_DIR" "$DOMAIN" "$LANGUAGE"
      ;;
    gemini|antigravity)
      echo "  ✨ [Google Antigravity / Gemini]"
      bash "$DEVKIT_ROOT/adapters/setup_gemini.sh" "$TARGET_DIR" "$MODE" "$LANGUAGE"
      ;;
    cursor)
      echo "  ⚡ [Cursor IDE]"
      bash "$DEVKIT_ROOT/adapters/setup_cursor.sh" "$TARGET_DIR" "$DOMAIN" "$LANGUAGE"
      ;;
    all)
      configure_agent "claude"
      configure_agent "codex"
      configure_agent "gemini"
      configure_agent "cursor"
      ;;
    *)
      echo "  ⚠️ Unknown agent: $ag (skipping)"
      ;;
  esac
}

for agent_item in "${AGENT_LIST[@]}"; do
  agent_clean="$(echo "$agent_item" | tr '[:upper:]' '[:lower:]' | xargs)"
  configure_agent "$agent_clean"
done

echo
echo "================================================================="
echo "  ✨ Setup Complete for Selected Agents: [$AGENTS]!"
echo "  No unnecessary agent rules or files were created."
echo "================================================================="
