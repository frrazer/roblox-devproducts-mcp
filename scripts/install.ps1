$Pkg  = "roblox-devproducts-mcp"
$Name = "roblox-devproducts"
$Cmd  = "roblox-devproducts-mcp"

Write-Host "Installing $Pkg ..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Error: Node.js (>=18) is required. Install from https://nodejs.org and re-run."
  exit 1
}
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18) {
  Write-Host "Error: Node.js >=18 required (found $(node -v))."
  exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "Error: npm is required (it ships with Node.js)."
  exit 1
}
npm install -g $Pkg
if ($LASTEXITCODE -ne 0) { Write-Host "Error: npm install failed."; exit 1 }

$registered = $false

if (Get-Command claude -ErrorAction SilentlyContinue) {
  claude mcp remove $Name --scope user 2>$null | Out-Null
  claude mcp add $Name --scope user -- $Cmd 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Registered with Claude Code (user scope)."
    $registered = $true
  } else {
    Write-Host "Claude Code found, but registration failed. Try manually:"
    Write-Host "    claude mcp add $Name --scope user -- $Cmd"
  }
} else {
  Write-Host "Claude Code CLI not found - skipping."
}

$codexDir    = Join-Path $HOME ".codex"
$codexConfig = Join-Path $codexDir "config.toml"
if ((Get-Command codex -ErrorAction SilentlyContinue) -or (Test-Path $codexDir)) {
  if (-not (Test-Path $codexDir))    { New-Item -ItemType Directory -Path $codexDir | Out-Null }
  if (-not (Test-Path $codexConfig)) { New-Item -ItemType File -Path $codexConfig | Out-Null }
  $content = Get-Content $codexConfig -Raw -ErrorAction SilentlyContinue
  if ($content -and $content.Contains("[mcp_servers.$Name]")) {
    Write-Host "Codex already configured - skipping."
  } else {
    $block = "`n[mcp_servers.$Name]`ncommand = `"cmd`"`nargs = [`"/c`", `"$Cmd`"]`n"
    Add-Content -Path $codexConfig -Value $block -Encoding utf8
    Write-Host "Registered with Codex ($codexConfig)."
  }
  $registered = $true
} else {
  Write-Host "Codex not found - skipping."
}

Write-Host ""
if (-not $registered) {
  Write-Host "No supported agent (Claude Code or Codex) was found."
  Write-Host "The server is installed; add it to your agent manually with command: $Cmd"
}

Write-Host "Final step - add your Roblox Open Cloud API key (one time):"
Write-Host ""
Write-Host "    $Cmd setup"
Write-Host ""
Write-Host "Then restart your agent. Get a key (scoped to Developer Products) at:"
Write-Host "https://create.roblox.com/dashboard/credentials"
