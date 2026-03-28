param(
  [int]$Port = 8080,
  [string]$Root = (Join-Path $PSScriptRoot "..\public")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedRoot = (Resolve-Path $Root).Path
$prefix = "http://localhost:$Port/"

$mimeTypes = @{
  ".css"  = "text/css; charset=utf-8"
  ".gif"  = "image/gif"
  ".html" = "text/html; charset=utf-8"
  ".ico"  = "image/x-icon"
  ".jpeg" = "image/jpeg"
  ".jpg"  = "image/jpeg"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".mp3"  = "audio/mpeg"
  ".mp4"  = "video/mp4"
  ".pdf"  = "application/pdf"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
  ".txt"  = "text/plain; charset=utf-8"
  ".webp" = "image/webp"
  ".xml"  = "application/xml; charset=utf-8"
}

function Send-Bytes {
  param(
    [Parameter(Mandatory = $true)]
    [System.Net.HttpListenerContext]$Context,
    [Parameter(Mandatory = $true)]
    [int]$StatusCode,
    [Parameter(Mandatory = $true)]
    [byte[]]$Body,
    [Parameter(Mandatory = $true)]
    [string]$ContentType
  )

  $response = $Context.Response
  $response.StatusCode = $StatusCode
  $response.ContentType = $ContentType
  $response.ContentLength64 = $Body.Length
  $response.OutputStream.Write($Body, 0, $Body.Length)
  $response.Close()
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Serving $resolvedRoot at $prefix"

try {
  while ($listener.IsListening) {
    try {
      $context = $listener.GetContext()
    } catch [System.Net.HttpListenerException] {
      break
    }

    try {
      $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }

      $candidatePath = Join-Path $resolvedRoot $requestPath
      if (Test-Path $candidatePath -PathType Container) {
        $candidatePath = Join-Path $candidatePath "index.html"
      }

      $fullPath = [System.IO.Path]::GetFullPath($candidatePath)
      $withinRoot = $fullPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)

      if (-not $withinRoot -or -not (Test-Path $fullPath -PathType Leaf)) {
        $notFound = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        Send-Bytes -Context $context -StatusCode 404 -Body $notFound -ContentType "text/plain; charset=utf-8"
        continue
      }

      $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = if ($mimeTypes.ContainsKey($extension)) {
        $mimeTypes[$extension]
      } else {
        "application/octet-stream"
      }

      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      Send-Bytes -Context $context -StatusCode 200 -Body $bytes -ContentType $contentType
    } catch {
      $serverError = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
      try {
        Send-Bytes -Context $context -StatusCode 500 -Body $serverError -ContentType "text/plain; charset=utf-8"
      } catch {
        # Ignore client disconnects so the listener keeps serving other requests.
      }
    } finally {
      try {
        $context.Response.Close()
      } catch {
        # Response may already be closed.
      }
    }
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
