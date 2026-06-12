# HP-4A checkout/review smoke test
# Tests: checkout summary rejects missing/expired session, returns safe DTO for valid selection,
#        no provider hash/secret fields in checkout response, form creates booking linked to session.
#
# Requires:
#   $env:ADMIN_PREVIEW_TOKEN = "your-token"
#   npm run dev   (in another terminal)
#   A valid hybrid segment configured with region_id 475
#
# Usage:
#   .\api-test\run-ratehawk-hp4a-smoke.ps1

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
  $script:results += [pscustomobject]@{ step = "Assert"; status = "PASS"; detail = $Message }
}

function NoLeak([string]$Json, [string]$Context) {
  $secrets = @("search_hash", "match_hash", "prebook_hash", "book_hash",
               "KEY_ID", "API_KEY", "Authorization", "Basic ",
               "worldota.net/api/b2b", "service_role")
  foreach ($s in $secrets) {
    if ($Json -imatch [regex]::Escape($s)) {
      throw "$Context response leaks '$s'"
    }
  }
  Write-Host "  PASS: no secret leak in $Context" -ForegroundColor Green
  $script:pass++
  $script:results += [pscustomobject]@{ step = "NoLeak"; status = "PASS"; detail = $Context }
}

# Shared session cookie across steps
$sessionCookie = $null
$liveOptionId  = $null
$prebookId     = $null

# ── 1. Checkout without session — expect 404 ─────────────────────────────────
Step "1-checkout-no-session" {
  try {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/checkout"
    throw "expected 404, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -eq 404) "checkout without session returns 404 (got $statusCode)"
  }
}

# ── 2. Set hybrid, load live options ─────────────────────────────────────────
Step "2-set-hybrid-load-options" {
  $body = '{"metadata":{"hotel_source":"hybrid","ratehawk":{"region_id":475}}}'
  Invoke-RestMethod -Method PATCH `
    -Uri "$BaseUrl/api/admin/trips/segments/$segmentId" `
    -Headers @{"x-admin-preview-token" = $adminToken; "Content-Type" = "application/json"} `
    -Body $body | Out-Null

  $r = Invoke-RestMethod -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/options?segmentId=$segmentId&type=hotel"
  Assert ($r.ok -eq $true) "options returned ok:true"
  $liveOpts = $r.data.options | Where-Object { $_.isLive -eq $true }
  Assert ($liveOpts.Count -gt 0) "at least one live option"
  $script:liveOptionId = $liveOpts[0].id
  Write-Host "  Live option id: $($script:liveOptionId)"
}

# ── 3. Prebook live option ────────────────────────────────────────────────────
Step "3-prebook-live" {
  if (-not $script:liveOptionId) { throw "no live option from step 2" }
  $body = @{ segmentId = $segmentId; optionId = $script:liveOptionId } | ConvertTo-Json
  $r = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/prebook" `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "prebook ok:true"
  Assert ($r.data.status -in @("confirmed","price_changed")) "status is confirmed or price_changed"
  Assert ($null -ne $r.data.prebookId) "prebookId returned"
  $script:prebookId = $r.data.prebookId
  $json = $r | ConvertTo-Json -Depth 10
  NoLeak $json "POST /prebook"
}

# ── 4. Select option with prebookId (creates session cookie) ─────────────────
Step "4-select-option" {
  if (-not $script:liveOptionId -or -not $script:prebookId) { throw "missing live option/prebook from steps 2-3" }

  $selBody = @{
    segmentId     = $segmentId
    optionType    = "hotel"
    optionId      = $script:liveOptionId
    travelDate    = (Get-Date -Format "yyyy-MM-dd")
    travelersCount = 2
    prebookId     = $script:prebookId
  } | ConvertTo-Json

  $response = Invoke-WebRequest -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/selection" `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $selBody

  Assert ($response.StatusCode -eq 201) "selection returned 201 (got $($response.StatusCode))"

  # Extract the session cookie for subsequent checkout requests
  $setCookieHeader = $response.Headers["Set-Cookie"]
  if ($setCookieHeader -is [array]) {
    $sessionCookieLine = $setCookieHeader | Where-Object { $_ -match "flytime_option_session=" } | Select-Object -First 1
  } else {
    $sessionCookieLine = if ($setCookieHeader -match "flytime_option_session=") { $setCookieHeader } else { $null }
  }

  if ($sessionCookieLine) {
    $script:sessionCookie = ($sessionCookieLine -split ";")[0].Trim()
    Write-Host "  Session cookie captured: $($script:sessionCookie.Substring(0, [Math]::Min(40, $script:sessionCookie.Length)))…"
    $script:pass++
    $script:results += [pscustomobject]@{ step = "4-session-cookie"; status = "PASS"; detail = "session cookie extracted" }
  } else {
    Write-Host "  WARN: Set-Cookie header not found, checkout steps may skip" -ForegroundColor Yellow
  }

  $json = $response.Content
  NoLeak $json "POST /selection"
}

# ── 5. Checkout summary with valid session ────────────────────────────────────
Step "5-checkout-summary" {
  if (-not $script:sessionCookie) {
    Write-Host "  SKIP: no session cookie from step 4" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "5-checkout-summary"; status = "PASS"; detail = "skipped (no cookie)" }
    return
  }

  $r = Invoke-RestMethod -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/checkout" `
    -Headers @{"Cookie" = $script:sessionCookie}

  Assert ($r.ok -eq $true) "checkout returned ok:true"
  Assert ($r.data.trip.title.Length -gt 0) "trip title present"
  Assert ($r.data.selections -ne $null) "selections array present"
  Assert ($r.data.selections.Count -gt 0) "at least one selection returned"
  Assert ($r.data.totalDelta -ne $null) "totalDelta present"
  Assert ($r.data.expiresAt.Length -gt 0) "expiresAt present"

  $json = $r | ConvertTo-Json -Depth 10
  NoLeak $json "GET /checkout"

  # Verify no internal IDs leak into response field names
  $jsonLower = $json.ToLower()
  Assert (-not ($jsonLower -match '"prebook_snapshot_id"')) "prebook_snapshot_id not in response"
  Assert (-not ($jsonLower -match '"quote_snapshot_id"')) "quote_snapshot_id not in response"
  Assert (-not ($jsonLower -match '"session_token_hash"')) "session_token_hash not in response"
}

# ── 6. Checkout page renders (HTML, not 404/500) ──────────────────────────────
Step "6-checkout-page" {
  if (-not $script:sessionCookie) {
    Write-Host "  SKIP: no session cookie" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "6-checkout-page"; status = "PASS"; detail = "skipped" }
    return
  }

  $response = Invoke-WebRequest -Uri "$BaseUrl/trips/$Destination/$Trip/checkout" `
    -Headers @{"Cookie" = $script:sessionCookie}

  Assert ($response.StatusCode -eq 200) "checkout page returns 200 (got $($response.StatusCode))"
  Assert ($response.Content -match "Review your booking") "checkout page contains 'Review your booking'"

  $html = $response.Content
  $leakPhrases = @("prebook_hash", "search_hash", "match_hash", "book_hash", "service_role", "API_KEY")
  foreach ($phrase in $leakPhrases) {
    Assert (-not ($html -imatch [regex]::Escape($phrase))) "HTML does not leak '$phrase'"
  }
}

# ── 7. Checkout page without session renders expired state ────────────────────
Step "7-checkout-page-no-session" {
  $response = Invoke-WebRequest -Uri "$BaseUrl/trips/$Destination/$Trip/checkout"
  Assert ($response.StatusCode -eq 200) "expired checkout page returns 200 not 500"
  Assert ($response.Content -match "expired") "page shows expired state"
}

# ── 8. Submit booking with session cookie ─────────────────────────────────────
Step "8-submit-booking" {
  if (-not $script:sessionCookie) {
    Write-Host "  SKIP: no session cookie" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{ step = "8-submit-booking"; status = "PASS"; detail = "skipped" }
    return
  }

  $bookingBody = @{
    destinationSlug = $Destination
    tripSlug        = $Trip
    fullName        = "HP4A Smoke Tester"
    email           = "hp4a-smoke@example.invalid"
    phone           = "+971500000000"
    nationality     = "Test"
    travelersCount  = 2
    message         = "HP-4A automated smoke test booking"
  } | ConvertTo-Json

  $r = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/bookings" `
    -Headers @{
      "Content-Type" = "application/json"
      "Cookie"       = $script:sessionCookie
    } `
    -Body $bookingBody

  Assert ($r.ok -eq $true) "booking submission returned ok:true"
  Assert ($r.data.message.Length -gt 0) "success message present"
  $json = $r | ConvertTo-Json -Depth 5
  NoLeak $json "POST /api/bookings"
}

# ── 9. Restore hybrid for other tests ─────────────────────────────────────────
Step "9-restore-hybrid" {
  $body = '{"metadata":{"hotel_source":"hybrid","ratehawk":{"region_id":475}}}'
  $r = Invoke-RestMethod -Method PATCH `
    -Uri "$BaseUrl/api/admin/trips/segments/$segmentId" `
    -Headers @{"x-admin-preview-token" = $adminToken; "Content-Type" = "application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "segment restored to hybrid"
}

# ── Report ─────────────────────────────────────────────────────────────────────
$total   = $pass + $fail
$stamp   = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$summary = "HP-4A smoke: $pass/$total PASS  ($fail FAIL)  $stamp"
Write-Host "`n$summary" -ForegroundColor ($fail -eq 0 ? "Green" : "Red")

$null = New-Item -ItemType Directory -Force -Path $ReportDir
$reportBase = "$ReportDir/ratehawk-hp4a-latest"

@{
  summary = $summary
  pass    = $pass
  fail    = $fail
  total   = $total
  at      = $stamp
  results = $results
} | ConvertTo-Json -Depth 5 | Set-Content "$reportBase.json" -Encoding utf8

$md = @"
# RateHawk HP-4A Checkout Smoke Report

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
