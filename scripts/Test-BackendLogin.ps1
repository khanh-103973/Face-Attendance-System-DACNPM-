param([string]$Username = 'admin')
$ErrorActionPreference = 'Stop'
$password = Read-Host "Login password for $Username (not the database password)" -AsSecureString
try {
    $plain = [System.Net.NetworkCredential]::new('', $password).Password
    $body = @{ username = $Username; password = $plain } | ConvertTo-Json -Compress
    $login = Invoke-RestMethod 'http://127.0.0.1:8080/api/auth/login' -Method Post -ContentType 'application/json' -Body $body
    $headers = @{ Authorization = "Bearer $($login.access_token)" }
    Write-Host "Login OK. Token expires in $($login.expires_in) seconds. Token not printed."
    Invoke-RestMethod 'http://127.0.0.1:8080/api/auth/me' -Headers $headers
    if ($Username -eq 'admin') {
        Invoke-RestMethod 'http://127.0.0.1:8080/api/admin/check' -Headers $headers
    }
} catch {
    Write-Host 'Login check failed. Verify server is running, admin was created, and login password is correct.'
    throw
} finally {
    $password.Dispose()
    $plain = $null
    $body = $null
    $login = $null
    $headers = $null
}
