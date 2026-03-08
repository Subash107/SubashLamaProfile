Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

& "$PSScriptRoot\scripts\sync-resume.ps1"

$existingContainer = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq "static-site" }
if ($existingContainer) {
  docker stop static-site | Out-Null
  docker rm static-site | Out-Null
}

docker build -t static-site .
docker run -d -p 8080:80 --name static-site static-site

Write-Host "Website deployed at http://localhost:8080"
