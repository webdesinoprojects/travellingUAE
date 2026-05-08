param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ReportPath = "api-test/reports/latest.md",
  [switch]$SkipMutations
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

function Read-DotEnv {
  param([string]$Path)

  $map = @{}

  if (!(Test-Path -LiteralPath $Path)) {
    return $map
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"')
      $map[$key] = $value
    }
  }

  return $map
}

function Add-Result {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [int]$Status,
    [bool]$Passed,
    [string]$Detail,
    [int]$Ms
  )

  $script:Results += [pscustomobject]@{
    name = $Name
    method = $Method
    url = $Url
    status = $Status
    passed = $Passed
    detail = $Detail
    ms = $Ms
  }
}

function Invoke-JsonStep {
  param(
    [string]$Name,
    [string]$Method = "GET",
    [string]$Path,
    [object]$Body,
    [hashtable]$Headers = @{},
    [scriptblock]$Assert
  )

  $url = "$BaseUrl$Path"
  $timer = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($Method), $url)

    foreach ($header in $Headers.GetEnumerator()) {
      [void]$request.Headers.TryAddWithoutValidation($header.Key, [string]$header.Value)
    }

    if ($Body -ne $null) {
      $bodyJson = $Body | ConvertTo-Json -Depth 12
      $request.Content = New-Object System.Net.Http.StringContent($bodyJson, [System.Text.Encoding]::UTF8, "application/json")
    }

    $response = $script:HttpClient.SendAsync($request).GetAwaiter().GetResult()
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $timer.Stop()

    if (-not $response.IsSuccessStatusCode) {
      throw "HTTP $([int]$response.StatusCode): $content"
    }

    $json = $content | ConvertFrom-Json
    $detail = & $Assert $json

    Add-Result -Name $Name -Method $Method -Url $Path -Status ([int]$response.StatusCode) -Passed $true -Detail $detail -Ms $timer.ElapsedMilliseconds

    return @{
      json = $json
      response = $response
    }
  } catch {
    $timer.Stop()
    $status = 0
    $detail = $_.Exception.Message

    Add-Result -Name $Name -Method $Method -Url $Path -Status $status -Passed $false -Detail $detail -Ms $timer.ElapsedMilliseconds
    return $null
  }
}

function Assert-Ok {
  param($Json, [string]$Detail)

  if ($Json.ok -ne $true) {
    throw "Expected ok=true"
  }

  return $Detail
}

$BaseUrl = $BaseUrl.TrimEnd("/")
$envMap = Read-DotEnv ".env"
$adminToken = $envMap["ADMIN_PREVIEW_TOKEN"]
$script:Results = @()
$script:HttpHandler = New-Object System.Net.Http.HttpClientHandler
$script:HttpHandler.CookieContainer = New-Object System.Net.CookieContainer
$script:HttpClient = New-Object System.Net.Http.HttpClient($script:HttpHandler)

$list = Invoke-JsonStep `
  -Name "Public destinations list" `
  -Path "/api/public/trips" `
  -Assert {
    param($json)
    Assert-Ok $json "destinations=$($json.data.destinations.Count), total=$($json.data.total)"
  }

$destination = "armenia"
$trip = "yerevan-flexible-city-break"

$destinationStep = Invoke-JsonStep `
  -Name "Destination packages filter" `
  -Path "/api/public/trips/${destination}?sort=cheapest&minDuration=1&maxDuration=10&flights=with" `
  -Assert {
    param($json)
    Assert-Ok $json "packages=$($json.data.total), destination=$($json.data.destination.slug)"
  }

$detail = Invoke-JsonStep `
  -Name "Trip detail" `
  -Path "/api/public/trips/$destination/$trip" `
  -Assert {
    param($json)
    Assert-Ok $json "package=$($json.data.package.slug), recommended=$($json.data.recommended.Count)"
  }

$itinerary = Invoke-JsonStep `
  -Name "Booking itinerary" `
  -Path "/api/public/trips/$destination/$trip/itinerary" `
  -Assert {
    param($json)
    Assert-Ok $json "segments=$($json.data.segments.Count), trip=$($json.data.trip.slug)"
  }

$flightSegment = $null

if ($itinerary -and $itinerary.json.data.segments.Count -gt 0) {
  $flightSegment = $itinerary.json.data.segments | Where-Object { $_.type -eq "flight" } | Select-Object -First 1
}

$options = $null
$firstOption = $null

if ($flightSegment) {
  $options = Invoke-JsonStep `
    -Name "Flight options" `
    -Path "/api/public/trips/$destination/$trip/options?segmentId=$($flightSegment.id)&type=flight&sort=price" `
    -Assert {
      param($json)
      Assert-Ok $json "options=$($json.data.options.Count), segment=$($json.data.segment.id)"
    }

  if ($options -and $options.json.data.options.Count -gt 0) {
    $firstOption = $options.json.data.options | Select-Object -First 1
  }
} else {
  Add-Result -Name "Flight options" -Method "GET" -Url "/api/public/trips/$destination/$trip/options" -Status 0 -Passed $false -Detail "No flight segment found in itinerary response" -Ms 0
}

if (!$SkipMutations -and $flightSegment -and $firstOption) {
  Invoke-JsonStep `
    -Name "Select flight option" `
    -Method "POST" `
    -Path "/api/public/trips/$destination/$trip/selection" `
    -Body @{
      segmentId = $flightSegment.id
      optionType = "flight"
      optionId = $firstOption.id
      travelersCount = 2
    } `
    -Assert {
      param($json)
      Assert-Ok $json "selected=$($json.data.selected.id), totalDelta=$($json.data.totalDelta.label)"
    } | Out-Null

  $emailStamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  Invoke-JsonStep `
    -Name "Create booking linked to option session" `
    -Method "POST" `
    -Path "/api/bookings" `
    -Body @{
      tripSlug = $trip
      destinationSlug = $destination
      fullName = "API Smoke Tester"
      email = "api-smoke-$emailStamp@example.com"
      phone = "+966500000000"
      travelDate = "2026-05-27"
      travelersCount = 2
      message = "Automated API smoke test booking. Safe demo data."
    } `
    -Assert {
      param($json)
      Assert-Ok $json "booking accepted"
    } | Out-Null
} elseif ($SkipMutations) {
  Add-Result -Name "Select flight option" -Method "POST" -Url "/api/public/trips/$destination/$trip/selection" -Status 0 -Passed $true -Detail "skipped by -SkipMutations" -Ms 0
  Add-Result -Name "Create booking linked to option session" -Method "POST" -Url "/api/bookings" -Status 0 -Passed $true -Detail "skipped by -SkipMutations" -Ms 0
}

if ($adminToken) {
  $adminHeaders = @{ "x-admin-preview-token" = $adminToken }

  Invoke-JsonStep `
    -Name "Admin dashboard preview" `
    -Path "/api/admin/dashboard" `
    -Headers $adminHeaders `
    -Assert {
      param($json)
      Assert-Ok $json "metrics=$($json.data.metrics.Count), bookings=$($json.data.bookings.Count)"
    } | Out-Null

  Invoke-JsonStep `
    -Name "Admin trips resource preview" `
    -Path "/api/admin/resources/trips" `
    -Headers $adminHeaders `
    -Assert {
      param($json)
      Assert-Ok $json "rows=$($json.data.rows.Count)"
    } | Out-Null
} else {
  Add-Result -Name "Admin dashboard preview" -Method "GET" -Url "/api/admin/dashboard" -Status 0 -Passed $true -Detail "skipped because ADMIN_PREVIEW_TOKEN is not set" -Ms 0
  Add-Result -Name "Admin trips resource preview" -Method "GET" -Url "/api/admin/resources/trips" -Status 0 -Passed $true -Detail "skipped because ADMIN_PREVIEW_TOKEN is not set" -Ms 0
}

$passedCount = ($Results | Where-Object { $_.passed }).Count
$failedCount = ($Results | Where-Object { -not $_.passed }).Count
$statusText = if ($failedCount -eq 0) { "PASS" } else { "FAIL" }
$reportDir = Split-Path -Parent $ReportPath

if ($reportDir) {
  New-Item -ItemType Directory -Force $reportDir | Out-Null
}

$lines = @()
$lines += "# Fly Time API Smoke Report"
$lines += ""
$lines += "- Status: $statusText"
$lines += "- Base URL: $BaseUrl"
$lines += "- Generated: $((Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'"))"
$lines += "- Passed: $passedCount"
$lines += "- Failed: $failedCount"
$lines += "- Mutations: $(if ($SkipMutations) { "skipped" } else { "enabled" })"
$lines += ""
$lines += "| Status | Test | Method | Endpoint | HTTP | Time | Detail |"
$lines += "| --- | --- | --- | --- | ---: | ---: | --- |"

foreach ($result in $Results) {
  $icon = if ($result.passed) { "PASS" } else { "FAIL" }
  $safeDetail = [string]$result.detail
  $safeDetail = $safeDetail.Replace("|", "\|")
  $endpoint = $result.url
  $lines += "| $icon | $($result.name) | $($result.method) | ``$endpoint`` | $($result.status) | $($result.ms)ms | $safeDetail |"
}

Set-Content -LiteralPath $ReportPath -Value $lines -Encoding UTF8
$jsonPath = [System.IO.Path]::ChangeExtension($ReportPath, ".json")
$Results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

Write-Host "API smoke test status: $statusText"
Write-Host "Report: $ReportPath"
Write-Host "JSON: $jsonPath"

if ($failedCount -gt 0) {
  exit 1
}
