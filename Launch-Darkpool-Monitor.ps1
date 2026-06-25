# Darkpool Monitor Launcher
# Starts the installed package or source checkout with first-run dependency repair.
# Source checkouts can pass -InstallDeps to force Python and npm dependency refresh.

param(
    [int]$BackendPort = 8002,
    [int]$FrontendPort = 3002,
    [switch]$NoBrowser,
    [switch]$InstallDeps,
    [switch]$SmokeTest
)

$ErrorActionPreference = "Stop"
$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $ProjectRoot) { $ProjectRoot = (Get-Location).Path }

$DesktopPath = [Environment]::GetFolderPath("Desktop")
if (-not $DesktopPath) { $DesktopPath = Join-Path $HOME "Desktop" }
$LogPath = $DesktopPath
$LogFile = Join-Path $LogPath "Darkpool-Monitor.log"
$TranscriptFile = Join-Path $LogPath "Darkpool-Monitor-Transcript.log"
$TranscriptStarted = $false
$OwnedProcesses = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$VcRedistUrl = "https://aka.ms/vc14/vc_redist.x64.exe"
$DependencyRoot = if ($env:LOCALAPPDATA) {
    Join-Path $env:LOCALAPPDATA "Darkpool Monitor\dependencies"
} else {
    Join-Path $ProjectRoot ".dependencies"
}

function Write-Status {
    param([string]$Message, [string]$Level = "INFO")
    $color = switch ($Level) {
        "OK" { "Green" }
        "WARN" { "Yellow" }
        "ERROR" { "Red" }
        default { "Cyan" }
    }
    Write-Host "[$Level] $Message" -ForegroundColor $color
    if (Test-Path $LogPath) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
        Add-Content -Path $LogFile -Value "$timestamp [$Level] $Message" -Encoding UTF8
    }
}

function Join-ProcessArguments {
    param([string[]]$Arguments)

    return (($Arguments | ForEach-Object {
        $arg = $_
        if ([string]::IsNullOrEmpty($arg)) {
            '""'
        } elseif ($arg -match '[\s"]') {
            '"' + $arg.Replace('"', '\"') + '"'
        } else {
            $arg
        }
    }) -join " ")
}

function Test-PortOpen {
    param([int]$Port)
    try {
        $client = New-Object Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(750, $false)
        if ($connected) { $client.EndConnect($async) }
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

function Wait-Port {
    param([int]$Port, [int]$Seconds = 30)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortOpen -Port $Port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Test-DarkpoolHealth {
    param([int]$Port)
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -Method Get -TimeoutSec 3
        return ($health.status -eq "healthy")
    } catch {
        return $false
    }
}

function Wait-DarkpoolHealth {
    param([int]$Port, [int]$Seconds = 45)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-DarkpoolHealth -Port $Port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Test-VcRuntimeInstalled {
    $keys = @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    )

    foreach ($key in $keys) {
        try {
            $runtime = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
            if ($runtime -and $runtime.Installed -eq 1) { return $true }
        } catch {
        }
    }
    return $false
}

function Invoke-DependencyDownload {
    param(
        [string]$Url,
        [string]$OutFile,
        [string]$Label
    )

    New-Item -ItemType Directory -Path (Split-Path -Parent $OutFile) -Force | Out-Null
    if (Test-Path -LiteralPath $OutFile) {
        Write-Status "$Label already downloaded"
        return $OutFile
    }

    Write-Status "Downloading $Label"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    } catch {
    }
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 180
    return $OutFile
}

function Ensure-InstalledRuntimeDependencies {
    if (Test-VcRuntimeInstalled) {
        Write-Status "Microsoft Visual C++ Runtime is installed" "OK"
        return
    }

    Write-Status "Microsoft Visual C++ Runtime was not found; installing it automatically" "WARN"
    $installer = Join-Path $DependencyRoot "vc_redist.x64.exe"
    Invoke-DependencyDownload -Url $VcRedistUrl -OutFile $installer -Label "Microsoft Visual C++ Runtime" | Out-Null
    $process = Start-Process -FilePath $installer -ArgumentList "/install", "/quiet", "/norestart" -Wait -PassThru
    if (-not (@(0, 3010, 1638) -contains $process.ExitCode)) {
        Write-Status "Microsoft Visual C++ Runtime installer exited with code $($process.ExitCode). Darkpool Monitor will continue and report any startup error." "WARN"
    }
}

function Find-SystemPython {
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) { return @($py.Source, "-3.11") }

    foreach ($name in @("python.exe", "python")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return @($cmd.Source) }
    }
    return @()
}

function Invoke-Python {
    param([string[]]$Arguments)
    $python = Find-SystemPython
    if ($python.Count -eq 0) {
        throw "Python was not found. Install Python 3.11+ or use the DarkpoolMonitor-Setup installer."
    }
    $file = $python[0]
    $prefix = @()
    if ($python.Count -gt 1) { $prefix = @($python[1..($python.Count - 1)]) }
    & $file @prefix @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed with code $LASTEXITCODE"
    }
}

function Ensure-SourcePythonDependencies {
    $venvPath = Join-Path $ProjectRoot ".venv"
    $venvPython = Join-Path $venvPath "Scripts\python.exe"
    $requirements = Join-Path $ProjectRoot "requirements.txt"

    if (-not (Test-Path -LiteralPath $venvPython)) {
        Write-Status "Creating Python virtual environment with python -m venv"
        Invoke-Python -Arguments @("-m", "venv", $venvPath)
    }

    if ($InstallDeps -or -not (Test-Path -LiteralPath (Join-Path $venvPath ".darkpool-deps-installed"))) {
        Write-Status "Installing Python dependencies from requirements.txt"
        & $venvPython -m pip install --upgrade pip
        if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed with code $LASTEXITCODE" }
        & $venvPython -m pip install -r $requirements
        if ($LASTEXITCODE -ne 0) { throw "pip install failed with code $LASTEXITCODE" }
        New-Item -ItemType File -Path (Join-Path $venvPath ".darkpool-deps-installed") -Force | Out-Null
    }

    return $venvPython
}

function Find-Npm {
    foreach ($name in @("npm.cmd", "npm.exe", "npm")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

function Ensure-SourceFrontendDependencies {
    $npm = Find-Npm
    if (-not $npm) {
        throw "npm was not found. Install Node.js 20+ or use the DarkpoolMonitor-Setup installer."
    }

    $nodeModules = Join-Path $ProjectRoot "node_modules"
    if ($InstallDeps -or -not (Test-Path -LiteralPath $nodeModules)) {
        Write-Status "Installing frontend dependencies with npm install"
        & $npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed with code $LASTEXITCODE" }
    }
    return $npm
}

function Start-OwnedProcess {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory
    )

    $startParams = @{
        FilePath = $FilePath
        WorkingDirectory = $WorkingDirectory
        PassThru = $true
        WindowStyle = "Hidden"
    }
    if ($ArgumentList -and $ArgumentList.Count -gt 0) {
        $startParams.ArgumentList = Join-ProcessArguments -Arguments $ArgumentList
    }
    $process = Start-Process @startParams
    $OwnedProcesses.Add($process)
    return $process
}

function Stop-ProcessTree {
    param([int]$ProcessId)
    try {
        $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
        foreach ($child in $children) {
            Stop-ProcessTree -ProcessId $child.ProcessId
        }
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    } catch {
    }
}

function Stop-OwnedProcesses {
    for ($i = $OwnedProcesses.Count - 1; $i -ge 0; $i--) {
        Stop-ProcessTree -ProcessId $OwnedProcesses[$i].Id
    }
}

function Start-InstalledDarkpoolMonitor {
    $exe = Join-Path $ProjectRoot "DarkpoolMonitor.exe"
    if (-not (Test-Path -LiteralPath $exe)) {
        throw "DarkpoolMonitor.exe was not found in $ProjectRoot. Reinstall with DarkpoolMonitor-Setup."
    }

    Ensure-InstalledRuntimeDependencies
    if (Test-PortOpen -Port $BackendPort) {
        if (Test-DarkpoolHealth -Port $BackendPort) {
            Write-Status "Darkpool Monitor is already running on port $BackendPort" "OK"
            return
        }
        throw "Port $BackendPort is already in use by another service."
    }

    $env:PORT = "$BackendPort"
    $env:DARKPOOL_HOST = "127.0.0.1"
    Write-Status "Starting DarkpoolMonitor.exe on port $BackendPort"
    Start-OwnedProcess -FilePath $exe -ArgumentList @() -WorkingDirectory $ProjectRoot | Out-Null
    if (-not (Wait-Port -Port $BackendPort -Seconds 30)) {
        throw "Darkpool Monitor did not open port $BackendPort. Check $LogFile."
    }
    if (-not (Wait-DarkpoolHealth -Port $BackendPort -Seconds 45)) {
        throw "Darkpool Monitor opened port $BackendPort, but /health did not become healthy. Check $LogFile."
    }
    Write-Status "Darkpool Monitor is ready on port $BackendPort" "OK"
}

function Start-SourceDarkpoolMonitor {
    $python = Ensure-SourcePythonDependencies
    $npm = Ensure-SourceFrontendDependencies

    if (Test-PortOpen -Port $BackendPort) {
        if (-not (Test-DarkpoolHealth -Port $BackendPort)) {
            throw "Backend port $BackendPort is already in use by another service."
        }
    } else {
        $env:PORT = "$BackendPort"
        Write-Status "Starting source backend on port $BackendPort"
        Start-OwnedProcess -FilePath $python -ArgumentList @("-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "$BackendPort") -WorkingDirectory $ProjectRoot | Out-Null
        if (-not (Wait-DarkpoolHealth -Port $BackendPort -Seconds 45)) {
            throw "Source backend did not become healthy on port $BackendPort. Check $LogFile."
        }
    }

    if (Test-PortOpen -Port $FrontendPort) {
        Write-Status "Frontend port $FrontendPort is already in use; reusing it" "WARN"
    } else {
        $env:VITE_BACKEND_URL = "http://127.0.0.1:$BackendPort"
        Write-Status "Starting source frontend on port $FrontendPort"
        Start-OwnedProcess -FilePath $npm -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$FrontendPort") -WorkingDirectory $ProjectRoot | Out-Null
        if (-not (Wait-Port -Port $FrontendPort -Seconds 45)) {
            throw "Source frontend did not open port $FrontendPort. Check $LogFile."
        }
    }
}

if ($SmokeTest) {
    Write-Status "Running launcher smoke test (-SmokeTest)"
    $quoted = Join-ProcessArguments -Arguments @("--log", "C:\Users\Lite OS\Desktop\Darkpool-Monitor.log")
    if (-not $quoted.Contains('"C:\Users\Lite OS\Desktop\Darkpool-Monitor.log"')) {
        throw "Argument quoting smoke test failed."
    }
    if (-not (Get-Command Start-Process -ErrorAction SilentlyContinue)) {
        throw "Start-Process is unavailable."
    }
    Write-Status "Launcher smoke test passed" "OK"
    exit 0
}

try {
    New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
    try {
        Start-Transcript -Path $TranscriptFile -Append | Out-Null
        $TranscriptStarted = $true
    } catch {
        $TranscriptStarted = $false
    }

    $installedExe = Join-Path $ProjectRoot "DarkpoolMonitor.exe"
    $isInstalled = Test-Path -LiteralPath $installedExe

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    if ($isInstalled) {
        Write-Host "  Darkpool Monitor - Installed App" -ForegroundColor Cyan
    } else {
        Write-Host "  Darkpool Monitor - Local Source" -ForegroundColor Cyan
    }
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Status "Project root: $ProjectRoot"
    Write-Status "App log: $LogFile"

    if ($isInstalled) {
        Start-InstalledDarkpoolMonitor
        $url = "http://127.0.0.1:$BackendPort/app/"
    } else {
        Start-SourceDarkpoolMonitor
        $url = "http://127.0.0.1:$FrontendPort"
    }

    if (-not $NoBrowser) {
        Start-Process $url | Out-Null
    }

    Write-Host ""
    Write-Host "Ready: $url" -ForegroundColor Green
    Write-Host "Close this window or press Ctrl+C to stop processes started by this launcher." -ForegroundColor Gray
    Write-Host ""

    while ($true) {
        foreach ($process in @($OwnedProcesses)) {
            if ($process.HasExited) {
                throw "Process $($process.Id) exited unexpectedly."
            }
        }
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Status $_.Exception.Message "ERROR"
    exit 1
} finally {
    Stop-OwnedProcesses
    if ($TranscriptStarted) {
        try { Stop-Transcript | Out-Null } catch {}
    }
}
