param(
  [string]$SourceDir = "assets/cv",
  [string]$PublicDir = "public/assets/docs/cv",
  [string]$PublishedName = "latest-resume.pdf"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $Path))
}

function Get-DownloadFileName {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $normalized = $Name
  while ($normalized -match '(?i)\.pdf\.pdf$') {
    $normalized = $normalized -replace '(?i)\.pdf\.pdf$', '.pdf'
  }

  if ($normalized -notmatch '(?i)\.pdf$') {
    $normalized = "$normalized.pdf"
  }

  return $normalized
}

$repoRoot = Resolve-RepoPath -Path ".." -RepoRoot $PSScriptRoot
$resolvedSourceDir = Resolve-RepoPath -Path $SourceDir -RepoRoot $repoRoot
$resolvedPublicDir = Resolve-RepoPath -Path $PublicDir -RepoRoot $repoRoot

if (-not (Test-Path -LiteralPath $resolvedSourceDir -PathType Container)) {
  throw "Resume source folder not found: $resolvedSourceDir"
}

$resumeFiles = @(Get-ChildItem -LiteralPath $resolvedSourceDir -File -Filter *.pdf | Sort-Object `
  @{ Expression = "LastWriteTimeUtc"; Descending = $true }, `
  @{ Expression = "Name"; Descending = $false })

if ($resumeFiles.Count -eq 0) {
  throw "No PDF resume files found in: $resolvedSourceDir"
}

$latestResume = $resumeFiles[0]
$downloadFileName = Get-DownloadFileName -Name $latestResume.Name
$publishedFilePath = Join-Path $resolvedPublicDir $PublishedName
$manifestPath = Join-Path $resolvedPublicDir "resume-manifest.json"
$hash = (Get-FileHash -LiteralPath $latestResume.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

New-Item -ItemType Directory -Force -Path $resolvedPublicDir | Out-Null
Copy-Item -LiteralPath $latestResume.FullName -Destination $publishedFilePath -Force

$manifest = [ordered]@{
  sourceFileName = $latestResume.Name
  downloadFileName = $downloadFileName
  publishedFileName = $PublishedName
  publicPath = "assets/docs/cv/$PublishedName"
  version = $hash.Substring(0, 12)
  lastModifiedUtc = $latestResume.LastWriteTimeUtc.ToString("o")
  sizeBytes = $latestResume.Length
}

$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding ascii

Write-Host ("Published '{0}' as '{1}'" -f $latestResume.Name, $publishedFilePath)
Write-Host ("Wrote manifest '{0}'" -f $manifestPath)
