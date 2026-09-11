param(
  [Parameter(Mandatory=$true)]
  [string]$BundleRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedBucket = 'code1-staging-media'
$ExpectedProjectRef = 'bsintmkyhptizrjoizfb'
$ExpectedDeckId = 'CODE1_AZA_INTERNAL'
$ExpectedAssetCount = 15
$ExpectedRevisionCount = 2

function Fail([string]$Message) {
  throw "CODE1_DECK_PHASEC_R2_COPY_FAIL: $Message"
}

function Resolve-SafeChild([string]$Root, [string]$Relative) {
  if ([string]::IsNullOrWhiteSpace($Relative)) { Fail 'empty relative path' }
  $fullRoot = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $full = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
  if (-not $full.StartsWith($fullRoot,[StringComparison]::OrdinalIgnoreCase)) { Fail "path escapes bundle root: $Relative" }
  return $full
}

function Invoke-Wrangler([string[]]$Arguments, [switch]$AllowFailure) {
  $lines = @(& npx.cmd wrangler @Arguments 2>&1 | ForEach-Object { $_.ToString() })
  $code = $LASTEXITCODE
  if (($code -ne 0) -and (-not $AllowFailure)) {
    Fail ("wrangler failed ({0}): {1}`n{2}" -f $code,($Arguments -join ' '),($lines -join "`n"))
  }
  return [pscustomobject]@{ Code=$code; Lines=$lines; Text=($lines -join "`n") }
}

$BundleRoot = [IO.Path]::GetFullPath($BundleRoot)
if (-not (Test-Path -LiteralPath $BundleRoot -PathType Container)) { Fail "bundle root not found: $BundleRoot" }
$PlanPath = Join-Path $BundleRoot 'import-plan.json'
if (-not (Test-Path -LiteralPath $PlanPath -PathType Leaf)) { Fail 'import-plan.json not found' }
$plan = Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json

if ([int]$plan.schema_version -ne 1) { Fail 'unsupported schema_version' }
if ([string]$plan.target -ne 'CODE1 STAGING ONLY') { Fail 'target mismatch' }
if ([string]$plan.project_ref -ne $ExpectedProjectRef) { Fail 'Supabase STAGING ref mismatch' }
if ([string]$plan.bucket -ne $ExpectedBucket) { Fail 'R2 bucket mismatch' }
if ([string]$plan.deck_id -ne $ExpectedDeckId) { Fail 'Deck ID mismatch' }
if ([bool]$plan.safety.production_mutation -or [bool]$plan.safety.live_source_mutation -or [bool]$plan.safety.delete_source -or [bool]$plan.safety.r2_public) { Fail 'unsafe safety flags in import plan' }
if (@($plan.assets).Count -ne $ExpectedAssetCount) { Fail "expected $ExpectedAssetCount assets" }
if (@($plan.revisions).Count -ne $ExpectedRevisionCount) { Fail "expected $ExpectedRevisionCount revisions" }

Write-Host 'CODE1 DECK PHASE C R2 COPY'
Write-Host '==========================='
Write-Host "BUNDLE_ROOT            : $BundleRoot"
Write-Host "TARGET_BUCKET          : $ExpectedBucket"
Write-Host "TARGET_PREFIX          : private/decks/$ExpectedDeckId/assets/"
Write-Host 'PRODUCTION_MUTATION     : NONE'
Write-Host 'LIVE_SOURCE_MUTATION    : NONE'
Write-Host 'DELETE_OPERATION        : NONE'
Write-Host ''

# Validate every local byte before the first remote mutation.
$validated = @()
$seenIds = @{}
$seenKeys = @{}
foreach ($a in @($plan.assets)) {
  $assetId = [string]$a.asset_id
  $objectKey = [string]$a.object_key
  $relative = [string]$a.relative_file
  $mime = [string]$a.mime_type
  $expectedSha = ([string]$a.checksum_sha256).ToLowerInvariant()
  $expectedBytes = [int64]$a.file_size_bytes

  if ($seenIds.ContainsKey($assetId)) { Fail "duplicate asset_id: $assetId" }
  if ($seenKeys.ContainsKey($objectKey)) { Fail "duplicate object_key: $objectKey" }
  $seenIds[$assetId]=$true; $seenKeys[$objectKey]=$true
  if ($assetId -notmatch '^[A-Za-z0-9_-]{1,100}$') { Fail "invalid asset_id: $assetId" }
  if (-not $objectKey.StartsWith("private/decks/$ExpectedDeckId/assets/",[StringComparison]::Ordinal)) { Fail "object key outside Deck prefix: $objectKey" }
  if ($mime -notin @('image/jpeg','image/png','image/webp')) { Fail "unsupported mime: $mime" }
  if ($expectedSha -notmatch '^[a-f0-9]{64}$') { Fail "invalid checksum: $assetId" }
  if ($expectedBytes -lt 1 -or $expectedBytes -gt 8388608) { Fail "invalid byte size: $assetId" }

  $file = Resolve-SafeChild $BundleRoot $relative
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { Fail "asset file missing: $relative" }
  $actualBytes = (Get-Item -LiteralPath $file).Length
  $actualSha = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualBytes -ne $expectedBytes) { Fail "local byte mismatch: $assetId expected=$expectedBytes actual=$actualBytes" }
  if ($actualSha -ne $expectedSha) { Fail "local checksum mismatch: $assetId" }
  $validated += [pscustomobject]@{ AssetId=$assetId; ObjectKey=$objectKey; File=$file; Relative=$relative; Mime=$mime; Bytes=$expectedBytes; Sha256=$expectedSha }
}

Write-Host ("LOCAL_PREFLIGHT         : PASS ({0}/{0})" -f $validated.Count)

# Verify Wrangler can authenticate before any object write.
$who = Invoke-Wrangler @('whoami')
Write-Host 'WRANGLER_AUTH           : PASS'

$results = @()
foreach ($a in $validated) {
  $remotePath = "$ExpectedBucket/$($a.ObjectKey)"
  $temp = Join-Path ([IO.Path]::GetTempPath()) ("code1-deck-r2-{0}-{1}.bin" -f $a.AssetId,[Guid]::NewGuid().ToString('N'))
  $action = $null
  try {
    # Idempotent preflight: if the object already exists, it must match exactly.
    $probe = Invoke-Wrangler @('r2','object','get',$remotePath,'--file',$temp,'--remote') -AllowFailure
    if ($probe.Code -eq 0) {
      $remoteBytes = (Get-Item -LiteralPath $temp).Length
      $remoteSha = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($remoteBytes -ne $a.Bytes -or $remoteSha -ne $a.Sha256) {
        Fail "R2_OBJECT_CONFLICT: $($a.AssetId) existing object differs; refusing overwrite"
      }
      $action = 'EXISTING_MATCH'
    } else {
      if ($probe.Text -notmatch '(?i)(not found|nosuchkey|404)') {
        Fail "R2 preflight read failed for $($a.AssetId): $($probe.Text)"
      }
      if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
      Invoke-Wrangler @('r2','object','put',$remotePath,'--file',$a.File,'--content-type',$a.Mime,'--remote','--force') | Out-Null
      $action = 'COPIED'
    }

    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
    Invoke-Wrangler @('r2','object','get',$remotePath,'--file',$temp,'--remote') | Out-Null
    $verifyBytes = (Get-Item -LiteralPath $temp).Length
    $verifySha = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($verifyBytes -ne $a.Bytes -or $verifySha -ne $a.Sha256) {
      Fail "R2 post-copy verification mismatch: $($a.AssetId)"
    }

    $results += [pscustomobject]@{
      asset_id=$a.AssetId; object_key=$a.ObjectKey; action=$action;
      file_size_bytes=$verifyBytes; checksum_sha256=$verifySha; verified=$true
    }
    Write-Host ("R2_VERIFY              : PASS {0} [{1}]" -f $a.AssetId,$action)
  } finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }
  }
}

$evidence = [ordered]@{
  schema_version=1
  work_order=[string]$plan.work_order
  target='CODE1 STAGING ONLY'
  project_ref=$ExpectedProjectRef
  bucket=$ExpectedBucket
  deck_id=$ExpectedDeckId
  completed_at=(Get-Date).ToUniversalTime().ToString('o')
  asset_count=$results.Count
  all_verified=($results.Count -eq $ExpectedAssetCount -and @($results | Where-Object { -not $_.verified }).Count -eq 0)
  production_mutation='NONE'
  live_source_mutation='NONE'
  delete_operation='NONE'
  objects=$results
}
$EvidencePath = Join-Path $BundleRoot 'r2-copy-evidence.json'
$evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8

if (-not $evidence.all_verified) { Fail 'final evidence gate failed' }
Write-Host ''
Write-Host 'CODE1 DECK PHASE C R2 COPY RESULT'
Write-Host '================================='
Write-Host "ASSET_COUNT            : $($results.Count)"
Write-Host 'ALL_VERIFIED           : TRUE'
Write-Host "EVIDENCE               : $EvidencePath"
Write-Host 'SUPABASE_IMPORT         : NOT_RUN_BY_THIS_SCRIPT'
Write-Host 'PRODUCTION_MUTATION     : NONE'
Write-Host 'LIVE_SOURCE_MUTATION    : NONE'
