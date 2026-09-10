param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$SourcePath,

  [switch]$PreflightOnly,
  [switch]$IdempotentRetry
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedBranch = 'coding/runtime-backend-staging'
$ExpectedRef = 'bsintmkyhptizrjoizfb'
$Runner = Join-Path $PSScriptRoot 'run-verified-private-import.mjs'

function Invoke-NodeChecked {
  param([string[]]$Arguments)
  & node @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Node command failed with exit code $LASTEXITCODE"
  }
}

$source = (Resolve-Path -LiteralPath $SourcePath).Path
if (-not (Test-Path -LiteralPath $Runner -PathType Leaf)) {
  throw "Verified import runner not found: $Runner"
}

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne $ExpectedBranch) {
  throw "Wrong Git branch. Expected '$ExpectedBranch', got '$branch'."
}

& node --version
if ($LASTEXITCODE -ne 0) {
  throw 'Node.js is required.'
}

Write-Host "CODE1 STAGING private import"
Write-Host "Branch : $branch"
Write-Host "Project: $ExpectedRef"
Write-Host "Source : $source"
Write-Host ''
Write-Host 'Copy the CODE1 STAGING service_role key in Supabase before running this command.'
Write-Host 'The script reads it from the Windows clipboard and clears the clipboard immediately.'

$plainKey = $null
try {
  $plainKey = [string](Get-Clipboard -Raw)
  if ($null -ne $plainKey) { $plainKey = $plainKey.Trim() }
  if ([string]::IsNullOrWhiteSpace($plainKey) -or $plainKey.Length -lt 32) {
    throw 'Clipboard does not contain a valid CODE1 STAGING service_role key.'
  }

  $env:CODE1_SUPABASE_SERVICE_ROLE_KEY = $plainKey
  Set-Clipboard -Value ''
  $plainKey = $null

  Write-Host ''
  Write-Host 'Running fail-closed preflight...'
  Invoke-NodeChecked @($Runner, $source, '--preflight')

  if ($PreflightOnly) {
    Write-Host ''
    Write-Host 'Preflight completed. No data was written.'
    exit 0
  }

  Write-Host ''
  $confirm = Read-Host "Type the exact CODE1 STAGING project ref to apply ($ExpectedRef)"
  if ($confirm -ne $ExpectedRef) {
    throw 'Import confirmation ref mismatch. Nothing was written.'
  }

  $args = @($Runner, $source, '--apply')
  if ($IdempotentRetry) {
    $args += '--idempotent-retry'
  }

  Write-Host ''
  Write-Host 'Applying verified source snapshot to CODE1 STAGING only...'
  Invoke-NodeChecked $args
  Write-Host ''
  Write-Host 'Import and post-write count verification completed.'
}
finally {
  Remove-Item Env:CODE1_SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Set-Clipboard -Value '' -ErrorAction SilentlyContinue
  $plainKey = $null
}
