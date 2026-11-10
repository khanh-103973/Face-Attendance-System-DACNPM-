$ErrorActionPreference = 'Stop'

function Add-UserPath([string]$Directory) {
    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($current -split ';' | Where-Object { $_ })
    if ($entries.TrimEnd('\') -notcontains $Directory.TrimEnd('\')) {
        [Environment]::SetEnvironmentVariable('Path', (($entries + $Directory) -join ';'), 'User')
    }
    if (($env:Path -split ';').TrimEnd('\') -notcontains $Directory.TrimEnd('\')) {
        $env:Path = "$Directory;$env:Path"
    }
}

$jdkCandidates = foreach ($directory in @(
    (Join-Path $env:USERPROFILE '.jdk'),
    'C:\Program Files\Eclipse Adoptium'
)) {
    if (Test-Path -LiteralPath $directory -ErrorAction SilentlyContinue) {
        Get-ChildItem -LiteralPath $directory -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^jdk-(?:21|25)(?:\.|$)' }
    }
}
$jdk = $jdkCandidates |
    Sort-Object { [version](($_.Name -replace '^jdk-', '').Split('+')[0]) } -Descending |
    Select-Object -First 1
if ($jdk) {
    [Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk.FullName, 'User')
    $env:JAVA_HOME = $jdk.FullName
    Add-UserPath (Join-Path $jdk.FullName 'bin')
}

$projectDirectory = Split-Path -Parent $PSScriptRoot
$projectMaven = Join-Path $projectDirectory '.tools\apache-maven-3.10.0\bin\mvn.cmd'
$localDirectories = @(
    (Join-Path $env:USERPROFILE 'AppData\Local'),
    $env:LOCALAPPDATA
) | Select-Object -Unique
$mavenCommand = $null
if (Test-Path -LiteralPath $projectMaven) {
    $mavenCommand = $projectMaven
    Add-UserPath (Split-Path -Parent $projectMaven)
}
foreach ($localDirectory in $localDirectories) {
    if ($mavenCommand) { break }
    $candidate = Join-Path $localDirectory 'FaceAttendanceTools\apache-maven-3.10.0\bin\mvn.cmd'
    if (Test-Path -LiteralPath $candidate) {
        $mavenCommand = $candidate
        Add-UserPath (Split-Path -Parent $candidate)
        break
    }
}
if (-not $mavenCommand) {
    $existingMaven = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($existingMaven) { $mavenCommand = $existingMaven.Source }
}

$postgres = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+$' -and (Test-Path (Join-Path $_.FullName 'bin\psql.exe')) } |
    Sort-Object { [int]$_.Name } -Descending | Select-Object -First 1
if ($postgres) { Add-UserPath (Join-Path $postgres.FullName 'bin') }

if ($mavenCommand) {
    Write-Host "Maven: $mavenCommand"
    & $mavenCommand -version
} else { Write-Host 'Maven not found in the configured locations or PATH.' }
if ($postgres) {
    $postgresCommand = Join-Path $postgres.FullName 'bin\psql.exe'
    Write-Host "PostgreSQL: $postgresCommand"
    & $postgresCommand --version
} elseif (Get-Command psql -ErrorAction SilentlyContinue) { psql --version }
else { Write-Host 'PostgreSQL not found in the default installation directory or PATH.' }
