#!/usr/bin/env bash
#
# Installer for roblox-devproducts-mcp (macOS / Linux).
# Installs the MCP server globally and registers it with Claude Code and Codex.
#
#   curl -fsSL https://tools.frrazers.com/install.sh | bash
#
set -euo pipefail

PKG="roblox-devproducts-mcp"
NAME="roblox-devproducts"
CMD="roblox-devproducts-mcp"

# Colors only when writing to a terminal.
if [ -t 1 ]; then
  DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  BLUE=$'\033[34m'; CYAN=$'\033[36m'; WHITE=$'\033[97m'; RESET=$'\033[0m'
else
  DIM=; RED=; GREEN=; YELLOW=; BLUE=; CYAN=; WHITE=; RESET=
fi

mark() { # mark SYMBOL COLOR TEXT
  printf '  %s%s%s %s\n' "$2" "$1" "$RESET" "$3"
}

printf '\n  %sRoblox Monetization MCP%s\n' "$WHITE" "$RESET"
printf '  %sdeveloper products + game passes%s\n\n' "$DIM" "$RESET"

# --- Prerequisites --------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  mark "x" "$RED" "Node.js (18+) is required. Install from https://nodejs.org and re-run."
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  mark "x" "$RED" "Node.js 18+ required (found $(node -v))."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  mark "x" "$RED" "npm is required (it ships with Node.js)."
  exit 1
fi

# --- Install --------------------------------------------------------------
printf '  %sinstalling...%s\n' "$DIM" "$RESET"
if ! npm install -g "$PKG" --no-fund --no-audit --loglevel=error; then
  mark "x" "$RED" "install failed."
  exit 1
fi
mark "+" "$GREEN" "Installed $PKG"

registered=0

# --- Claude Code (user scope) ---------------------------------------------
if command -v claude >/dev/null 2>&1; then
  claude mcp remove "$NAME" --scope user >/dev/null 2>&1 || true
  if claude mcp add "$NAME" --scope user -- "$CMD" >/dev/null 2>&1; then
    mark "+" "$GREEN" "Registered with Claude Code (user scope)"
    registered=1
  else
    mark "!" "$YELLOW" "Claude Code found, but registration failed. Try:  claude mcp add $NAME --scope user -- $CMD"
  fi
else
  mark "-" "$DIM" "Claude Code not found - skipping"
fi

# --- Codex (~/.codex/config.toml) -----------------------------------------
CODEX_DIR="$HOME/.codex"
CODEX_CONFIG="$CODEX_DIR/config.toml"
if command -v codex >/dev/null 2>&1 || [ -d "$CODEX_DIR" ]; then
  mkdir -p "$CODEX_DIR"
  touch "$CODEX_CONFIG"
  if grep -q "^\[mcp_servers\.$NAME\]" "$CODEX_CONFIG" 2>/dev/null; then
    mark "-" "$DIM" "Codex already configured - skipping"
  else
    printf '\n[mcp_servers.%s]\ncommand = "%s"\nargs = []\n' "$NAME" "$CMD" >> "$CODEX_CONFIG"
    mark "+" "$GREEN" "Registered with Codex"
  fi
  registered=1
else
  mark "-" "$DIM" "Codex not found - skipping"
fi

if [ "$registered" -eq 0 ]; then
  printf '\n'
  mark "!" "$YELLOW" "No supported agent found. Add it manually with command:  $CMD"
fi

# --- Next steps -----------------------------------------------------------
printf '\n  %sAlmost done%s - add your Roblox Open Cloud API key:\n\n' "$WHITE" "$RESET"
printf '      %s%s setup%s\n\n' "$CYAN" "$CMD" "$RESET"
printf '  Create a key at %shttps://create.roblox.com/dashboard/credentials%s\n' "$BLUE" "$RESET"
printf '  and add these scopes:\n'
printf '      %sdeveloper-product:read%s, %sdeveloper-product:write%s\n' "$YELLOW" "$RESET" "$YELLOW" "$RESET"
printf '      %sgame-pass:read%s, %sgame-pass:write%s\n\n' "$YELLOW" "$RESET" "$YELLOW" "$RESET"
printf '  Then restart your agent.\n\n'
