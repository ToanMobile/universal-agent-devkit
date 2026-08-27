#!/usr/bin/env bash
# quick-install.sh — One-liner Remote Bootstrapper for Universal Agent DevKit
# Usage: curl -fsSL https://.../bin/quick-install.sh | bash
set -euo pipefail

INSTALL_DIR="${HOME}/.universal-agent-devkit"
BIN_DIR="${HOME}/.local/bin"
REPO_URL="https://github.com/ToanMobile/universal-agent-devkit.git"

echo "================================================================="
echo "  🚀 Bootstrapping Universal Agent DevKit"
echo "================================================================="

# 1. Clone or update devkit
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing DevKit at $INSTALL_DIR..."
  git -C "$INSTALL_DIR" pull --ff-only || true
else
  echo "Cloning Universal Agent DevKit into $INSTALL_DIR..."
  if git ls-remote "$REPO_URL" > /dev/null 2>&1; then
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  else
    # Fallback to local path if available
    LOCAL_SOURCE="/Volumes/Data/Toan/universal-agent-devkit"
    if [ -d "$LOCAL_SOURCE" ]; then
      cp -R "$LOCAL_SOURCE" "$INSTALL_DIR"
    fi
  fi
fi

# 2. Link CLI to ~/.local/bin
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/agent-kit" "$BIN_DIR/agent-kit"
ln -sf "$INSTALL_DIR/bin/install.sh" "$BIN_DIR/agent-install"

# 3. Ensure PATH contains ~/.local/bin
export PATH="$BIN_DIR:$PATH"

echo "✓ 'agent-kit' successfully installed to $BIN_DIR/agent-kit"
echo

# 4. If current directory is a project, launch interactive agent setup
if [ -d ".git" ] || [ -f "package.json" ] || [ -f "build.gradle" ] || [ -f "build.gradle.kts" ] || [ -f "pyproject.toml" ]; then
  echo "Detected active project in current directory: $PWD"
  if [ -c /dev/tty ]; then
    bash "$INSTALL_DIR/bin/install.sh" --target="$PWD" < /dev/tty
  else
    bash "$INSTALL_DIR/bin/install.sh" --target="$PWD"
  fi
fi

echo
echo "================================================================="
echo "  ✨ Setup Complete! You can now run 'agent-kit init' anywhere."
echo "================================================================="
