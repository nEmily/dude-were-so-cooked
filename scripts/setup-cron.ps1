# setup-cron.ps1
# Registers Windows Task Scheduler tasks for dude-were-so-cooked daily briefings.
#
# Usage (run as Administrator or with enough perms):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-cron.ps1
#
# What it creates:
#   DudeWereSoCooked-Morning   - 7:30am daily
#   DudeWereSoCooked-Afternoon - 3:30pm daily
#
# Each task runs scripts\daily-run.bat which:
#   1. Runs curate.js to fetch fresh AI news
#   2. Commits + pushes data/daily.json to GitHub
#   3. Sends Discord notification

$ProjectDir = Split-Path -Parent $PSScriptRoot
$BatchScript = Join-Path $ProjectDir "scripts\daily-run.bat"

if (-not (Test-Path $BatchScript)) {
    Write-Error "daily-run.bat not found at $BatchScript"
    exit 1
}

Write-Host "Project dir: $ProjectDir"
Write-Host "Batch script: $BatchScript"
Write-Host ""

# Action: run the batch script directly (avoids nested-quote issues with cmd /c)
$CmdAction = New-ScheduledTaskAction `
    -Execute $BatchScript

$Principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Highest

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

# -- Morning task (7:30am) --
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
        -Description "Fetch AI news, update daily.json, send to GitHub, notify Discord. Morning run." `
        -Force
    Write-Host "  OK: DudeWereSoCooked-Morning registered"
} catch {
    Write-Warning "  Failed to register morning task: $_"
}

# -- Afternoon task (3:30pm) --
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
        -Description "Fetch AI news, update daily.json, send to GitHub, notify Discord. Afternoon run." `
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
