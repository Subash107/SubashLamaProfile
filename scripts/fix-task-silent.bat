@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ts = New-Object -ComObject 'Schedule.Service'; $ts.Connect(); $folder = $ts.GetFolder('\'); $task = $folder.GetTask('ResumeDownloadLogSync'); $def = $task.Definition; $def.Actions.Clear(); $a = $def.Actions.Create(0); $a.Path = 'wscript.exe'; $a.Arguments = '//nologo //b \"d:\Staging\Static-Website-CI-CD-with-GitHub-Actions-and-Ubuntu-LTS-main\Static-Website-CI-CD-with-GitHub-Actions-and-Ubuntu-LTS-Portfolio\scripts\silent-runner.vbs\"'; $folder.RegisterTaskDefinition('ResumeDownloadLogSync', $def, 4, $null, $null, 3); Write-Host 'SUCCESS: Task updated. Black CMD window will no longer appear.'"
pause
