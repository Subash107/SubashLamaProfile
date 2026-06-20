#Requires -Version 5.1
<#
.SYNOPSIS
    Watches for new resume downloads and shows a Windows toast notification.

.DESCRIPTION
    Polls the GitHub API every 5 minutes for new commits to download-logs/resume-downloads.txt.
    When a new download is detected, a Windows 10/11 toast notification pops up on screen.

.NOTES
    Run once manually to test:
        pwsh .\scripts\watch-resume-downloads.ps1

    Install as a background scheduled task (runs every 5 min, even when terminal is closed):
        pwsh .\scripts\watch-resume-downloads.ps1 -Install

    Remove the scheduled task:
        pwsh .\scripts\watch-resume-downloads.ps1 -Uninstall
#>

param(
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$RunOnce
)

$REPO         = "Subash107/SubashLamaProfile"
$LOG_FILE     = "download-logs/resume-downloads.txt"
$STATE_FILE   = "$env:LOCALAPPDATA\ResumeDownloadWatcher\last-seen-sha.txt"
$TASK_NAME    = "ResumeDownloadWatcher"
$POLL_MINUTES = 5

# ── Scheduled task management ────────────────────────────────────────────────

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Scheduled task '$TASK_NAME' removed."
    exit 0
}

if ($Install) {
    $scriptPath = $MyInvocation.MyCommand.Path
    $action  = New-ScheduledTaskAction -Execute "pwsh.exe" `
                 -Argument "-NonInteractive -WindowStyle Hidden -File `"$scriptPath`" -RunOnce"
    $trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes $POLL_MINUTES) `
                 -Once -At (Get-Date)
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
                  -StartWhenAvailable
    Register-ScheduledTask -TaskName $TASK_NAME -Action $action -Trigger $trigger `
      -Settings $settings -RunLevel Highest -Force | Out-Null
    Write-Host "Installed! Task '$TASK_NAME' will check for new downloads every $POLL_MINUTES minutes."
    Write-Host "It runs silently in the background — no terminal needed."
    exit 0
}

# ── Toast notification helper ─────────────────────────────────────────────────

function Show-Toast {
    param([string]$Title, [string]$Body)

    $xml = [xml]@"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>$([System.Security.SecurityElement]::Escape($Title))</text>
      <text>$([System.Security.SecurityElement]::Escape($Body))</text>
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.Default"/>
</toast>
"@
    Add-Type -AssemblyName Windows.UI 2>$null
    $null = [Windows.UI.Notifications.ToastNotificationManager,    Windows.UI.Notifications, ContentType = WindowsRuntime]
    $null = [Windows.Data.Xml.Dom.XmlDocument,                     Windows.Data.Xml.Dom,     ContentType = WindowsRuntime]

    $xmlDoc  = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xmlDoc.LoadXml($xml.OuterXml)
    $toast   = New-Object Windows.UI.Notifications.ToastNotification $xmlDoc
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Resume Download Watcher")
    $notifier.Show($toast)
}

# ── Poll GitHub for new commits ───────────────────────────────────────────────

function Get-LatestCommitSha {
    $uri = "https://api.github.com/repos/$REPO/commits?path=$LOG_FILE&per_page=1"
    try {
        $resp = Invoke-RestMethod -Uri $uri -Headers @{ "User-Agent" = "ResumeWatcher/1.0" } -ErrorAction Stop
        return $resp[0].sha
    } catch {
        return $null
    }
}

function Get-LastDownloadLine {
    $uri = "https://api.github.com/repos/$REPO/contents/$LOG_FILE"
    try {
        $resp    = Invoke-RestMethod -Uri $uri -Headers @{ "User-Agent" = "ResumeWatcher/1.0" } -ErrorAction Stop
        $content = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($resp.content -replace "`n",""))
        $lines   = $content -split "`n" | Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}' }
        return $lines[-1]
    } catch {
        return $null
    }
}

# ── Main check ────────────────────────────────────────────────────────────────

New-Item -ItemType Directory -Force -Path (Split-Path $STATE_FILE) | Out-Null

$latestSha = Get-LatestCommitSha
if (-not $latestSha) {
    Write-Host "Could not reach GitHub API. Skipping this check."
    exit 0
}

$lastSeenSha = if (Test-Path $STATE_FILE) { Get-Content $STATE_FILE -Raw | ForEach-Object { $_.Trim() } } else { "" }

if ($lastSeenSha -eq $latestSha) {
    Write-Host "No new downloads since last check."
    exit 0
}

# New commit detected — get the latest log line for details
$lastLine = Get-LastDownloadLine

$title = "Resume Downloaded!"
$body  = if ($lastLine) {
    $parts = $lastLine -split '\|'
    $ts    = $parts[0].Trim()
    $loc   = $parts[2].Trim()
    $org   = $parts[3].Trim()
    $os    = $parts[4].Trim()
    "Location: $loc`nCompany:  $org`nOS: $os`nTime: $ts"
} else {
    "Someone downloaded your resume! Check the log on GitHub."
}

Show-Toast -Title $title -Body $body
Write-Host "Notification sent: $title"

# Save the latest SHA so we don't re-notify
Set-Content -Path $STATE_FILE -Value $latestSha -Encoding utf8
