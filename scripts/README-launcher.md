# Production-Grade Windows 11 Global CLI Launcher for Syllabus Tracker

The **Syllabus Tracker Global CLI** (`syllabus`) is a unified, single-command launcher and process supervisor built specifically for Windows 11 (PowerShell and Command Prompt). It replaces multi-terminal development workflows with reliable background process management, automatic dependency checks, Windows Job Object process tree isolation, and non-destructive port conflict resolution.

---

## 1. Quick Start

### Installation

From PowerShell inside the repository:

```powershell
.\scripts\setup-global-cli.ps1
```

This idempotent installer:
1. Validates the backend virtual environment and frontend configuration.
2. Initializes `%LOCALAPPDATA%\SyllabusTracker\` configuration and log directories.
3. Installs `syllabus.cmd` and `syllabus.ps1` into `%USERPROFILE%\bin`.
4. Idempotently adds `%USERPROFILE%\bin` to your **User PATH** without requiring Administrator privileges.
5. Verifies wrapper execution.

After running the installer, **`syllabus` is immediately accessible in the current session** and all newly opened CMD/PowerShell windows.

---

## 2. Command Reference

All commands work identically from any working directory in Windows Command Prompt and PowerShell.

```powershell
syllabus                     # Starts all services and opens the browser (default)
syllabus start               # Explicit start command
syllabus status              # Inspects health, ports, and process ownership
syllabus logs [component]    # Displays logs (backend, frontend, ollama, launcher)
syllabus restart             # Stops and restarts managed services
syllabus stop                # Gracefully terminates managed services
syllabus help                # Displays usage and configuration information
```

### Options

#### `syllabus start`
- `--no-browser`: Prevents opening `http://localhost:5173` in the default browser upon readiness.
- `--config <path>`: Uses an alternative configuration JSON file.

#### `syllabus stop`
- `--force`: Immediately forces termination if graceful shutdown exceeds the timeout.
- `--timeout <seconds>`: Seconds to wait for graceful termination before forced cleanup (default: `5`).
- `--stop-ollama`: Terminate Ollama if it was started by the launcher (pre-existing Ollama is always preserved).

#### `syllabus logs [component] [-n <lines>] [--follow]`
- `component`: Choose from `backend`, `frontend`, `ollama`, `launcher`, or omit to view combined summary.
- `-n`, `--lines <count>`: Number of trailing log lines to display (default: `100`).
- `-f`, `--follow`: Streams log output continuously until interrupted with Ctrl+C.

---

## 3. Architecture & Reliability Guarantees

```text
Any CMD / PowerShell directory
            |
            v
      syllabus.cmd  /  syllabus.ps1
            |
            v
      scripts/launcher.py (Supervisor Engine)
            |
      +-----+---------------------------------+
      |                                       |
      v                                       v
[Windows Job Object]                [Loopback Authenticated IPC]
(KILL_ON_JOB_CLOSE)                 (127.0.0.1:<random_port>)
      |                                       |
  +---+--------------------+                  |
  |                        |                  |
  v                        v                  v
FastAPI (Uvicorn)    Vite (Node)      Cross-Terminal Commands
(127.0.0.1:8000)   (127.0.0.1:5173)   (syllabus stop / status)
```

### Robust Windows Process Tree Supervision
Windows PID recycling can cause naive PID-tracking supervisors to kill innocent processes. Syllabus Tracker prevents this via **Windows Job Objects** using the native Windows API (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` via `ctypes.windll.kernel32`).
- When `launcher.py` launches `uvicorn` and `vite`, child processes are automatically bound to the supervisor's Job Object.
- If the supervisor process terminates, crashes, or is killed, **the Windows kernel instantly and cleanly reaps all child processes**.
- Eliminates orphaned `node.exe` or `python.exe` processes completely.

### Non-Destructive Port Conflict Management
The launcher **never** runs broad kill commands such as `taskkill /IM python.exe /F` or `taskkill /IM node.exe /F`.
- Ports `8000` (FastAPI), `5173` (Vite), and `11434` (Ollama) are inspected before binding.
- If a port is occupied:
  1. The launcher sends an HTTP health probe (`GET /api/health` or Vite HTML check).
  2. If the listening service is healthy and identified as Syllabus Tracker, **it reuses the existing instance** instead of crashing.
  3. If the port is held by an unrecognized, conflicting application, the launcher safely refuses to terminate it and reports actionable PID diagnostics.

### Ollama Lifecycle Safety
- Ollama is probed first via `GET http://127.0.0.1:11434/api/tags`.
- If an existing Ollama daemon is already running (e.g. started by Windows startup or user), the launcher records `launcher_owned = false`.
- Pre-existing Ollama is **never terminated** when `syllabus stop` or Ctrl+C is invoked.
- If Ollama is missing or not installed, the application runs gracefully in optional/degraded mode.

### Safe Cross-Terminal Stop via Authenticated IPC
- The foreground supervisor hosts a loopback-only HTTP control server bound to `127.0.0.1` on a dynamically assigned OS port.
- Every supervisor run generates a cryptographically secure 256-bit token stored in `%LOCALAPPDATA%\SyllabusTracker\state\instance.json`.
- Running `syllabus stop` from a separate terminal authenticates with this token and signals graceful shutdown without terminating processes blindly.

---

## 4. Configuration Schema

Configuration is stored at:
```text
%LOCALAPPDATA%\SyllabusTracker\config.json
```

Default configuration:
```json
{
  "project_root": "C:\\Farhan Ahmad\\Code Languages\\Mr. Z\\Anti Gravity\\Syllabus_Tracker",
  "backend": {
    "host": "127.0.0.1",
    "port": 8000,
    "health_path": "/api/health",
    "startup_timeout_seconds": 20
  },
  "frontend": {
    "host": "127.0.0.1",
    "port": 5173,
    "startup_timeout_seconds": 20,
    "open_browser": true
  },
  "ollama": {
    "host": "127.0.0.1",
    "port": 11434,
    "health_path": "/api/tags",
    "startup_timeout_seconds": 10,
    "required": false,
    "stop_when_launcher_stops": false
  },
  "shutdown": {
    "grace_period_seconds": 5,
    "force_cleanup": true
  },
  "logging": {
    "max_file_size_mb": 10,
    "backup_count": 3
  }
}
```

---

## 5. Persistent Logs

All service standard output and error streams are captured asynchronously and rotated safely:

| Service | Log File Location |
|---|---|
| Supervisor | `%LOCALAPPDATA%\SyllabusTracker\logs\launcher.log` |
| FastAPI Backend | `%LOCALAPPDATA%\SyllabusTracker\logs\backend.log` |
| React/Vite Frontend | `%LOCALAPPDATA%\SyllabusTracker\logs\frontend.log` |
| Ollama | `%LOCALAPPDATA%\SyllabusTracker\logs\ollama.log` |

Logs can be inspected live at any time using:
```powershell
syllabus logs backend --follow
```

---

## 6. Troubleshooting & Recovery

### Stale Instance Locks
If the machine crashes or powers off, an instance lock may remain in `%LOCALAPPDATA%\SyllabusTracker\state\`.
The launcher automatically validates the PID inside `supervisor.lock` against running Windows processes. If the recorded PID is dead or belongs to an unrelated executable, the lock is automatically reclaimed.

### Port Conflicts
If port `8000` or `5173` is in use by another software:
```powershell
syllabus status
```
Inspect the displayed PID and command-line. If you wish to stop the other application manually:
```powershell
Get-Process -Id <PID> | Stop-Process
```
The launcher will then start normally.

---

## 7. Uninstallation

To cleanly remove the global CLI:

```powershell
.\scripts\uninstall-global-cli.ps1
```

Parameters:
- `-Force`: Removes without interactive confirmation prompts.
- `-StopServices`: Stops running services before uninstallation.
- `-PurgeData`: Also removes `%LOCALAPPDATA%\SyllabusTracker` configuration and logs.

The uninstaller **never** deletes your repository code, databases, or unrelated tools in `%USERPROFILE%\bin`.
