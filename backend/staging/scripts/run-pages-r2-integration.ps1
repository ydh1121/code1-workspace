param(
  [string]$BaseUrl = 'https://coding-runtime-backend-stagi.code1-workspace.pages.dev',
  [string]$AccountId = 'OWNER',
  [int]$SessionVersion = 2
)

$ErrorActionPreference = 'Stop'
[System.IntPtr]$bstr = [System.IntPtr]::Zero
$secure = $null

try {
  $secure = Read-Host -Prompt 'Paste Preview SESSION_SECRET (hidden)' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:CODE1_TEST_SESSION_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

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
  if ($bstr -ne [System.IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  $secure = $null
}
