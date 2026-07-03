# Auto-start launcher for TOS Tracker backend + ngrok tunnel.
# Run at logon via Windows Startup shortcut (no admin needed).
$ErrorActionPreference = 'SilentlyContinue'

# --- Node backend ---
if (-not (Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction SilentlyContinue)) {
    $serverDir = Resolve-Path (Join-Path $PSScriptRoot '..\server')
    $log = Join-Path $serverDir 'runtime.log'
    Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' `
        -ArgumentList 'dist\index.js' `
        -WorkingDirectory $serverDir `
        -RedirectStandardOutput $log `
        -RedirectStandardError ($log -replace '\.log$', '-err.log') `
        -WindowStyle Hidden
}

# --- ngrok tunnel → port 4000 ---
# If a static domain is set in ngrok config, it will be used automatically.
$ngrokRunning = Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue
if (-not $ngrokRunning) {
    Start-Process -FilePath 'ngrok' -ArgumentList 'http 4000 --domain=unread-staleness-cesspool.ngrok-free.dev' -WindowStyle Hidden
    Start-Sleep -Seconds 6
    # Save current URL for easy reference
    try {
        $tunnels = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels' -ErrorAction Stop
        $url = ($tunnels.tunnels | Where-Object { $_.proto -eq 'https' }).public_url
        if ($url) { Set-Content 'C:\Users\PC-090\.ngrok-url.txt' $url }
    } catch { }
}
