#!/usr/bin/env bash
# Install the plugin into an Obsidian vault for testing
# Usage: ./install.sh /path/to/vault

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <vault-directory>"
  exit 1
fi

VAULT_DIR="$1"
PLUGIN_DIR="$VAULT_DIR/.obsidian/plugins/latex-algorithms-render"

if [ ! -d "$VAULT_DIR/.obsidian" ]; then
  echo "Error: '$VAULT_DIR' does not appear to be an Obsidian vault (no .obsidian directory)"
  exit 1
fi

mkdir -p "$PLUGIN_DIR"
cp main.js manifest.json styles.css "$PLUGIN_DIR/"

echo "Installed to $PLUGIN_DIR"
echo "Enable the plugin in Obsidian Settings > Community Plugins."
