# setup-cron.ps1
# Registers Windows Task Scheduler tasks for dude-we're-so-cooked daily briefings.
#
# Usage (run as Administrator or with enough perms):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-cron.ps1
#
# What it creates:
#   DudeWereSoCooked-Morning   — 7:30am daily
#   DudeWereSoCooked-Afternoon — 3:30pm daily
#
# Each task:
#   1. Runs curate.js to fetch fresh AI news
#   2. Commits + pushes data/daily.json to GitHub
#   3. Sends Discord notification

$ProjectDir = Split-Path -Parent $PSScriptRoot
$NodePath   = (Get-Command node -ErrorAction SilentlyContinue).Source
$GitPath    = (Get-Command git  -ErrorAction SilentlyContinue).Source

if (-not $NodePath) {
    Write-Error "Node.js not found in PATH. Install it from https://nodejs.org/"
    exit 1
}
if (-not $GitPath) {
    Write-Error "Git not found in PATH. Install it from https://git-scm.com/"
    exit 1
}

Write-Host "Project dir: $ProjectDir"
Write-Host "Node:        $NodePath"
Write-Host "Git:         $GitPath"
Write-Host ""

# The action script to run (inline PowerShell via cmd wrapper)
$CurateScript  = Join-Path $ProjectDir "scripts\curate.js"
$NotifyScript  = Join-Path $ProjectDir "scripts\notify.js"

# Build the action string: curate -> git commit+push -> notify
$ActionScript = @"
cd /d "$ProjectDir" && `
node "$CurateScript" && `
git add -f public/data/daily.json && `
(git diff --cached --quiet || git commit -m "chore: daily data refresh") && `
git push origin main && `
node "$NotifyScript"
"@

# Wrap in cmd /c so Task Scheduler can run it
$CmdAction = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$ActionScript`""

$Principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Highest

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

# ── Morning task (7:30am) ──────────────────────────────────────────────────────
$MorningTrigger = New-ScheduledTaskTrigger -Daily -At "7:30AM"

Write-Host "Registering DudeWereSoCooked-Morning (7:30am daily)..."
try {
    Register-ScheduledTask `
        -TaskName "DudeWereSoCooked-Morning" `
        -TaskPath "\DudeWereSoCooked\" `
        -Action $CmdAction `
        -Trigger $MorningTrigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description "Fetch AI news, update daily.json, push to GitHub, notify Discord. Morning run." `
        -Force
    Write-Host "  OK: DudeWereSoCooked-Morning registered"
} catch {
    Write-Warning "  Failed to register morning task: $_"
}

# ── Afternoon task (3:30pm) ────────────────────────────────────────────────────
$AfternoonTrigger = New-ScheduledTaskTrigger -Daily -At "3:30PM"

Write-Host "Registering DudeWereSoCooked-Afternoon (3:30pm daily)..."
try {
    Register-ScheduledTask `
        -TaskName "DudeWereSoCooked-Afternoon" `
        -TaskPath "\DudeWereSoCooked\" `
        -Action $CmdAction `
        -Trigger $AfternoonTrigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description "Fetch AI news, update daily.json, push to GitHub, notify Discord. Afternoon run." `
        -Force
    Write-Host "  OK: DudeWereSoCooked-Afternoon registered"
} catch {
    Write-Warning "  Failed to register afternoon task: $_"
}

Write-Host ""
Write-Host "Done. Tasks registered under Task Scheduler > \DudeWereSoCooked\"
Write-Host "To verify: Get-ScheduledTask -TaskPath '\DudeWereSoCooked\'"
Write-Host "To run now: Start-ScheduledTask -TaskPath '\DudeWereSoCooked\' -TaskName 'DudeWereSoCooked-Morning'"
Write-Host ""
Write-Host "NOTE: Make sure your Discord webhook is at: $env:USERPROFILE\.claude\discord-webhook.txt"
Write-Host "NOTE: Make sure 'git push' works (SSH key or credential helper configured)."
