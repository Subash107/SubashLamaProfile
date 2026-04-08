Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))

Set-Location $repoRoot

& "$PSScriptRoot\sync-resume.ps1"

$existingContainer = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq "static-site" }
if ($existingContainer) {
  docker stop static-site | Out-Null
  docker rm static-site | Out-Null
}

docker build -t static-site $repoRoot
docker run -d -p 8080:80 --name static-site static-site

Write-Host "Website deployed at http://localhost:8080"
