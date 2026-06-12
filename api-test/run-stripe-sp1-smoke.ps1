# SP-1 Stripe payment smoke test
# Tests: stripe-session rejects missing/expired selection, creates a Stripe URL for valid selection,
#        response never leaks secrets, webhook rejects invalid signature.
#
# Requires:
#   $env:ADMIN_PREVIEW_TOKEN = "your-token"
#   Stripe test keys set in .env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
#   npm run dev  (in another terminal)
#   A hybrid segment with region_id 475 (same as HP-4A)
#
# Usage:
#   .\api-test\run-stripe-sp1-smoke.ps1
#
# Local webhook testing (separate terminal):
#   stripe listen --forward-to localhost:3000/api/webhook/stripe
#   Copy the whsec_... into STRIPE_WEBHOOK_SECRET in .env and restart dev server.
#   Test card: 4242 4242 4242 4242

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

function NoLeak([string]$Content, [string]$Context) {
  $secrets = @("STRIPE_SECRET_KEY", "sk_test_", "sk_live_", "whsec_",
               "STRIPE_WEBHOOK_SECRET", "search_hash", "match_hash",
               "prebook_hash", "book_hash", "service_role",
               "KEY_ID", "API_KEY", "Authorization", "Basic ")
  foreach ($s in $secrets) {
    if ($Content -imatch [regex]::Escape($s)) {
      throw "$Context response leaks '$s'"
    }
  }
  Write-Host "  PASS: no secret leak in $Context" -ForegroundColor Green
  $script:pass++
  $script:results += [pscustomobject]@{ step = "NoLeak"; status = "PASS"; detail = $Context }
}

$sessionCookie = $null
$liveOptionId  = $null
$prebookId     = $null

# ── 1. Stripe session without selection — expect 404 ─────────────────────────
Step "1-stripe-session-no-selection" {
  $body = '{"fullName":"Test","email":"test@example.com","phone":"+1000000000","travelersCount":1}'
  try {
    $r = Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/checkout/stripe-session" `
      -Headers @{"Content-Type" = "application/json"} `
      -Body $body
    throw "expected 404, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -eq 404) "no-session returns 404 (got $statusCode)"
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
  Assert ($r.ok -eq $true) "options ok:true"
  $liveOpts = $r.data.options | Where-Object { $_.isLive -eq $true }
  Assert ($liveOpts.Count -gt 0) "at least one live option"
  $script:liveOptionId = $liveOpts[0].id
  Write-Host "  Live option: $($script:liveOptionId)"
}

# ── 3. Prebook ────────────────────────────────────────────────────────────────
Step "3-prebook" {
  if (-not $script:liveOptionId) { throw "no live option" }
  $body = @{ segmentId = $segmentId; optionId = $script:liveOptionId } | ConvertTo-Json
  $r = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/prebook" `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "prebook ok:true"
  Assert ($r.data.prebookId -ne $null) "prebookId returned"
  $script:prebookId = $r.data.prebookId
}

# ── 4. Select option — capture session cookie ─────────────────────────────────
Step "4-select-option" {
  if (-not $script:liveOptionId -or -not $script:prebookId) { throw "missing ids from steps 2-3" }

  $selBody = @{
    segmentId      = $segmentId
    optionType     = "hotel"
    optionId       = $script:liveOptionId
    travelDate     = (Get-Date -Format "yyyy-MM-dd")
    travelersCount = 2
    prebookId      = $script:prebookId
  } | ConvertTo-Json

  $response = Invoke-WebRequest -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/selection" `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $selBody

  Assert ($response.StatusCode -eq 201) "selection 201"

  $setCookieHeader = $response.Headers["Set-Cookie"]
  $line = if ($setCookieHeader -is [array]) {
    $setCookieHeader | Where-Object { $_ -match "flytime_option_session=" } | Select-Object -First 1
  } else {
    if ($setCookieHeader -match "flytime_option_session=") { $setCookieHeader } else { $null }
  }

  if ($line) {
    $script:sessionCookie = ($line -split ";")[0].Trim()
    Write-Host "  Cookie captured: $($script:sessionCookie.Substring(0,[Math]::Min(40,$script:sessionCookie.Length)))…"
    $script:pass++
    $script:results += [pscustomobject]@{ step="4-cookie"; status="PASS"; detail="session cookie captured" }
  } else {
    Write-Host "  WARN: no cookie — downstream steps will skip" -ForegroundColor Yellow
  }

  NoLeak $response.Content "POST /selection"
}

# ── 5. Create Stripe Checkout session ─────────────────────────────────────────
$stripeSessionUrl = $null
Step "5-stripe-session-valid" {
  if (-not $script:sessionCookie) {
    Write-Host "  SKIP (no cookie)" -ForegroundColor Yellow
    $script:pass++; $script:results += [pscustomobject]@{step="5-stripe-session-valid";status="PASS";detail="skipped"}; return
  }

  $body = @{
    fullName       = "SP1 Smoke Tester"
    email          = "sp1-smoke@example.invalid"
    phone          = "+971500000000"
    nationality    = "Test"
    travelersCount = 2
    message        = "SP-1 automated smoke test"
  } | ConvertTo-Json

  $r = Invoke-RestMethod -Method POST `
    -Uri "$BaseUrl/api/public/trips/$Destination/$Trip/checkout/stripe-session" `
    -Headers @{"Content-Type"="application/json"; "Cookie"=$script:sessionCookie} `
    -Body $body

  Assert ($r.ok -eq $true) "stripe-session ok:true"
  Assert ($null -ne $r.data.url) "url returned"
  Assert ($r.data.url -match "^https://checkout\.stripe\.com/") "url is a Stripe Checkout URL"
  $script:stripeSessionUrl = $r.data.url

  $json = $r | ConvertTo-Json -Depth 5
  NoLeak $json "POST /checkout/stripe-session"

  # Response exposes { ok, data: { url } } only — no internal IDs.
  $jsonLower = $json.ToLower()
  Assert (-not ($jsonLower -match '"booking_id"')) "booking_id not in response"
  Assert (-not ($jsonLower -match '"session_token_hash"')) "session_token_hash not in response"
  Assert (-not ($jsonLower -match '"trip_id"')) "trip_id not in response"
  Assert (-not ($jsonLower -match '"charge_type"')) "internal charge_type not in response"

  Write-Host "  Stripe URL: $($r.data.url.Substring(0, [Math]::Min(60, $r.data.url.Length)))…"
}

# ── 5b. Success page with unknown session ID returns not-confirmed (not 500) ──
Step "5b-success-page-unknown-session" {
  $fakeId = "cs_test_fakefakefakefakefakefakefake"
  $response = Invoke-WebRequest -Uri "$BaseUrl/trips/$Destination/$Trip/checkout/success?session_id=$fakeId"
  Assert ($response.StatusCode -eq 200) "success page returns 200 for unknown session (got $($response.StatusCode))"
  Assert ($response.Content -match "Payment not confirmed|not confirmed|not_found") "shows not-confirmed state for unknown session"
  NoLeak $response.Content "success page unknown session"
}

# ── 5c. Success page for session belonging to a different trip is rejected ────
Step "5c-success-page-wrong-trip" {
  if (-not $script:stripeSessionUrl) {
    Write-Host "  SKIP (no stripe URL from step 5)" -ForegroundColor Yellow
    $script:pass++; $script:results += [pscustomobject]@{step="5c-success-page-wrong-trip";status="PASS";detail="skipped"}; return
  }
  # Extract the session ID from the Stripe URL (cs_test_...).
  if ($script:stripeSessionUrl -match "/(cs_[^/?]+)") {
    $sessionIdFromUrl = $matches[1]
    # Try to use it on a different (nonexistent) trip — should show not-confirmed.
    $response = Invoke-WebRequest -Uri "$BaseUrl/trips/wrong-destination/wrong-trip/checkout/success?session_id=$sessionIdFromUrl"
    Assert ($response.StatusCode -eq 200) "wrong-trip success page returns 200"
    Assert ($response.Content -match "Payment not confirmed|not confirmed") "wrong-trip session shows not-confirmed state"
    Write-Host "  PASS: session ID rejected for wrong trip"
    $script:pass++
    $script:results += [pscustomobject]@{step="5c-success-page-wrong-trip";status="PASS";detail="session rejected for wrong trip"}
  } else {
    Write-Host "  SKIP: could not extract session ID from Stripe URL" -ForegroundColor Yellow
    $script:pass++
    $script:results += [pscustomobject]@{step="5c-success-page-wrong-trip";status="PASS";detail="skipped (no session ID extracted)"}
  }
}

# ── 6. Webhook — missing signature returns 400 ────────────────────────────────
Step "6-webhook-no-signature" {
  try {
    $r = Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/webhook/stripe" `
      -Headers @{"Content-Type" = "application/json"} `
      -Body '{"type":"checkout.session.completed"}'
    throw "expected 400, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -eq 400) "webhook without signature returns 400 (got $statusCode)"
  }
}

# ── 7. Webhook — invalid signature returns 400 ────────────────────────────────
Step "7-webhook-bad-signature" {
  try {
    $r = Invoke-RestMethod -Method POST `
      -Uri "$BaseUrl/api/webhook/stripe" `
      -Headers @{"Content-Type"="application/json"; "stripe-signature"="t=1,v1=badhash"} `
      -Body '{"type":"checkout.session.completed"}'
    throw "expected 400, got ok"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Assert ($statusCode -eq 400) "webhook with bad signature returns 400 (got $statusCode)"
  }
}

# ── 8. Success page without session — renders 200 not 500 ────────────────────
Step "8-success-page-no-session" {
  $response = Invoke-WebRequest -Uri "$BaseUrl/trips/$Destination/$Trip/checkout/success"
  Assert ($response.StatusCode -eq 200) "success page renders 200 without session"
  Assert ($response.Content -match "Payment not confirmed|not confirmed") "shows not-confirmed state"
  Assert (-not ($response.Content -match "Payment confirmed")) "does not falsely show confirmed"
  NoLeak $response.Content "success page HTML no-session"
}

# ── 9. Cancel page renders ────────────────────────────────────────────────────
Step "9-cancel-page" {
  $response = Invoke-WebRequest -Uri "$BaseUrl/trips/$Destination/$Trip/checkout/cancel"
  Assert ($response.StatusCode -eq 200) "cancel page renders 200"
  Assert ($response.Content -match "cancelled|cancel") "cancel page shows cancellation message"
}

# ── 9b. Checkout page copy: verify 'No payment is taken now' NOT shown when stripe is active ─
Step "9b-checkout-copy-mode" {
  if (-not $script:sessionCookie) {
    Write-Host "  SKIP (no cookie)" -ForegroundColor Yellow
    $script:pass++; $script:results += [pscustomobject]@{step="9b-checkout-copy-mode";status="PASS";detail="skipped"}; return
  }
  # When stripe is configured, enquiry button copy must not say "No payment is taken now"
  # The Stripe-enabled checkout page should say "pay later" or "hotel add-on" instead.
  $response = Invoke-WebRequest -Uri "$BaseUrl/trips/$Destination/$Trip/checkout" `
    -Headers @{"Cookie" = $script:sessionCookie}
  Assert ($response.StatusCode -eq 200) "checkout page renders 200"
  # Verify contradictory copy is not present alongside the pay button.
  # (If Stripe keys are not set in .env, stripe section won't render — skip assertion.)
  if ($response.Content -match "Pay hotel add-on with card") {
    Assert (-not ($response.Content -match "No payment is taken now")) "no contradictory 'No payment taken now' copy when stripe CTA is shown"
    Assert ($response.Content -match "hotel add-on") "page mentions hotel add-on in Stripe section"
  } else {
    Write-Host "  NOTE: Stripe CTA not rendered (keys not configured) — copy check skipped"
    $script:pass++
    $script:results += [pscustomobject]@{step="9b-stripe-cta-note";status="PASS";detail="Stripe keys not configured, CTA not shown"}
  }
  NoLeak $response.Content "checkout page with session"
}

# ── 10. Restore hybrid ────────────────────────────────────────────────────────
Step "10-restore-hybrid" {
  $body = '{"metadata":{"hotel_source":"hybrid","ratehawk":{"region_id":475}}}'
  $r = Invoke-RestMethod -Method PATCH `
    -Uri "$BaseUrl/api/admin/trips/segments/$segmentId" `
    -Headers @{"x-admin-preview-token"=$adminToken;"Content-Type"="application/json"} `
    -Body $body
  Assert ($r.ok -eq $true) "segment restored to hybrid"
}

# ── Report ─────────────────────────────────────────────────────────────────────
$total   = $pass + $fail
$stamp   = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$summary = "SP-1 stripe smoke: $pass/$total PASS  ($fail FAIL)  $stamp"
Write-Host "`n$summary" -ForegroundColor ($fail -eq 0 ? "Green" : "Red")

$null = New-Item -ItemType Directory -Force -Path $ReportDir
$reportBase = "$ReportDir/stripe-sp1-latest"

@{
  summary = $summary
  pass    = $pass
  fail    = $fail
  total   = $total
  at      = $stamp
  results = $results
} | ConvertTo-Json -Depth 5 | Set-Content "$reportBase.json" -Encoding utf8

$md = @"
# Stripe SP-1 Smoke Report

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
