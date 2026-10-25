<#
.SYNOPSIS
    Installs the production-grade global CLI launcher for Syllabus Tracker on Windows 11.

.DESCRIPTION
    Idempotent installer that:
    1. Resolves and validates the Syllabus Tracker repository root.
    2. Verifies backend virtual environment and frontend node_modules.
    3. Initializes %LOCALAPPDATA%\SyllabusTracker configuration, state, and logs directories.
    4. Creates %USERPROFILE%\bin (if missing) and installs syllabus.cmd and syllabus.ps1 wrappers.
    5. Adds %USERPROFILE%\bin to the User-level PATH safely without administrator privileges.
    6. Verifies wrapper generation and exit code forwarding.

.PARAMETER Force
    Overwrites existing wrappers without prompting if they are already owned by Syllabus Tracker.

.PARAMETER NonInteractive
    Runs without interactive prompts for automated testing and CI.
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

try {
    Write-Host "==============================================================" -ForegroundColor Blue
    Write-Host " Syllabus Tracker - Global CLI Installer (Windows 11)" -ForegroundColor White
    Write-Host "==============================================================" -ForegroundColor Blue

    # 1. Resolve and validate repository root
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RepoRoot = (Resolve-Path -LiteralPath (Join-Path $ScriptDir "..")).Path
    Write-Info "Resolved Repository Root: $RepoRoot"

    $LauncherScript = Join-Path $RepoRoot "scripts\launcher.py"
    if (-not (Test-Path -LiteralPath $LauncherScript)) {
        throw "Launcher script not found at expected location: $LauncherScript"
    }

    # 2. Verify backend virtual environment and Python
    $BackendVenvPython = Join-Path $RepoRoot "backend\venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $BackendVenvPython)) {
        throw "Backend Python virtual environment not found at: $BackendVenvPython`nPlease initialize backend\venv first."
    }
    Write-Info "Verified Python Interpreter: $BackendVenvPython"

    # Verify python can execute launcher help check
    & $BackendVenvPython -c "import sys; sys.exit(0)"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to execute backend Python interpreter: $BackendVenvPython"
    }

    # 3. Verify frontend
    $FrontendDir = Join-Path $RepoRoot "frontend"
    $PackageJson = Join-Path $FrontendDir "package.json"
    if (-not (Test-Path -LiteralPath $PackageJson)) {
        throw "Frontend package.json not found at: $PackageJson"
    }
    $NodeModules = Join-Path $FrontendDir "node_modules"
    if (-not (Test-Path -LiteralPath $NodeModules)) {
        Write-Warn "Frontend node_modules not detected. Running 'npm run dev' will require 'npm install' first."
    } else {
        Write-Info "Verified Frontend structure and node_modules."
    }

    # 4. User Directories Setup (%LOCALAPPDATA%\SyllabusTracker)
    $LocalAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    if (-not $LocalAppData) {
        $LocalAppData = Join-Path $env:USERPROFILE "AppData\Local"
    }
    $AppHome = Join-Path $LocalAppData "SyllabusTracker"
    $StateDir = Join-Path $AppHome "state"
    $LogsDir = Join-Path $AppHome "logs"
    $ConfigFile = Join-Path $AppHome "config.json"

    foreach ($dir in @($AppHome, $StateDir, $LogsDir)) {
        if (-not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    Write-Info "Configured Runtime Directory: $AppHome"

    # Write / Update config.json idempotently
    if (Test-Path -LiteralPath $ConfigFile) {
        try {
            $existingConfig = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
            $existingConfig.project_root = $RepoRoot
            $existingConfig | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ConfigFile -Encoding UTF8
            Write-Info "Updated existing config.json with current project_root."
        } catch {
            Write-Warn "Could not parse existing config.json. Rebuilding default."
            $needsDefault = $true
        }
    } else {
        $needsDefault = $true
    }

    if ($needsDefault) {
        $defaultConfig = [ordered]@{
            project_root = $RepoRoot
            backend = [ordered]@{
                host = "127.0.0.1"
                port = 8000
                health_path = "/api/health"
                startup_timeout_seconds = 20
            }
            frontend = [ordered]@{
                host = "127.0.0.1"
                port = 5173
                startup_timeout_seconds = 20
                open_browser = $true
            }
            ollama = [ordered]@{
                host = "127.0.0.1"
                port = 11434
                health_path = "/api/tags"
                startup_timeout_seconds = 10
                required = $false
                stop_when_launcher_stops = $false
            }
            shutdown = [ordered]@{
                grace_period_seconds = 5
                force_cleanup = $true
            }
            logging = [ordered]@{
                max_file_size_mb = 10
                backup_count = 3
            }
        }
        $defaultConfig | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ConfigFile -Encoding UTF8
        Write-Info "Created initial config.json at: $ConfigFile"
    }

    # 5. User Bin Directory Setup (%USERPROFILE%\bin)
    $UserBin = Join-Path $env:USERPROFILE "bin"
    if (-not (Test-Path -LiteralPath $UserBin)) {
        New-Item -ItemType Directory -Path $UserBin -Force | Out-Null
        Write-Info "Created user bin directory: $UserBin"
    } else {
        Write-Info "Using existing user bin directory: $UserBin"
    }

    # 6. Generate wrappers: syllabus.cmd and syllabus.ps1
    $CmdWrapperPath = Join-Path $UserBin "syllabus.cmd"
    $Ps1WrapperPath = Join-Path $UserBin "syllabus.ps1"

    $MarkerHeader = "REM [SyllabusTracker-Global-CLI-Signature]"
    $Ps1MarkerHeader = "# [SyllabusTracker-Global-CLI-Signature]"

    # Conflict check for .cmd
    if ((Test-Path -LiteralPath $CmdWrapperPath) -and (-not $Force)) {
        $content = Get-Content -LiteralPath $CmdWrapperPath -Raw -ErrorAction SilentlyContinue
        if ($content -and -not ($content.Contains("SyllabusTracker-Global-CLI-Signature"))) {
            throw "A file already exists at $CmdWrapperPath and does not belong to Syllabus Tracker. Use -Force to overwrite."
        }
    }

    # Conflict check for .ps1
    if ((Test-Path -LiteralPath $Ps1WrapperPath) -and (-not $Force)) {
        $content = Get-Content -LiteralPath $Ps1WrapperPath -Raw -ErrorAction SilentlyContinue
        if ($content -and -not ($content.Contains("SyllabusTracker-Global-CLI-Signature"))) {
            throw "A file already exists at $Ps1WrapperPath and does not belong to Syllabus Tracker. Use -Force to overwrite."
        }
    }

    # Generate syllabus.cmd
    $CmdContent = @"
@echo off
$MarkerHeader
REM Production-Grade Global Launcher Wrapper for Syllabus Tracker
setlocal
set "VENV_PYTHON=$BackendVenvPython"
set "LAUNCHER_SCRIPT=$LauncherScript"

if not exist "%VENV_PYTHON%" (
    echo [ERROR] Syllabus Tracker Python interpreter not found at:
    echo   "%VENV_PYTHON%"
    echo Please re-run setup-global-cli.ps1 or check your installation.
    exit /b 1
)

if not exist "%LAUNCHER_SCRIPT%" (
    echo [ERROR] Launcher engine script not found at:
    echo   "%LAUNCHER_SCRIPT%"
    echo Please re-run setup-global-cli.ps1 or check your installation.
    exit /b 1
)

"%VENV_PYTHON%" "%LAUNCHER_SCRIPT%" %*
exit /b %ERRORLEVEL%
"@

    Set-Content -LiteralPath $CmdWrapperPath -Value $CmdContent -Encoding ASCII
    Write-Success "Installed CMD wrapper: $CmdWrapperPath"

    # Generate syllabus.ps1
    $Ps1Content = @"
$Ps1MarkerHeader
<#
.SYNOPSIS
    Global PowerShell CLI wrapper for Hierarchical Syllabus Checklist & Progress Tracker.
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = `$true)]
    [string[]]`$LauncherArgs
)

`$VenvPython = "$BackendVenvPython"
`$LauncherScript = "$LauncherScript"

if (-not (Test-Path -LiteralPath `$VenvPython)) {
    Write-Error "[ERROR] Syllabus Tracker Python interpreter not found at: `$VenvPython"
    exit 1
}

if (-not (Test-Path -LiteralPath `$LauncherScript)) {
    Write-Error "[ERROR] Launcher engine script not found at: `$LauncherScript"
    exit 1
}

& `$VenvPython `$LauncherScript @LauncherArgs
exit `$LASTEXITCODE
"@

    Set-Content -LiteralPath $Ps1WrapperPath -Value $Ps1Content -Encoding UTF8
    Write-Success "Installed PowerShell wrapper: $Ps1WrapperPath"

    # 7. Add %USERPROFILE%\bin to User PATH safely and idempotently
    $TargetUserPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
    if ($null -eq $TargetUserPath) {
        $TargetUserPath = ""
    }

    # Split, normalize, and check presence
    $PathEntries = $TargetUserPath -split ';' | Where-Object { $_ -and $_.Trim() }
    $NormalizedUserBin = $UserBin.TrimEnd('\')

    $alreadyPresent = $false
    foreach ($entry in $PathEntries) {
        if ($entry.TrimEnd('\').Equals($NormalizedUserBin, [System.StringComparison]::OrdinalIgnoreCase)) {
            $alreadyPresent = $true
            break
        }
    }

    if (-not $alreadyPresent) {
        $NewUserPath = if ($TargetUserPath) { "$TargetUserPath;$UserBin" } else { $UserBin }
        [Environment]::SetEnvironmentVariable("PATH", $NewUserPath, [EnvironmentVariableTarget]::User)
        Write-Success "Added '$UserBin' to User PATH environment variable."
    } else {
        Write-Info "'$UserBin' is already present in User PATH."
    }

    # Update current session PATH so user can test immediately in this console
    $CurrentSessionEntries = $env:PATH -split ';' | Where-Object { $_ -and $_.Trim() }
    $currentPresent = $false
    foreach ($entry in $CurrentSessionEntries) {
        if ($entry.TrimEnd('\').Equals($NormalizedUserBin, [System.StringComparison]::OrdinalIgnoreCase)) {
            $currentPresent = $true
            break
        }
    }
    if (-not $currentPresent) {
        $env:PATH = "$env:PATH;$UserBin"
        Write-Info "Updated current session `$env:PATH."
    }

    # 8. Verification of wrapper execution
    Write-Info "Verifying wrapper execution..."
    $testOutput = & $Ps1WrapperPath help
    if ($LASTEXITCODE -ne 0) {
        throw "Verification test failed: 'syllabus.ps1 help' exited with code $LASTEXITCODE"
    }
    Write-Success "Wrapper verification passed successfully."

    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host " INSTALLATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host "You can now run 'syllabus' from any Command Prompt or PowerShell!" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Cyan
    Write-Host "  syllabus            (alias for 'syllabus start')"
    Write-Host "  syllabus start      (start backend, frontend, Ollama if needed)"
    Write-Host "  syllabus stop       (gracefully stop managed services)"
    Write-Host "  syllabus status     (check service health and port ownership)"
    Write-Host "  syllabus logs       (display recent persistent logs)"
    Write-Host "  syllabus restart    (restart managed services)"
    Write-Host "  syllabus help       (show command reference)"
    Write-Host ""
    Write-Host "Note: Newly opened terminals will automatically recognize 'syllabus'." -ForegroundColor Gray
    Write-Host "==============================================================" -ForegroundColor Green

    exit 0
} catch {
    Write-Failure "Installation failed: $_"
    exit 1
}
