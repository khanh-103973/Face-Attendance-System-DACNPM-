# Internal helper: callers capture the output; do not print or share this value.
$ErrorActionPreference = 'Stop'
$directory = Join-Path (Split-Path -Parent $PSScriptRoot) '.secrets'
$file = Join-Path $directory 'ai-service.key'
if (-not (Test-Path -LiteralPath $file)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    [System.IO.File]::WriteAllText($file, [Convert]::ToBase64String($bytes))
}
[System.IO.File]::ReadAllText($file).Trim()
