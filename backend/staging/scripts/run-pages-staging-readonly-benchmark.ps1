$ErrorActionPreference = 'Stop'

$baseUrl = 'https://coding-runtime-backend-stagi.code1-workspace.pages.dev'
$accountId = 'OWNER'
$sessionVersion = '2'
$runs = '30'
$warmups = '3'

Write-Host 'CODE1 Pages Preview STAGING read-only latency benchmark'
Write-Host 'Input mode: visible plain text (not SecureString, not hidden).'
$secret = Read-Host 'Enter Preview SESSION_SECRET (visible)'
if ([string]::IsNullOrWhiteSpace($secret) -or $secret.Length -lt 32) {
    throw 'SESSION_SECRET must be at least 32 characters.'
}

$env:CODE1_BENCH_SESSION_SECRET = $secret
try {
    node .\backend\staging\scripts\benchmark-pages-staging-readonly.mjs `
        --base-url $baseUrl `
        --account-id $accountId `
        --session-version $sessionVersion `
        --runs $runs `
        --warmups $warmups

    if ($LASTEXITCODE -ne 0) {
        throw "Latency benchmark exited with code $LASTEXITCODE"
    }
}
finally {
    Remove-Item Env:CODE1_BENCH_SESSION_SECRET -ErrorAction SilentlyContinue
    $secret = $null
}
