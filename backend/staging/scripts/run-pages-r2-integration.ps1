param(
  [string]$BaseUrl = 'https://coding-runtime-backend-stagi.code1-workspace.pages.dev',
  [string]$AccountId = 'OWNER',
  [int]$SessionVersion = 2
)

$ErrorActionPreference = 'Stop'

try {
  $env:CODE1_TEST_SESSION_SECRET = Read-Host -Prompt 'Enter Preview SESSION_SECRET (visible input)'

  node backend/staging/scripts/integrate-pages-r2-staging.mjs `
    --base-url $BaseUrl `
    --account-id $AccountId `
    --session-version "$SessionVersion" `
    --confirm-staging-r2-write

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Remove-Item Env:CODE1_TEST_SESSION_SECRET -ErrorAction SilentlyContinue
}
