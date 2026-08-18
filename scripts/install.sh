set -euo pipefail

PKG="roblox-devproducts-mcp"
NAME="roblox-devproducts"
CMD="roblox-devproducts-mcp"

echo "Installing $PKG ..."

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js (>=18) is required. Install from https://nodejs.org and re-run." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js >=18 required (found $(node -v))." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required (it ships with Node.js)." >&2
  exit 1
fi

npm install -g "$PKG"

registered=0

if command -v claude >/dev/null 2>&1; then
  claude mcp remove "$NAME" --scope user >/dev/null 2>&1 || true
  claude mcp add "$NAME" --scope user -- "$CMD"
  echo "Registered with Claude Code (user scope)."
  registered=1
else
  echo "Claude Code CLI not found - skipping."
fi

CODEX_DIR="$HOME/.codex"
CODEX_CONFIG="$CODEX_DIR/config.toml"
if command -v codex >/dev/null 2>&1 || [ -d "$CODEX_DIR" ]; then
  mkdir -p "$CODEX_DIR"
  touch "$CODEX_CONFIG"
  if grep -q "^\[mcp_servers\.$NAME\]" "$CODEX_CONFIG" 2>/dev/null; then
    echo "Codex already configured - skipping."
  else
    printf '\n[mcp_servers.%s]\ncommand = "%s"\nargs = []\n' "$NAME" "$CMD" >> "$CODEX_CONFIG"
    echo "Registered with Codex ($CODEX_CONFIG)."
  fi
  registered=1
else
  echo "Codex not found - skipping."
fi

echo ""
if [ "$registered" -eq 0 ]; then
  echo "No supported agent (Claude Code or Codex) was found."
  echo "The server is installed; add it to your agent manually with command: $CMD"
fi

echo "Final step - add your Roblox Open Cloud API key (one time):"
echo ""
echo "    $CMD setup"
echo ""
echo "Then restart your agent. Get a key (scoped to Developer Products) at:"
echo "https://create.roblox.com/dashboard/credentials"
