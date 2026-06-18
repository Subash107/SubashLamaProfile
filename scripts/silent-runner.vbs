Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & _
    "d:\Staging\Static-Website-CI-CD-with-GitHub-Actions-and-Ubuntu-LTS-main\Static-Website-CI-CD-with-GitHub-Actions-and-Ubuntu-LTS-Portfolio\scripts\sync-download-log.ps1""", _
    0, False
Set shell = Nothing
