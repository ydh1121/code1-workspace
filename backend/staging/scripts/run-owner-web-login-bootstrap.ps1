$ErrorActionPreference = 'Stop'

Write-Host 'CODE1 STAGING owner web-login bootstrap'
Write-Host 'Input mode: visible plain text (not SecureString, not hidden).'
Write-Host 'This changes only the STAGING OWNER password and then verifies real password login.'

$sessionSecret = Read-Host 'Enter Preview SESSION_SECRET (visible)'
$newPassword = Read-Host 'Enter NEW STAGING owner password (visible, 12-128 chars)'
$sessionVersionText = Read-Host 'Enter current STAGING OWNER session version [default: 2]'
if ([string]::IsNullOrWhiteSpace($sessionVersionText)) { $sessionVersionText = '2' }

if ($sessionSecret.Length -lt 32) { throw 'SESSION_SECRET must be at least 32 characters.' }
if ($newPassword.Length -lt 12 -or $newPassword.Length -gt 128) { throw 'New password must be 12-128 characters.' }

$env:CODE1_OPERATOR_SESSION_SECRET = $sessionSecret
$env:CODE1_STAGING_OWNER_PASSWORD = $newPassword
try {
  node backend/staging/scripts/bootstrap-owner-web-login-staging.mjs `
    --base-url https://coding-runtime-backend-stagi.code1-workspace.pages.dev `
    --session-version $sessionVersionText
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Remove-Item Env:CODE1_OPERATOR_SESSION_SECRET -ErrorAction SilentlyContinue
  Remove-Item Env:CODE1_STAGING_OWNER_PASSWORD -ErrorAction SilentlyContinue
  $sessionSecret = $null
  $newPassword = $null
}
