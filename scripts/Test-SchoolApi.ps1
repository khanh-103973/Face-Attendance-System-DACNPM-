$ErrorActionPreference = 'Stop'
$secret = Read-Host 'Admin LOGIN password (not database password)' -AsSecureString
$student = $null
$class = $null
$headers = $null
$baseUrl = 'http://127.0.0.1:8080/api'
try {
    $plain = [System.Net.NetworkCredential]::new('', $secret).Password
    $body = @{ username = 'admin'; password = $plain } | ConvertTo-Json -Compress
    $login = Invoke-RestMethod "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body $body
    $headers = @{ Authorization = "Bearer $($login.access_token)" }
    $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 12).ToUpperInvariant()
    $studentInput = @{ studentCode = "TEST_$suffix"; fullName = 'Temporary API Test Student' } | ConvertTo-Json
    $student = Invoke-RestMethod "$baseUrl/students" -Method Post -Headers $headers -ContentType 'application/json' -Body $studentInput
    $classInput = @{ classCode = "TEST_$suffix"; name = 'Temporary API Test Class' } | ConvertTo-Json
    $class = Invoke-RestMethod "$baseUrl/classes" -Method Post -Headers $headers -ContentType 'application/json' -Body $classInput
    Invoke-RestMethod "$baseUrl/classes/$($class.id)/students/$($student.id)" -Method Put -Headers $headers | Out-Null
    # Repeating membership must not add duplicate rows.
    Invoke-RestMethod "$baseUrl/classes/$($class.id)/students/$($student.id)" -Method Put -Headers $headers | Out-Null
    $members = Invoke-RestMethod "$baseUrl/classes/$($class.id)/students" -Headers $headers
    if ($members.totalElements -ne 1 -or $members.items[0].id -ne $student.id) {
        throw 'Class membership did not match expected student.'
    }
    $update = @{ fullName = 'Updated Temporary API Test Student' } | ConvertTo-Json
    $updated = Invoke-RestMethod "$baseUrl/students/$($student.id)" -Method Put -Headers $headers -ContentType 'application/json' -Body $update
    if ($updated.fullName -ne 'Updated Temporary API Test Student') { throw 'Student update failed.' }
    Write-Host 'PASS: create student/class, enroll without duplicates, list members, update student.'
} finally {
    # Only delete records successfully created by this invocation.
    if ($headers -and $student -and $class) {
        try { Invoke-RestMethod "$baseUrl/classes/$($class.id)/students/$($student.id)" -Method Delete -Headers $headers | Out-Null }
        catch { Write-Warning "Could not remove test membership; inspect test class ID $($class.id)." }
    }
    if ($headers -and $student) {
        try { Invoke-RestMethod "$baseUrl/students/$($student.id)" -Method Delete -Headers $headers | Out-Null; Write-Host 'Temporary student removed.' }
        catch { Write-Warning "Could not remove temporary student ID $($student.id)." }
    }
    if ($headers -and $class) {
        try { Invoke-RestMethod "$baseUrl/classes/$($class.id)" -Method Delete -Headers $headers | Out-Null; Write-Host 'Temporary class removed.' }
        catch { Write-Warning "Could not remove temporary class ID $($class.id)." }
    }
    $secret.Dispose()
    $plain = $null
    $body = $null
    $headers = $null
    $login = $null
}
