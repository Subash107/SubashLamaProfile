Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $repoRoot

$trackedFiles = @(git ls-files)
$violations = New-Object System.Collections.Generic.List[string]

$forbiddenPathPatterns = @(
  '(^|/)\.env($|[.])',
  '(^|/)secrets?/',
  '\.(pem|key|p12|pfx|cer|crt|csr)$',
  '\.tfstate(\..+)?$',
  '(^|/)\.terraform/'
)

$textExtensions = @(
  '.ps1', '.md', '.txt', '.yml', '.yaml', '.json', '.js', '.css', '.html', '.htm', '.conf'
)

$contentPatterns = @(
  @{ Name = 'Private key block'; Pattern = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  @{ Name = 'AWS access key'; Pattern = '\bAKIA[0-9A-Z]{16}\b' },
  @{ Name = 'GitHub token'; Pattern = '\bgh[pousr]_[A-Za-z0-9]{20,}\b' },
  @{ Name = 'GitHub fine-grained token'; Pattern = '\bgithub_pat_[A-Za-z0-9_]{20,}\b' },
  @{ Name = 'Google API key'; Pattern = '\bAIza[0-9A-Za-z\-_]{35}\b' },
  @{ Name = 'Slack token'; Pattern = '\bxox[baprs]-[A-Za-z0-9-]{10,}\b' }
)

foreach ($relativePath in $trackedFiles) {
  $normalizedPath = $relativePath.Replace('\', '/')

  foreach ($pattern in $forbiddenPathPatterns) {
    if ($normalizedPath -match $pattern) {
      $violations.Add("Forbidden tracked path: $relativePath")
      break
    }
  }

  $extension = [System.IO.Path]::GetExtension($relativePath)
  if (-not $textExtensions.Contains($extension.ToLowerInvariant())) {
    continue
  }

  $fullPath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    continue
  }

  $content = Get-Content -LiteralPath $fullPath -Raw
  foreach ($entry in $contentPatterns) {
    if ($content -match $entry.Pattern) {
      $violations.Add("$($entry.Name) detected in $relativePath")
    }
  }
}

if ($violations.Count -gt 0) {
  $violations | Sort-Object -Unique | ForEach-Object { Write-Error $_ }
  throw "Secret hygiene check failed."
}

Write-Host "Secret hygiene check passed."
