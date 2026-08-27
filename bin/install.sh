#!/usr/bin/env bash
# install.sh — Universal Multi-Agent & Multi-Model DevKit Installer
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVKIT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_DIR="$PWD"
DOMAIN="auto"
AGENTS="all"
MODE="symlink"
LANGUAGE="en"

show_help() {
  cat << HELP_EOF
Universal Multi-Agent & Multi-Model DevKit Installer

Supports ALL coding agents & LLMs:
  - Claude Code (Anthropic)
  - Google Antigravity & Gemini CLI
  - Cursor IDE (.cursorrules & .cursor/rules/*.mdc)
  - Windsurf / Cascade (.windsurfrules)
  - GitHub Copilot (.github/copilot-instructions.md)
  - Cline & Roo Code (.clinerules & .roomodes)
  - OpenAI Codex / ChatGPT Canvas (CODEX.md)
  - Aider (CONVENTIONS.md & .aider.conf.yml)

Usage:
  ./install.sh [OPTIONS]

Options:
  -t, --target <path>     Target project directory (default: current directory)
  -d, --domain <name>     Project domain: auto | android | web | backend | general (default: auto)
  -a, --agents <list>     Comma-separated agents or 'all' (default: all)
                          Supported: claude, gemini, cursor, windsurf, copilot, cline, codex, aider, all
  -m, --mode <mode>       Install mode: symlink | copy (default: symlink)
  -l, --lang <code >      Primary communication language: en | vi (default: en)
  -h, --help              Show this help message

Examples:
  # Quick zero-config setup (English default, auto-detect domain, all agents):
  ./install.sh

  # Setup with Vietnamese language preference:
  ./install.sh --lang=vi

  # Setup specifically for Cursor and Claude in a Web project:
  ./install.sh -t /path/to/my-web-app -d web -a claude,cursor -l vi
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

echo "================================================================="
echo "  🚀 Universal Multi-Agent & Multi-Model DevKit Installer"
echo "  Target Project: $TARGET_DIR"
echo "  Domain Detected: $DOMAIN"
echo "  Agents Setup:   $AGENTS"
echo "  Language:       $LANGUAGE (default: English, option: Vietnamese)"
echo "  Link Mode:      $MODE"
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
    gemini|antigravity)
      echo "  ✨ [Google Antigravity / Gemini]"
      bash "$DEVKIT_ROOT/adapters/setup_gemini.sh" "$TARGET_DIR" "$MODE" "$LANGUAGE"
      ;;
    cursor)
      echo "  ⚡ [Cursor IDE]"
      bash "$DEVKIT_ROOT/adapters/setup_cursor.sh" "$TARGET_DIR" "$DOMAIN" "$LANGUAGE"
      ;;
    windsurf|cascade)
      echo "  🌊 [Windsurf / Cascade]"
      bash "$DEVKIT_ROOT/adapters/setup_windsurf.sh" "$TARGET_DIR" "$DOMAIN" "$LANGUAGE"
      ;;
    copilot|github-copilot)
      echo "  🐙 [GitHub Copilot]"
      bash "$DEVKIT_ROOT/adapters/setup_copilot.sh" "$TARGET_DIR" "$DOMAIN" "$LANGUAGE"
      ;;
    cline|roo|roomodes)
      echo "  🛠️ [Cline & Roo Code]"
      bash "$DEVKIT_ROOT/adapters/setup_cline.sh" "$TARGET_DIR" "$DOMAIN" "$LANGUAGE"
      ;;
    codex|chatgpt|openai)
      echo "  🧠 [OpenAI Codex / ChatGPT]"
      bash "$DEVKIT_ROOT/adapters/setup_codex.sh" "$TARGET_DIR" "$DOMAIN" "$LANGUAGE"
      ;;
    aider)
      echo "  ⌨️ [Aider]"
      bash "$DEVKIT_ROOT/adapters/setup_aider.sh" "$TARGET_DIR" "$LANGUAGE"
      ;;
    all)
      configure_agent "claude"
      configure_agent "gemini"
      configure_agent "cursor"
      configure_agent "windsurf"
      configure_agent "copilot"
      configure_agent "cline"
      configure_agent "codex"
      configure_agent "aider"
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
echo "  ✨ Universal Multi-Agent Setup Complete!"
echo "  Language Mode: $LANGUAGE (Default: English, Switchable to Vietnamese)"
echo "  Project is ready for Claude 3.5/3.7, GPT-4o, Gemini 2.0/3.0, DeepSeek R1, Llama 3."
echo "================================================================="
