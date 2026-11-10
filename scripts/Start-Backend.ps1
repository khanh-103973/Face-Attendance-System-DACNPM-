param([switch]$UseEnvironmentPassword, [switch]$CreateAdmin)

$ErrorActionPreference = 'Stop'
$backendDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend'
if (-not $env:JAVA_HOME) {
    $compiler = Get-Command javac.exe -ErrorAction Stop
    $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $compiler.Source)
}
$previousPassword = $env:DB_PASSWORD
$previousMavenHome = $env:MAVEN_USER_HOME
$previousJwtSecret = $env:JWT_SECRET_BASE64
$previousAdminPassword = $env:BOOTSTRAP_ADMIN_PASSWORD
$previousAiKey = $env:AI_API_KEY
try {
    $env:AI_API_KEY = & (Join-Path $PSScriptRoot 'Get-LocalAiKey.ps1')
    $secretDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) '.secrets'
    $keyFile = Join-Path $secretDirectory 'backend-jwt.key'
    if (-not (Test-Path -LiteralPath $keyFile)) {
        New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
        $randomBytes = New-Object byte[] 32
        $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($randomBytes) } finally { $generator.Dispose() }
        [System.IO.File]::WriteAllText($keyFile, [Convert]::ToBase64String($randomBytes))
    }
    $env:JWT_SECRET_BASE64 = [System.IO.File]::ReadAllText($keyFile).Trim()
    $env:BOOTSTRAP_ADMIN_PASSWORD = ''
    if ($CreateAdmin) {
        $adminSecret = Read-Host 'NEW admin login password (at least 10 characters)' -AsSecureString
        $adminConfirm = Read-Host 'Repeat admin login password' -AsSecureString
        try {
            $adminPlain = [System.Net.NetworkCredential]::new('', $adminSecret).Password
            $confirmPlain = [System.Net.NetworkCredential]::new('', $adminConfirm).Password
            if ($adminPlain -cne $confirmPlain) { throw 'Admin passwords do not match. Nothing started.' }
            if ($adminPlain.Length -lt 10 -or [System.Text.Encoding]::UTF8.GetByteCount($adminPlain) -gt 72) {
                throw 'Admin password needs at least 10 characters and at most 72 UTF-8 bytes.'
            }
            $env:BOOTSTRAP_ADMIN_PASSWORD = $adminPlain
        } finally {
            $adminSecret.Dispose()
            $adminConfirm.Dispose()
            $adminPlain = $null
            $confirmPlain = $null
        }
    }
    if (-not $env:MAVEN_USER_HOME) {
        $env:MAVEN_USER_HOME = Join-Path (Split-Path -Parent $PSScriptRoot) '.tools\maven-user'
    }
    if (-not $UseEnvironmentPassword) {
        $securePassword = Read-Host 'Password for attendance_app (not postgres)' -AsSecureString
        $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
        $securePassword.Dispose()
    } elseif (-not $env:DB_PASSWORD) {
        throw 'DB_PASSWORD is empty. Run without -UseEnvironmentPassword to enter it interactively.'
    }
    Push-Location $backendDirectory
    try {
        & .\mvnw.cmd '-Dmaven.repo.local=../.tools/m2' spring-boot:run
        if ($LASTEXITCODE -ne 0) { throw "Backend stopped with exit code $LASTEXITCODE" }
    } finally { Pop-Location }
} finally {
    $env:DB_PASSWORD = $previousPassword
    $env:MAVEN_USER_HOME = $previousMavenHome
    $env:JWT_SECRET_BASE64 = $previousJwtSecret
    $env:BOOTSTRAP_ADMIN_PASSWORD = $previousAdminPassword
    $env:AI_API_KEY = $previousAiKey
}
