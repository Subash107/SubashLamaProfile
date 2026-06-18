# Resume Download Tracker — Auto-sync script
# Checks GitHub every 2 minutes for new resume downloads
# Shows Windows notification + opens log when new download detected

# Hide this window immediately so no black CMD popup appears on screen
Add-Type -Name Win32 -Namespace Native -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'
[Native.Win32]::ShowWindow((Get-Process -Id $PID).MainWindowHandle, 0) | Out-Null

$repoPath    = "d:\Staging\Static-Website-CI-CD-with-GitHub-Actions-and-Ubuntu-LTS-main\Static-Website-CI-CD-with-GitHub-Actions-and-Ubuntu-LTS-Portfolio"
$logFile     = "$repoPath\download-logs\resume-downloads.txt"
$countFile   = "$env:TEMP\resume_dl_count.txt"

Set-Location $repoPath

# Count lines before pull
$beforeCount = 6  # header lines
if (Test-Path $logFile) {
    $beforeCount = (Get-Content $logFile).Count
}

# Pull latest from GitHub
git pull origin main --quiet 2>$null

# Count lines after pull
$afterCount = 0
if (Test-Path $logFile) {
    $afterCount = (Get-Content $logFile).Count
}

# If new lines added = new download recorded
if ($afterCount -gt $beforeCount) {
    $newCount = $afterCount - $beforeCount

    # Windows toast notification
    Add-Type -AssemblyName System.Windows.Forms
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.Visible = $true
    $notify.ShowBalloonTip(
        8000,
        "Resume Downloaded!",
        "$newCount new resume download(s) detected. Opening log...",
        [System.Windows.Forms.ToolTipIcon]::Info
    )
    Start-Sleep 2

    # Open log file in Notepad
    Start-Process notepad.exe $logFile

    $notify.Dispose()
}
