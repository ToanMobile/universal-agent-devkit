#!/usr/bin/env bash
# Quick entrypoint to install DevKit into target project or current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/bin/install.sh" "$@"
