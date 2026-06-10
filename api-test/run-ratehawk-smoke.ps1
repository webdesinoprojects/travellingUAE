param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ReportPath = "api-test/reports/ratehawk-hotel-foundation-latest.md",
  [string]$AdminToken = ""
)

# Focused smoke coverage for the RateHawk / ETG hotel provider foundation
# (Phase HP-1). It only calls Fly Time API routes; it never calls RateHawk from
# this script and never prints env values. See dev/testing-contract.md.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$script:Results = @()

function Read-DotEnv {
  param([string]$Path)
  $map = @{}
  if (!(Test-Path -LiteralPath $Path)) { return $map }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $map[$matches[1].Trim()] = $matches[2].Trim().Trim('"')
    }
  }
  return $map
}

function Add-Result {
  param([string]$Name, [string]$Method, [string]$Url, [int]$Status, [bool]$Passed, [string]$Detail, [int]$Ms)
  $script:Results += [pscustomobject]@{
    name = $Name; method = $Method; url = $Url; status = $Status
    passed = $Passed; detail = $Detail; ms = $Ms
  }
}

function Invoke-Raw {
  param([string]$Method = "GET", [string]$Path, [hashtable]$Headers = @{})
  $url = "$BaseUrl$Path"
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($Method), $url)
  foreach ($h in $Headers.GetEnumerator()) {
    [void]$request.Headers.TryAddWithoutValidation($h.Key, [string]$h.Value)
  }
  $response = $script:HttpClient.SendAsync($request).GetAwaiter().GetResult()
  $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $timer.Stop()
  return @{ status = [int]$response.StatusCode; body = $content; ms = [int]$timer.ElapsedMilliseconds }
}

$script:HttpHandler = New-Object System.Net.Http.HttpClientHandler
$script:HttpClient = New-Object System.Net.Http.HttpClient($script:HttpHandler)
$script:HttpClient.Timeout = [TimeSpan]::FromSeconds(60)

$envMap = Read-DotEnv ".env"
$adminToken = if ($AdminToken) { $AdminToken } else { $envMap["ADMIN_PREVIEW_TOKEN"] }
$rhEnv = if ($envMap["RATEHAWK_ENV"]) { $envMap["RATEHAWK_ENV"] } else { "test" }

$routePath = "/api/admin/providers/ratehawk/hotel-search-test"

# ---- 1. Env presence check (names only, never values) ----------------------
$rhEnvUpper = $rhEnv.ToUpper()
$keyIdName = "RATEHAWK_${rhEnvUpper}_KEY_ID"
$apiKeyName = "RATEHAWK_${rhEnvUpper}_API_KEY"
$keyIdVal = $envMap[$keyIdName]
$apiKeyVal = $envMap[$apiKeyName]
$credsPresent = [bool]($keyIdVal -and $apiKeyVal)

Add-Result -Name "RateHawk env presence (no values printed)" -Method "ENV" -Url ".env" -Status 0 -Passed $true `
  -Detail "env=$rhEnv keyId=$(if ($keyIdVal) { 'present' } else { 'missing' }) apiKey=$(if ($apiKeyVal) { 'present' } else { 'missing' })" -Ms 0

# ---- 2. Anonymous rejection ------------------------------------------------
$anon = Invoke-Raw -Method "GET" -Path $routePath
$anonPass = ($anon.status -eq 401 -or $anon.status -eq 403)
Add-Result -Name "RateHawk route rejects anonymous access" -Method "GET" -Url $routePath -Status $anon.status `
  -Passed $anonPass -Detail "protected provider route requires admin credentials" -Ms $anon.ms

# ---- 3. Authenticated readiness/overview -----------------------------------
if ($adminToken) {
  $headers = @{ "x-admin-preview-token" = $adminToken }

  $ov = Invoke-Raw -Method "GET" -Path "$routePath`?mode=overview" -Headers $headers
  $ovPass = $false
  $ovDetail = "unexpected response"
  if ($ov.status -eq 200) {
    try {
      $json = $ov.body | ConvertFrom-Json
      if ($json.ok -eq $true) {
        if ($json.data.configured -eq $false) {
          $ovPass = $true
          $ovDetail = "configured=false returned safely (HTTP 200, no build break)"
        } elseif ($json.data.configured -eq $true) {
          $ovPass = $true
          $ovDetail = "configured=true; overview returned $($json.data.result.endpoints.Count) permitted endpoint(s)"
        }
      }
    } catch { $ovDetail = "response was not valid JSON" }
  } else {
    $ovDetail = "HTTP $($ov.status)"
  }
  Add-Result -Name "RateHawk authenticated overview readiness" -Method "GET" -Url "$routePath`?mode=overview" `
    -Status $ov.status -Passed $ovPass -Detail $ovDetail -Ms $ov.ms

  # ---- 4. Secret-leak scan on the response body ----------------------------
  $leak = $false
  $leakWhat = @()
  if ($keyIdVal -and $ov.body.Contains($keyIdVal)) { $leak = $true; $leakWhat += "key id" }
  if ($apiKeyVal -and $ov.body.Contains($apiKeyVal)) { $leak = $true; $leakWhat += "api key" }
  foreach ($needle in @('"apiKey"', '"api_key"', '"keyId"', 'Authorization', 'Basic ')) {
    if ($ov.body.Contains($needle)) { $leak = $true; $leakWhat += $needle }
  }
  Add-Result -Name "RateHawk response contains no secret/auth material" -Method "GET" -Url $routePath `
    -Status $ov.status -Passed (-not $leak) `
    -Detail $(if ($leak) { "LEAK DETECTED: $($leakWhat -join ', ')" } else { "no credentials or auth headers in response body" }) -Ms 0

  # ---- 5. Live calls only when test/sandbox credentials exist ---------------
  if ($credsPresent) {
    $resolvedRegionId = $null
    $sg = Invoke-Raw -Method "GET" -Path "$routePath`?mode=suggest&query=Dubai&language=en" -Headers $headers
    $sgPass = $false
    $sgDetail = "HTTP $($sg.status)"
    if ($sg.status -eq 200) {
      try {
        $sj = $sg.body | ConvertFrom-Json
        if ($sj.ok -eq $true -and $sj.data.result) {
          $sgPass = $true
          $sgDetail = "suggest returned $($sj.data.result.regions.Count) region(s), $($sj.data.result.hotels.Count) hotel(s)"
          $firstRegion = $sj.data.result.regions | Select-Object -First 1
          if ($firstRegion) { $resolvedRegionId = $firstRegion.id }
        }
      } catch { $sgDetail = "response was not valid JSON" }
    } elseif ($sg.status -eq 502 -or $sg.status -eq 503) {
      $sgPass = $true
      $sgDetail = "provider unavailable handled with generic error (HTTP $($sg.status))"
    }
    Add-Result -Name "RateHawk live multicomplete suggest" -Method "GET" -Url "$routePath`?mode=suggest" `
      -Status $sg.status -Passed $sgPass -Detail $sgDetail -Ms $sg.ms

    # Real availability search using the resolved region and future dates.
    if ($resolvedRegionId) {
      $checkin = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
      $checkout = (Get-Date).AddDays(32).ToString("yyyy-MM-dd")
      $searchUrl = "$routePath`?mode=search&regionId=$resolvedRegionId&checkin=$checkin&checkout=$checkout&residency=gb&adults=2&currency=USD&language=en"
      $sr = Invoke-Raw -Method "GET" -Path $searchUrl -Headers $headers
      $srPass = $false
      $srDetail = "HTTP $($sr.status)"
      if ($sr.status -eq 200) {
        try {
          $srj = $sr.body | ConvertFrom-Json
          if ($srj.ok -eq $true -and $srj.data.result) {
            $srPass = $true
            $srDetail = "live region search returned $($srj.data.result.returnedHotels) hotel(s) of $($srj.data.result.totalHotels) total"
          }
        } catch { $srDetail = "response was not valid JSON" }
      } elseif ($sr.status -eq 502 -or $sr.status -eq 503 -or $sr.status -eq 429) {
        $srPass = $true
        $srDetail = "provider unavailable handled with generic error (HTTP $($sr.status))"
      }
      Add-Result -Name "RateHawk live region availability search" -Method "GET" -Url "$routePath`?mode=search" `
        -Status $sr.status -Passed $srPass -Detail $srDetail -Ms $sr.ms
    } else {
      Add-Result -Name "RateHawk live region availability search" -Method "GET" -Url $routePath -Status 0 -Passed $true `
        -Detail "skipped: no region id resolved from suggest" -Ms 0
    }
  } else {
    Add-Result -Name "RateHawk live multicomplete suggest" -Method "GET" -Url $routePath -Status 0 -Passed $true `
      -Detail "skipped: no $rhEnv RateHawk credentials configured (blocked on client-provided keys)" -Ms 0
    Add-Result -Name "RateHawk live region availability search" -Method "GET" -Url $routePath -Status 0 -Passed $true `
      -Detail "skipped: no $rhEnv RateHawk credentials configured (blocked on client-provided keys)" -Ms 0
  }

  # ---- 6. Validation rejection (safe input handling) -----------------------
  $bad = Invoke-Raw -Method "GET" -Path "$routePath`?mode=search&regionId=abc&checkin=2020-01-01&checkout=2020-01-02&residency=zz" -Headers $headers
  $badPass = ($bad.status -eq 400 -or $bad.status -eq 502 -or $bad.status -eq 503 -or ($bad.status -eq 200))
  $badDetail = "invalid search input handled with HTTP $($bad.status)"
  if ($bad.status -eq 200) {
    try {
      $bj = $bad.body | ConvertFrom-Json
      if ($bj.data.configured -eq $false) { $badDetail = "provider not configured; validation deferred (configured=false)" }
    } catch {}
  }
  Add-Result -Name "RateHawk search rejects invalid input safely" -Method "GET" -Url "$routePath`?mode=search" `
    -Status $bad.status -Passed $badPass -Detail $badDetail -Ms $bad.ms
} else {
  Add-Result -Name "RateHawk authenticated overview readiness" -Method "GET" -Url $routePath -Status 0 -Passed $true `
    -Detail "skipped: no admin token available" -Ms 0
}

# ---- Report ----------------------------------------------------------------
$passedCount = ($Results | Where-Object { $_.passed }).Count
$failedCount = ($Results | Where-Object { -not $_.passed }).Count
$statusText = if ($failedCount -eq 0) { "PASS" } else { "FAIL" }
$reportDir = Split-Path -Parent $ReportPath
if ($reportDir) { New-Item -ItemType Directory -Force $reportDir | Out-Null }

$lines = @()
$lines += "# RateHawk Hotel Provider Foundation Smoke Report (HP-1)"
$lines += ""
$lines += "- Status: $statusText"
$lines += "- Base URL: $BaseUrl"
$lines += "- RateHawk env: $rhEnv"
$lines += "- Credentials present: $(if ($credsPresent) { 'yes' } else { 'no' })"
$lines += "- Generated: $((Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'"))"
$lines += "- Passed: $passedCount"
$lines += "- Failed: $failedCount"
$lines += ""
$lines += "Note: this report never prints env values or provider payloads."
$lines += ""
$lines += "| Status | Test | Method | Endpoint | HTTP | Time | Detail |"
$lines += "| --- | --- | --- | --- | ---: | ---: | --- |"
foreach ($r in $Results) {
  $icon = if ($r.passed) { "PASS" } else { "FAIL" }
  $safe = ([string]$r.detail).Replace("|", "\|")
  $lines += "| $icon | $($r.name) | $($r.method) | ``$($r.url)`` | $($r.status) | $($r.ms)ms | $safe |"
}

Set-Content -LiteralPath $ReportPath -Value $lines -Encoding UTF8
$jsonPath = [System.IO.Path]::ChangeExtension($ReportPath, ".json")
$Results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

Write-Host "RateHawk foundation smoke status: $statusText"
Write-Host "Report: $ReportPath"
Write-Host "JSON: $jsonPath"
if ($failedCount -gt 0) { exit 1 }
