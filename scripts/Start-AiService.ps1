param([double]$Threshold = 0.5)
$ErrorActionPreference = 'Stop'
if ([double]::IsNaN($Threshold) -or $Threshold -lt -1 -or $Threshold -gt 1) { throw 'Threshold must be in [-1, 1].' }
$aiDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'ai-service'
$previousKey = $env:AI_API_KEY
$previousThreshold = $env:AI_THRESHOLD
try {
    $env:AI_API_KEY = & (Join-Path $PSScriptRoot 'Get-LocalAiKey.ps1')
    $env:AI_THRESHOLD = $Threshold.ToString([System.Globalization.CultureInfo]::InvariantCulture)
    Push-Location $aiDirectory
    try { & .\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000 }
    finally { Pop-Location }
} finally {
    $env:AI_API_KEY = $previousKey
    $env:AI_THRESHOLD = $previousThreshold
}
