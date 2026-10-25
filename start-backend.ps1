<#
.SYNOPSIS
    Reliable, targeted backend launcher for Hierarchical Syllabus Tracker on Windows 11.

.DESCRIPTION
    Supports Development mode with narrow source reload monitoring (--reload-dir backend/app)
    to prevent Windows WinError 1450 resource exhaustion, and Stable mode without file monitoring.
    Never indiscriminately terminates python.exe processes.

.PARAMETER Mode
    Execution mode: 'Development' (default, reload limited to backend/app) or 'Stable' (no reload).

.PARAMETER Port
    TCP port to bind (default: 8000).

.PARAMETER BindHost
    Local IP address to bind (default: 127.0.0.1).
#>

[CmdletBinding()]
param (
    [ValidateSet("Development", "Stable")]
    [string]$Mode = "Development",

    [int]$Port = 8000,

    [string]$BindHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

# 1. Resolve repository root
$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Syllabus Tracker Backend Runner ($Mode Mode)" -ForegroundColor Cyan
Write-Host "  Working Directory: $RepoRoot" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# 2. Locate Virtual Environment Python
$VenvPython = Join-Path $RepoRoot "backend\venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $PythonExe = $VenvPython
    Write-Host "[OK] Using virtual environment Python: $PythonExe" -ForegroundColor Green
} else {
    $PythonExe = (Get-Command python -ErrorAction SilentlyContinue)?.Source
    if (-not $PythonExe) {
        Write-Error "Could not find python.exe. Please ensure backend/venv or system Python is installed."
        exit 1
    }
    Write-Host "[WARN] Virtual environment not found at $VenvPython; using system Python: $PythonExe" -ForegroundColor Yellow
}

# 3. Check for Port Conflicts without indiscriminate taskkill
$ExistingConn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($ExistingConn) {
    $OccupyingPid = $ExistingConn.OwningProcess | Select-Object -First 1
    $ProcInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $OccupyingPid" -ErrorAction SilentlyContinue
    $ProcName = if ($ProcInfo) { $ProcInfo.Name } else { "Unknown" }
    $ProcCmd = if ($ProcInfo) { $ProcInfo.CommandLine } else { "N/A" }

    Write-Host "[WARN] Port $Port is currently in use by PID $OccupyingPid ($ProcName)!" -ForegroundColor Yellow
    Write-Host "       Command Line: $ProcCmd" -ForegroundColor DarkGray
    Write-Host "       To stop only this specific process if it is a stale backend instance, run:" -ForegroundColor Yellow
    Write-Host "       Stop-Process -Id $OccupyingPid -Force" -ForegroundColor White
    Write-Host "       (Antigravity policy prohibits killing all python.exe processes indiscriminately)" -ForegroundColor DarkGray
    exit 1
}

# 4. Launch Backend with Targeted Watch Scope
if ($Mode -eq "Development") {
    Write-Host "[START] Launching Uvicorn with restricted reload scope: backend/app" -ForegroundColor Cyan
    Write-Host "        Excludes backend/venv and node_modules to eliminate WinError 1450 file handle exhaustion." -ForegroundColor DarkGray
    
    & $PythonExe -m uvicorn backend.app.main:app `
        --host $BindHost `
        --port $Port `
        --reload `
        --reload-dir (Join-Path $RepoRoot "backend\app")
} else {
    Write-Host "[START] Launching Uvicorn in Stable execution mode (no reload)" -ForegroundColor Green
    
    & $PythonExe -m uvicorn backend.app.main:app `
        --host $BindHost `
        --port $Port
}

$ExitCode = $LASTEXITCODE
if ($ExitCode -ne 0) {
    Write-Host "[EXIT] Backend terminated with exit code $ExitCode" -ForegroundColor Red
}
exit $ExitCode
