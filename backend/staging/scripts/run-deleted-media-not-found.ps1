$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location $repoRoot

$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'coding/runtime-backend-staging') {
  throw "BRANCH_MISMATCH expected=coding/runtime-backend-staging actual=$branch"
}

Write-Host 'CODE1 deleted-media 404 Preview verifier'
Write-Host 'Input mode: visible plain text (not SecureString, not hidden).'
$secret = Read-Host 'Enter Preview SESSION_SECRET (visible)'
if ([string]::IsNullOrWhiteSpace($secret) -or $secret.Length -lt 32) {
  throw 'SESSION_SECRET must be at least 32 characters.'
}

$previous = $env:CODE1_TEST_SESSION_SECRET
try {
  $env:CODE1_TEST_SESSION_SECRET = $secret
  & node 'backend/staging/scripts/verify-deleted-media-not-found.mjs'
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  if ($null -eq $previous) {
    Remove-Item Env:CODE1_TEST_SESSION_SECRET -ErrorAction SilentlyContinue
  }
  else {
    $env:CODE1_TEST_SESSION_SECRET = $previous
  }
  $secret = $null
}
