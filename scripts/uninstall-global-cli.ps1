<#
.SYNOPSIS
    Uninstalls the global CLI launcher for Syllabus Tracker on Windows 11.

.DESCRIPTION
    Safely removes Syllabus Tracker CLI wrappers from %USERPROFILE%\bin and cleans up
    the User PATH entry without deleting unrelated user tools, repository files, or databases.

.PARAMETER Force
    Skips interactive confirmation prompts.

.PARAMETER StopServices
    Signals any currently running Syllabus Tracker supervisor/services to stop before uninstallation.

.PARAMETER PurgeData
    Optionally deletes %LOCALAPPDATA%\SyllabusTracker runtime state and logs.
    (Defaults to preserving configuration and logs for diagnostic inspection).
#>

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$StopServices,
    [switch]$PurgeData
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
    Write-Host "==============================================================" -ForegroundColor Yellow
    Write-Host " Syllabus Tracker - Global CLI Uninstaller (Windows 11)" -ForegroundColor White
    Write-Host "==============================================================" -ForegroundColor Yellow

    if (-not $Force) {
        $confirm = Read-Host "Are you sure you want to uninstall the global 'syllabus' command? (y/N)"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Info "Uninstallation cancelled by user."
            exit 0
        }
    }

    $UserBin = Join-Path $env:USERPROFILE "bin"
    $CmdWrapperPath = Join-Path $UserBin "syllabus.cmd"
    $Ps1WrapperPath = Join-Path $UserBin "syllabus.ps1"

    # Stop services if requested
    if ($StopServices) {
        Write-Info "Stopping active Syllabus Tracker services..."
        if (Test-Path -LiteralPath $Ps1WrapperPath) {
            try {
                & $Ps1WrapperPath stop
            } catch {
                Write-Warn "Could not invoke 'syllabus stop': $_"
            }
        }
    }

    # 1. Safely remove wrappers if they have our signature
    $MarkerHeader = "SyllabusTracker-Global-CLI-Signature"

    foreach ($file in @($CmdWrapperPath, $Ps1WrapperPath)) {
        if (Test-Path -LiteralPath $file) {
            $content = Get-Content -LiteralPath $file -Raw -ErrorAction SilentlyContinue
            if ($content -and $content.Contains($MarkerHeader)) {
                Remove-Item -LiteralPath $file -Force
                Write-Success "Removed CLI wrapper: $file"
            } else {
                Write-Warn "File $file does not contain Syllabus Tracker signature; skipping deletion to prevent data loss."
            }
        } else {
            Write-Info "File not found (already removed): $file"
        }
    }

    # 2. Safely remove %USERPROFILE%\bin from User PATH if no other executables need it
    $TargetUserPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
    if ($TargetUserPath) {
        $NormalizedUserBin = $UserBin.TrimEnd('\')
        $PathEntries = $TargetUserPath -split ';' | Where-Object { $_ -and $_.Trim() }
        
        $newEntries = @()
        $foundInPath = $false

        foreach ($entry in $PathEntries) {
            if ($entry.TrimEnd('\').Equals($NormalizedUserBin, [System.StringComparison]::OrdinalIgnoreCase)) {
                $foundInPath = $true
            } else {
                $newEntries += $entry
            }
        }

        if ($foundInPath) {
            # Check if %USERPROFILE%\bin still contains other files
            $remainingFiles = @()
            if (Test-Path -LiteralPath $UserBin) {
                $remainingFiles = Get-ChildItem -LiteralPath $UserBin -File -ErrorAction SilentlyContinue
            }

            if ($remainingFiles.Count -eq 0) {
                $NewUserPath = $newEntries -join ';'
                [Environment]::SetEnvironmentVariable("PATH", $NewUserPath, [EnvironmentVariableTarget]::User)
                Write-Success "Removed '$UserBin' from User PATH environment variable."
            } else {
                Write-Info "Other files remain in '$UserBin' ($($remainingFiles.Count) files found). Retaining User PATH entry."
            }
        } else {
            Write-Info "'$UserBin' was not present in User PATH."
        }
    }

    # 3. Optional purge of AppData
    $LocalAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    if (-not $LocalAppData) {
        $LocalAppData = Join-Path $env:USERPROFILE "AppData\Local"
    }
    $AppHome = Join-Path $LocalAppData "SyllabusTracker"

    if ($PurgeData) {
        if (Test-Path -LiteralPath $AppHome) {
            Remove-Item -LiteralPath $AppHome -Recurse -Force
            Write-Success "Purged runtime data and logs directory: $AppHome"
        }
    } else {
        if (Test-Path -LiteralPath $AppHome) {
            Write-Info "Preserved configuration, state, and logs at: $AppHome"
            Write-Info "(To delete manually, run: Remove-Item -Recurse -Force '$AppHome')"
        }
    }

    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host " UNINSTALLATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host "Project repository and database files have been completely preserved." -ForegroundColor White
    exit 0
} catch {
    Write-Failure "Uninstallation failed: $_"
    exit 1
}
