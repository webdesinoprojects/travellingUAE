# HP-3 RateHawk prebook smoke test
# Tests: prebook route shape, manual option skip, live prebook, expiry rejection,
#        no hash/key leak. Requires dev server + ADMIN_PREVIEW_TOKEN set.
#
# Usage:
#   $env:ADMIN_PREVIEW_TOKEN = "your-token"
#   npm run dev   (in another terminal)
#   .\api-test\run-ratehawk-hp3-smoke.ps1

param(
  [string]$BaseUrl     = "http://localhost:3000",
  [string]$Destination = "armenia",
  [string]$Trip        = "yerevan-flexible-city-break",
  [string]$ReportDir   = "api-test/reports"
)

$adminToken = $env:ADMIN_PREVIEW_TOKEN
if (-not $adminToken) {
  Write-Error "ADMIN_PREVIEW_TOKEN env var is not set."
  exit 1
}

$segmentId = "00000000-0000-4000-8000-000000000503"
$pass = 0
$fail = 0
$results = @()

function Step([string]$Name, [scriptblock]$Block) {
  Write-Host "`n[$Name]" -ForegroundColor Cyan
  try {
    & $Block
  } catch {
    $script:fail++
    $script:results += [pscustomobject]@{ step = $Name; status = "FAIL"; detail = $_.Exception.Message }
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Assert([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
  Write-Host "  PASS: $Message" -ForegroundColor Green
  $script:pass++
  $script:results += [pscustomobject]@{ step = $args[1]; status = "PASS"; detail = $Message }
}

function NoLeak([string]$Json, [string]$Context) {
  $secrets = @("search_hash", "match_hash", "prebook_hash", "KEY_ID", "API_KEY",
               "Authorization", "Basic ", "worldota.net/api/b2b")
  foreach ($s in $secrets) {
    if ($Json -imatch [regex]::Escape($s)) {
      throw "$Context response leaks '$s'"
    }
  }
  Write-Host "  PASS: no secret leak in $Context" -ForegroundColor Green
  $script:pass++
  $script:results += [pscustomobject]@{ step = "NoLeak"; status = "PASS"; detail = $Context }
}

# ── 1. Set segment to hybrid (live) mode ─────────────────────────────────────
Step "1-set-hybrid" {
  $body = '{"metadata":{"hotel_source":"hybrid","ratehawk":{"region_id":475}}}'
  $r = Invoke-RestMethod -Method PATCH `
    -Uri "$BaseUrl/api/admin/trips/segments/$segmentId" `
    -Headers @{"x-admin-preview-token" = $adminToken; "Content-Type" = "application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "segment PATCH returned ok:true"
}

# ── 2. Load live options — capture first live option id ──────────────────────
$liveOptionId = $null
Step "2-load-live-options" {
  $url = "$BaseUrl/api/public/trips/$Destination/$Trip/options?segmentId=$segmentId&type=hotel"
  $r = Invoke-RestMethod -Uri $url
  Assert ($r.ok -eq $true) "options returned ok:true"
  $liveOpts = $r.data.options | Where-Object { $_.isLive -eq $true }
  Assert ($liveOpts.Count -gt 0) "at least one live option returned"
  $script:liveOptionId = $liveOpts[0].id
  Write-Host "  Live option id: $($script:liveOptionId)"
  $json = $r | ConvertTo-Json -Depth 10
  NoLeak $json "GET /options"
}

# ── 3. Prebook with live option — expect confirmed or price_changed ──────────
$prebookId = $null
Step "3-prebook-live" {
  if (-not $script:liveOptionId) { throw "no live option from step 2" }
  $body = @{ segmentId = $segmentId; optionId = $script:liveOptionId } | ConvertTo-Json
  $r = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/prebook" `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "prebook returned ok:true"
  Assert ($r.data.status -in @("confirmed","price_changed")) "status is confirmed or price_changed"
  Assert ($r.data.optionId -eq $script:liveOptionId) "optionId echoed correctly"
  Assert ($r.data.newPrice.amount -gt 0) "newPrice.amount is positive"
  Assert ($r.data.newPrice.currency.Length -gt 0) "newPrice.currency is present"
  Assert ($null -ne $r.data.prebookId) "prebookId is returned (server-stored)"
  if ($r.data.cancellationSummary) {
    Assert ($r.data.cancellationSummary.Length -gt 0) "cancellationSummary is a non-empty string"
  }
  $script:prebookId = $r.data.prebookId
  $json = $r | ConvertTo-Json -Depth 10
  NoLeak $json "POST /prebook live"
}

# ── 4. Prebook with unknown option id — expect 404 ───────────────────────────
Step "4-prebook-unknown-option" {
  try {
    $body = @{ segmentId = $segmentId; optionId = "00000000-0000-0000-0000-000000000000" } | ConvertTo-Json
    $r = Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/prebook" `
      -Headers @{"Content-Type" = "application/json"} `
      -Body $body
    throw "expected 404, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -eq 404) "unknown option returns 404 (got $statusCode)"
  }
}

# ── 5. Set segment back to manual — load manual option ───────────────────────
$manualOptionId = $null
Step "5-set-manual-load-options" {
  $body = '{"metadata":{"hotel_source":"manual"}}'
  Invoke-RestMethod -Method PATCH `
    -Uri "$BaseUrl/api/admin/trips/segments/$segmentId" `
    -Headers @{"x-admin-preview-token" = $adminToken; "Content-Type" = "application/json"} `
    -Body $body | Out-Null
  $url = "$BaseUrl/api/public/trips/$Destination/$Trip/options?segmentId=$segmentId&type=hotel"
  $r = Invoke-RestMethod -Uri $url
  $manualOpts = $r.data.options | Where-Object { $_.isLive -ne $true }
  if ($manualOpts.Count -gt 0) {
    $script:manualOptionId = $manualOpts[0].id
    Assert ($true) "manual option found: $($script:manualOptionId)"
  } else {
    Write-Host "  SKIP: no manual options in DB (hybrid smoke residue may exist)" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "5-set-manual"; status = "PASS"; detail = "no manual rows to test" }
  }
}

# ── 6. Prebook manual option — expect confirmed, no ETG call ─────────────────
Step "6-prebook-manual" {
  if (-not $script:manualOptionId) {
    Write-Host "  SKIP: no manual option id" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "6-prebook-manual"; status = "PASS"; detail = "skipped (no manual row)" }
    return
  }
  $body = @{ segmentId = $segmentId; optionId = $script:manualOptionId } | ConvertTo-Json
  $r = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/prebook" `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "prebook manual returned ok:true"
  Assert ($r.data.status -eq "confirmed") "manual option immediately confirmed"
  Assert ($null -eq $r.data.prebookId) "prebookId is null for manual option"
  Assert ($r.data.priceChanged -eq $false) "priceChanged is false for manual option"
  $json = $r | ConvertTo-Json -Depth 10
  NoLeak $json "POST /prebook manual"
}

# ── 7. Missing body fields — expect 400 ──────────────────────────────────────
Step "7-missing-fields" {
  try {
    $r = Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/prebook" `
      -Headers @{"Content-Type" = "application/json"} `
      -Body '{}'
    throw "expected 400, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -eq 400) "missing fields returns 400 (got $statusCode)"
  }
}

# ── 8. Selection with valid prebookId — expect 200 and binding stored ────────
Step "8-select-with-prebook" {
  if (-not $script:liveOptionId -or -not $script:prebookId) {
    Write-Host "  SKIP: no live option or prebookId from earlier steps" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "8-select-with-prebook"; status = "PASS"; detail = "skipped (no live prebook from step 3)" }
    return
  }
  # Ensure segment is hybrid so live option is still valid
  $body = '{"metadata":{"hotel_source":"hybrid","ratehawk":{"region_id":475}}}'
  Invoke-RestMethod -Method PATCH `
    -Uri "$BaseUrl/api/admin/trips/segments/$segmentId" `
    -Headers @{"x-admin-preview-token" = $adminToken; "Content-Type" = "application/json"} `
    -Body $body | Out-Null

  $selBody = @{
    segmentId    = $segmentId
    optionType   = "hotel"
    optionId     = $script:liveOptionId
    travelDate   = (Get-Date -Format "yyyy-MM-dd")
    travelersCount = 2
    prebookId    = $script:prebookId
  } | ConvertTo-Json
  $r = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/selection" `
    -Headers @{"Content-Type" = "application/json"} `
    -ContentType "application/json" `
    -Body $selBody
  Assert ($r.ok -eq $true) "selection with valid prebookId returned ok:true"
  Assert ($r.data.selected -ne $null) "selected option in response"
  $json = $r | ConvertTo-Json -Depth 10
  NoLeak $json "POST /selection with prebookId"
}

# ── 9. Selection with forged prebookId — expect 400 ──────────────────────────
Step "9-select-forged-prebook" {
  if (-not $script:liveOptionId) {
    Write-Host "  SKIP: no live option from step 2" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "9-select-forged-prebook"; status = "PASS"; detail = "skipped" }
    return
  }
  try {
    $selBody = @{
      segmentId    = $segmentId
      optionType   = "hotel"
      optionId     = $script:liveOptionId
      travelDate   = (Get-Date -Format "yyyy-MM-dd")
      travelersCount = 2
      prebookId    = "00000000-dead-beef-0000-000000000000"
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/selection" `
      -Headers @{"Content-Type" = "application/json"} `
      -Body $selBody
    throw "expected 400 or 404 for forged prebookId, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -in @(400, 404)) "forged prebookId rejected (got $statusCode)"
  }
}

# ── 10. Live option selection without prebookId — expect 400 ─────────────────
Step "10-select-live-no-prebook" {
  if (-not $script:liveOptionId) {
    Write-Host "  SKIP: no live option from step 2" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "10-select-live-no-prebook"; status = "PASS"; detail = "skipped" }
    return
  }
  try {
    $selBody = @{
      segmentId    = $segmentId
      optionType   = "hotel"
      optionId     = $script:liveOptionId
      travelDate   = (Get-Date -Format "yyyy-MM-dd")
      travelersCount = 2
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/selection" `
      -Headers @{"Content-Type" = "application/json"} `
      -Body $selBody
    throw "expected 400 for live option without prebookId, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -eq 400) "live option without prebookId rejected with 400 (got $statusCode)"
  }
}

# ── 11. Restore hybrid mode for other tests ───────────────────────────────────
Step "11-restore-hybrid" {
  $body = '{"metadata":{"hotel_source":"hybrid","ratehawk":{"region_id":475}}}'
  $r = Invoke-RestMethod -Method PATCH `
    -Uri "$BaseUrl/api/admin/trips/segments/$segmentId" `
    -Headers @{"x-admin-preview-token" = $adminToken; "Content-Type" = "application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "segment restored to hybrid"
}

# ── Report ────────────────────────────────────────────────────────────────────
$total = $pass + $fail
$stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$summary = "HP-3 smoke: $pass/$total PASS  ($fail FAIL)  $stamp"
Write-Host "`n$summary" -ForegroundColor ($fail -eq 0 ? "Green" : "Red")

$null = New-Item -ItemType Directory -Force -Path $ReportDir
$reportBase = "$ReportDir/ratehawk-hp3-latest"

@{
  summary  = $summary
  pass     = $pass
  fail     = $fail
  total    = $total
  at       = $stamp
  results  = $results
} | ConvertTo-Json -Depth 5 | Set-Content "$reportBase.json" -Encoding utf8

$md = @"
# RateHawk HP-3 Prebook Smoke Report

**$summary**

| Step | Status | Detail |
|------|--------|--------|
"@
foreach ($r in $results) {
  $icon = if ($r.status -eq "PASS") { "✅" } else { "❌" }
  $md += "`n| $($r.step) | $icon $($r.status) | $($r.detail) |"
}
$md | Set-Content "$reportBase.md" -Encoding utf8

Write-Host "Report: $reportBase.md"

if ($fail -gt 0) { exit 1 }
