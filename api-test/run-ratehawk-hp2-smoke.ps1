param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ReportPath = "api-test/reports/ratehawk-hp2-latest.md",
  [string]$AdminToken = ""
)

# Focused smoke for HP-2: live RateHawk hotel options wired into the public
# package option flow. Calls Fly Time routes only; never RateHawk directly;
# never prints env values or provider payloads. See dev/testing-contract.md.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$script:Results = @()

function Read-DotEnv {
  param([string]$Path)
  $map = @{}
  if (!(Test-Path -LiteralPath $Path)) { return $map }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') { $map[$matches[1].Trim()] = $matches[2].Trim().Trim('"') }
  }
  return $map
}

function Add-Result {
  param([string]$Name, [string]$Method, [string]$Url, [int]$Status, [bool]$Passed, [string]$Detail, [int]$Ms)
  $script:Results += [pscustomobject]@{
    name = $Name; method = $Method; url = $Url; status = $Status; passed = $Passed; detail = $Detail; ms = $Ms
  }
}

function Invoke-Raw {
  param([string]$Method = "GET", [string]$Path, [object]$Body, [hashtable]$Headers = @{})
  $url = "$BaseUrl$Path"
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($Method), $url)
  foreach ($h in $Headers.GetEnumerator()) { [void]$request.Headers.TryAddWithoutValidation($h.Key, [string]$h.Value) }
  if ($Body -ne $null) {
    $json = $Body | ConvertTo-Json -Depth 12
    $request.Content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, "application/json")
  }
  $response = $script:HttpClient.SendAsync($request).GetAwaiter().GetResult()
  $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $timer.Stop()
  return @{ status = [int]$response.StatusCode; body = $content; ms = [int]$timer.ElapsedMilliseconds }
}

function ConvertFrom-JsonSafe {
  param([string]$Text)
  try { return $Text | ConvertFrom-Json } catch { return $null }
}

$cookies = New-Object System.Net.CookieContainer
$script:HttpHandler = New-Object System.Net.Http.HttpClientHandler
$script:HttpHandler.CookieContainer = $cookies
$script:HttpHandler.UseCookies = $true
$script:HttpClient = New-Object System.Net.Http.HttpClient($script:HttpHandler)
$script:HttpClient.Timeout = [TimeSpan]::FromSeconds(60)

$envMap = Read-DotEnv ".env"
$adminToken = if ($AdminToken) { $AdminToken } else { $envMap["ADMIN_PREVIEW_TOKEN"] }
$rhEnv = if ($envMap["RATEHAWK_ENV"]) { $envMap["RATEHAWK_ENV"] } else { "test" }
$rhUpper = $rhEnv.ToUpper()
$credsPresent = [bool]($envMap["RATEHAWK_${rhUpper}_KEY_ID"] -and $envMap["RATEHAWK_${rhUpper}_API_KEY"])
$adminHeaders = @{ "x-admin-preview-token" = $adminToken }

# ---- 1. Discover a published hotel segment --------------------------------
$found = $null
$tripsRes = Invoke-Raw -Method "GET" -Path "/api/public/trips"
$tripsJson = ConvertFrom-JsonSafe $tripsRes.body
$destinations = @()
if ($tripsJson -and $tripsJson.ok -eq $true -and $tripsJson.data.destinations) {
  $destinations = $tripsJson.data.destinations
}

foreach ($dest in ($destinations | Select-Object -First 12)) {
  $dSlug = $dest.slug
  $dName = if ($dest.name) { $dest.name } else { $dest.slug }
  if (-not $dSlug) { continue }
  $packages = if ($dest.packages) { $dest.packages } elseif ($dest.trips) { $dest.trips } else { @() }

  foreach ($pkg in ($packages | Select-Object -First 8)) {
    $tSlug = $pkg.slug; if (-not $tSlug) { $tSlug = $pkg.tripSlug }
    if (-not $tSlug) { continue }

    $itinRes = Invoke-Raw -Method "GET" -Path "/api/public/trips/$dSlug/$tSlug/itinerary"
    $itinJson = ConvertFrom-JsonSafe $itinRes.body
    if (-not $itinJson -or $itinJson.ok -ne $true) { continue }
    $hotelSeg = $itinJson.data.segments | Where-Object { $_.type -eq "hotel" -and $_.isChangeable } | Select-Object -First 1
    if ($hotelSeg) {
      $found = @{ destinationSlug = $dSlug; destinationName = $dName; tripSlug = $tSlug; tripId = $itinJson.data.trip.id; segmentId = $hotelSeg.id }
      break
    }
  }
  if ($found) { break }
}

if (-not $found) {
  Add-Result -Name "Discover published hotel segment" -Method "GET" -Url "/api/public/trips" -Status $tripsRes.status -Passed $true `
    -Detail "skipped: no published changeable hotel segment found in current trips (configure one to test live wiring)" -Ms $tripsRes.ms
} else {
  Add-Result -Name "Discover published hotel segment" -Method "GET" -Url "/api/public/trips/*/itinerary" -Status 200 -Passed $true `
    -Detail "using destination=$($found.destinationSlug) trip=$($found.tripSlug)" -Ms 0

  $optBase = "/api/public/trips/$($found.destinationSlug)/$($found.tripSlug)/options"

  # ---- 2. Manual fallback works (no provider config yet) ------------------
  $manualRes = Invoke-Raw -Method "GET" -Path "$optBase`?type=hotel&segmentId=$($found.segmentId)&sort=price"
  $manualJson = ConvertFrom-JsonSafe $manualRes.body
  $manualOk = ($manualRes.status -eq 200 -and $manualJson -and $manualJson.ok -eq $true)
  $manualCount = if ($manualOk) { @($manualJson.data.options).Count } else { 0 }
  Add-Result -Name "Manual hotel options load (fallback)" -Method "GET" -Url $optBase -Status $manualRes.status -Passed $manualOk `
    -Detail "manual hotel options returned ok=$manualOk count=$manualCount" -Ms $manualRes.ms

  if ($adminToken -and $credsPresent) {
    # ---- 3. Resolve a live region via HP-1 admin route --------------------
    # Use the destination's own name so the live rates match the package locale.
    $regionQuery = [System.Uri]::EscapeDataString($found.destinationName)
    $sg = Invoke-Raw -Method "GET" -Path "/api/admin/providers/ratehawk/hotel-search-test?mode=suggest&query=$regionQuery&language=en" -Headers $adminHeaders
    $sgJson = ConvertFrom-JsonSafe $sg.body
    $regionId = $null
    if ($sgJson -and $sgJson.ok -eq $true -and $sgJson.data.result.regions) {
      $regionId = ($sgJson.data.result.regions | Select-Object -First 1).id
    }
    Add-Result -Name "Resolve live region id" -Method "GET" -Url "/api/admin/providers/ratehawk/hotel-search-test" -Status $sg.status `
      -Passed ([bool]$regionId) -Detail "resolved regionId=$regionId for '$($found.destinationName)'" -Ms $sg.ms

    if ($regionId) {
      $segPath = "/api/admin/trips/$($found.tripId)/segments/$($found.segmentId)"

      # ---- 4. Configure segment for hybrid live + manual -----------------
      $patch = Invoke-Raw -Method "PATCH" -Path $segPath -Headers $adminHeaders -Body @{
        metadata = @{ hotel_source = "hybrid"; ratehawk = @{ region_id = $regionId; nights = 2 } }
      }
      $patchJson = ConvertFrom-JsonSafe $patch.body
      Add-Result -Name "Set segment hotel_source=hybrid + region" -Method "PATCH" -Url $segPath -Status $patch.status `
        -Passed ($patch.status -eq 200 -and $patchJson.ok -eq $true) -Detail "segment metadata updated via admin API" -Ms $patch.ms

      # ---- 5. Live options appear, safe DTO, no leaked hashes ------------
      $liveRes = Invoke-Raw -Method "GET" -Path "$optBase`?type=hotel&segmentId=$($found.segmentId)&sort=price"
      $liveJson = ConvertFrom-JsonSafe $liveRes.body
      $liveOptions = @()
      if ($liveJson -and $liveJson.ok -eq $true) { $liveOptions = @($liveJson.data.options) }
      $liveOnes = $liveOptions | Where-Object { $_.isLive -eq $true }
      $liveCount = @($liveOnes).Count
      Add-Result -Name "Live hotel options returned" -Method "GET" -Url $optBase -Status $liveRes.status `
        -Passed ($liveRes.status -eq 200 -and $liveCount -ge 1) -Detail "live options=$liveCount (hybrid total=$(@($liveOptions).Count))" -Ms $liveRes.ms

      $leak = $false; $leakWhat = @()
      foreach ($needle in @('search_hash','match_hash','payment_options','"apiKey"','"api_key"','Authorization','Basic ')) {
        if ($liveRes.body -and $liveRes.body.Contains($needle)) { $leak = $true; $leakWhat += $needle }
      }
      Add-Result -Name "Live options contain no provider hashes/secrets" -Method "GET" -Url $optBase -Status $liveRes.status `
        -Passed (-not $leak) -Detail $(if ($leak) { "LEAK: $($leakWhat -join ', ')" } else { "no search_hash/match_hash/auth/raw payload in response" }) -Ms 0

      # ---- 6. Select a live option --------------------------------------
      $liveOption = $liveOnes | Select-Object -First 1
      if ($liveOption) {
        $sel = Invoke-Raw -Method "POST" -Path "/api/public/trips/$($found.destinationSlug)/$($found.tripSlug)/selection" -Body @{
          segmentId = $found.segmentId; optionType = "hotel"; optionId = $liveOption.id; travelersCount = 2
        }
        $selJson = ConvertFrom-JsonSafe $sel.body
        Add-Result -Name "Select live hotel option" -Method "POST" -Url "/selection" -Status $sel.status `
          -Passed ($sel.status -eq 201 -and $selJson.ok -eq $true) -Detail "live option selected; session cookie set" -Ms $sel.ms

        # ---- 7. Booking attaches the selection session ------------------
        $book = Invoke-Raw -Method "POST" -Path "/api/bookings" -Body @{
          fullName = "API Smoke HP2 Tester"; email = "api-smoke-hp2@flytime.test"; phone = "+10000000000"
          destinationSlug = $found.destinationSlug; tripSlug = $found.tripSlug; travelersCount = 2
          message = "API Smoke HP-2 live hotel selection"
        }
        $bookJson = ConvertFrom-JsonSafe $book.body
        Add-Result -Name "Booking enquiry with live hotel session" -Method "POST" -Url "/api/bookings" -Status $book.status `
          -Passed ($book.status -eq 201 -and $bookJson.ok -eq $true) -Detail "enquiry created with option-session cookie attached" -Ms $book.ms
      } else {
        Add-Result -Name "Select live hotel option" -Method "POST" -Url "/selection" -Status 0 -Passed $true -Detail "skipped: no live option available to select" -Ms 0
        Add-Result -Name "Booking enquiry with live hotel session" -Method "POST" -Url "/api/bookings" -Status 0 -Passed $true -Detail "skipped: no live option selected" -Ms 0
      }

      # ---- 8. Unknown/expired option is not selectable ------------------
      $bad = Invoke-Raw -Method "POST" -Path "/api/public/trips/$($found.destinationSlug)/$($found.tripSlug)/selection" -Body @{
        segmentId = $found.segmentId; optionType = "hotel"; optionId = "00000000-0000-4000-8000-000000000999"; travelersCount = 2
      }
      Add-Result -Name "Unknown/expired hotel option rejected" -Method "POST" -Url "/selection" -Status $bad.status `
        -Passed ($bad.status -ge 400 -and $bad.status -lt 500) -Detail "unknown/expired provider option correctly rejected (HTTP $($bad.status))" -Ms $bad.ms

      # ---- 9. Revert segment to manual (cleanup) ------------------------
      $revert = Invoke-Raw -Method "PATCH" -Path $segPath -Headers $adminHeaders -Body @{ metadata = @{ hotel_source = "manual" } }
      Add-Result -Name "Revert segment to manual (cleanup)" -Method "PATCH" -Url $segPath -Status $revert.status `
        -Passed ($revert.status -eq 200) -Detail "segment reverted to manual source mode" -Ms $revert.ms
    }
  } else {
    Add-Result -Name "Live hotel options returned" -Method "GET" -Url $optBase -Status 0 -Passed $true `
      -Detail "skipped: admin token or RateHawk $rhEnv credentials missing" -Ms 0
  }
}

# ---- Report ----------------------------------------------------------------
$passedCount = ($Results | Where-Object { $_.passed }).Count
$failedCount = ($Results | Where-Object { -not $_.passed }).Count
$statusText = if ($failedCount -eq 0) { "PASS" } else { "FAIL" }
$reportDir = Split-Path -Parent $ReportPath
if ($reportDir) { New-Item -ItemType Directory -Force $reportDir | Out-Null }

$lines = @()
$lines += "# RateHawk HP-2 Hotel Option Wiring Smoke Report"
$lines += ""
$lines += "- Status: $statusText"
$lines += "- Base URL: $BaseUrl"
$lines += "- RateHawk env: $rhEnv"
$lines += "- Credentials present: $(if ($credsPresent) { 'yes' } else { 'no' })"
$lines += "- Generated: $((Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'"))"
$lines += "- Passed: $passedCount"
$lines += "- Failed: $failedCount"
$lines += ""
$lines += "Note: never prints env values, provider payloads, or internal hashes."
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

Write-Host "RateHawk HP-2 smoke status: $statusText"
Write-Host "Report: $ReportPath"
if ($failedCount -gt 0) { exit 1 }
