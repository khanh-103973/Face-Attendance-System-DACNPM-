param([ValidateSet('Prepare', 'Show', 'Close')][string]$Action = 'Prepare')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $root '.tools\attendance-demo.json'
$secret = Read-Host 'Admin LOGIN password (not database password)' -AsSecureString
$headers = $null
try {
    $plain = [System.Net.NetworkCredential]::new('', $secret).Password
    $body = @{ username = 'admin'; password = $plain } | ConvertTo-Json -Compress
    $login = Invoke-RestMethod 'http://127.0.0.1:8080/api/auth/login' -Method Post -ContentType 'application/json' -Body $body
    $headers = @{ Authorization = "Bearer $($login.access_token)" }
    $base = 'http://127.0.0.1:8080/api'
    if ($Action -eq 'Prepare') {
        if (Test-Path -LiteralPath $stateFile) {
            $saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            Write-Host "Existing demo session: $($saved.sessionId). Use -Action Show or -Action Close. Nothing created."
            return
        }
        $student = $null
        $page = 0
        do {
            $list = Invoke-RestMethod "$base/students?page=$page&size=100" -Headers $headers
            $student = $list.items | Where-Object { $_.studentCode -eq 'SV001' } | Select-Object -First 1
            $page++
        } while (-not $student -and ($page * 100) -lt $list.totalElements)
        if (-not $student) {
            $name = Read-Host 'Display name for your registered student SV001'
            if ([string]::IsNullOrWhiteSpace($name)) { throw 'A display name is required.' }
            $inputJson = @{ studentCode = 'SV001'; fullName = $name } | ConvertTo-Json -Compress
            $student = Invoke-RestMethod "$base/students" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($inputJson))
        }
        $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 10).ToUpperInvariant()
        $inputJson = @{ classCode = "DEMO_$suffix"; name = 'Local Attendance Demo' } | ConvertTo-Json -Compress
        $class = Invoke-RestMethod "$base/classes" -Method Post -Headers $headers -ContentType 'application/json' -Body $inputJson
        # Save partial progress so failures do not silently create repeated demo classes.
        $state = @{ studentId = $student.id; classId = $class.id; sessionId = $null }
        $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
        Invoke-RestMethod "$base/classes/$($class.id)/students/$($student.id)" -Method Put -Headers $headers | Out-Null
        $inputJson = @{ classId = $class.id; title = 'Local webcam attendance demo'; lateAfterMinutes = 15 } | ConvertTo-Json -Compress
        $session = Invoke-RestMethod "$base/attendance-sessions" -Method Post -Headers $headers -ContentType 'application/json' -Body $inputJson
        $state.sessionId = $session.id
        $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
        Write-Host "Prepared class $($class.id), student SV001, attendance session $($session.id). Demo data is retained."
        Write-Host "Run: .\ai-service\.venv\Scripts\python.exe .\ai-service\attendance_webcam.py --session-id $($session.id) --consent"
    } else {
        if (-not (Test-Path -LiteralPath $stateFile)) { throw 'Run Prepare first.' }
        $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        if (-not $state.sessionId) { throw "Preparation incomplete for class $($state.classId). Inspect it before retrying; no data deleted." }
        if ($Action -eq 'Close') {
            Invoke-RestMethod "$base/attendance-sessions/$($state.sessionId)/close" -Method Post -Headers $headers
        }
        $session = Invoke-RestMethod "$base/attendance-sessions/$($state.sessionId)" -Headers $headers
        $session | Format-List
        $page = 0
        do {
            $records = Invoke-RestMethod "$base/attendance-sessions/$($state.sessionId)/records?page=$page&size=100" -Headers $headers
            $records.items | Format-Table id, studentCode, status, recordedAt, cosine
            $page++
        } while (($page * 100) -lt $records.totalElements)
        Write-Host "Total attendance records: $($records.totalElements)"
    }
} finally {
    $secret.Dispose()
    $plain = $null
    $body = $null
    $login = $null
    $headers = $null
}
