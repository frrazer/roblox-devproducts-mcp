# Installer for roblox-devproducts-mcp (Windows / PowerShell).
# Installs the MCP server globally and registers it with Claude Code and Codex.
#
#   irm https://tools.frrazers.com/install.ps1 | iex
#
# No global $ErrorActionPreference = "Stop": under Windows PowerShell 5.1 native
# commands that write to stderr get promoted to terminating errors under Stop, so
# we check $LASTEXITCODE explicitly instead.

$Pkg  = "roblox-devproducts-mcp"
$Name = "roblox-devproducts"
$Cmd  = "roblox-devproducts-mcp"

function Mark($symbol, $symColor, $text, $textColor = "Gray") {
  Write-Host "  " -NoNewline
  Write-Host $symbol -ForegroundColor $symColor -NoNewline
  Write-Host " " -NoNewline
  Write-Host $text -ForegroundColor $textColor
}

Write-Host ""
Write-Host "  Roblox Monetization MCP" -ForegroundColor White
Write-Host "  developer products + game passes" -ForegroundColor DarkGray
Write-Host ""

# --- Prerequisites --------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Mark "x" Red "Node.js (18+) is required. Install from https://nodejs.org and re-run." Red
  exit 1
}
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18) {
  Mark "x" Red "Node.js 18+ required (found $(node -v))." Red
  exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Mark "x" Red "npm is required (it ships with Node.js)." Red
  exit 1
}

# --- Install --------------------------------------------------------------
Write-Host "  installing..." -ForegroundColor DarkGray
$npmOut = npm install -g $Pkg --no-fund --no-audit --loglevel=error 2>&1
if ($LASTEXITCODE -ne 0) {
  Mark "x" Red "install failed:" Red
  Write-Host $npmOut
  exit 1
}
Mark "+" Green "Installed $Pkg"

$registered = $false

# --- Claude Code (user scope) ---------------------------------------------
if (Get-Command claude -ErrorAction SilentlyContinue) {
  claude mcp remove $Name --scope user 2>$null | Out-Null
  claude mcp add $Name --scope user -- $Cmd 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Mark "+" Green "Registered with Claude Code (user scope)"
    $registered = $true
  } else {
    Mark "!" Yellow "Claude Code found, but registration failed. Try:  claude mcp add $Name --scope user -- $Cmd" Yellow
  }
} else {
  Mark "-" DarkGray "Claude Code not found - skipping" DarkGray
}

# --- Codex (~/.codex/config.toml) -----------------------------------------
$codexDir    = Join-Path $HOME ".codex"
$codexConfig = Join-Path $codexDir "config.toml"
if ((Get-Command codex -ErrorAction SilentlyContinue) -or (Test-Path $codexDir)) {
  if (-not (Test-Path $codexDir))    { New-Item -ItemType Directory -Path $codexDir | Out-Null }
  if (-not (Test-Path $codexConfig)) { New-Item -ItemType File -Path $codexConfig | Out-Null }
  $content = Get-Content $codexConfig -Raw -ErrorAction SilentlyContinue
  if ($content -and $content.Contains("[mcp_servers.$Name]")) {
    Mark "-" DarkGray "Codex already configured - skipping" DarkGray
  } else {
    # On Windows the global npm bin is a .cmd shim, so spawn it via cmd /c.
    Add-Content -Path $codexConfig -Value "`n[mcp_servers.$Name]`ncommand = `"cmd`"`nargs = [`"/c`", `"$Cmd`"]`n" -Encoding utf8
    Mark "+" Green "Registered with Codex"
  }
  $registered = $true
} else {
  Mark "-" DarkGray "Codex not found - skipping" DarkGray
}

if (-not $registered) {
  Write-Host ""
  Mark "!" Yellow "No supported agent found. Add it manually with command:  $Cmd" Yellow
}

# --- Next steps -----------------------------------------------------------
Write-Host ""
Write-Host "  Almost done " -ForegroundColor White -NoNewline
Write-Host "- add your Roblox Open Cloud API key:" -ForegroundColor Gray
Write-Host ""
Write-Host "      $Cmd setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Create a key at " -ForegroundColor Gray -NoNewline
Write-Host "https://create.roblox.com/dashboard/credentials" -ForegroundColor Blue
Write-Host "  and add these scopes:" -ForegroundColor Gray
Write-Host "      developer-product:read" -ForegroundColor Yellow -NoNewline
Write-Host ", " -ForegroundColor DarkGray -NoNewline
Write-Host "developer-product:write" -ForegroundColor Yellow
Write-Host "      game-pass:read" -ForegroundColor Yellow -NoNewline
Write-Host ", " -ForegroundColor DarkGray -NoNewline
Write-Host "game-pass:write" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Then restart your agent." -ForegroundColor Gray
Write-Host ""
