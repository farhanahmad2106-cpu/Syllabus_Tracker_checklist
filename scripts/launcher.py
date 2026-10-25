#!/usr/bin/env python3
"""
Production-Grade Windows 11 Global CLI Supervisor for the
Hierarchical Syllabus Checklist & Progress Tracker.

Orchestrates local services:
- FastAPI Backend (Uvicorn on 127.0.0.1:8000)
- React Frontend (Vite on 127.0.0.1:5173)
- Ollama Local LLM (127.0.0.1:11434, managed safely)

Ensures robust Windows process tree isolation via Windows Job Objects,
single-instance concurrency locking, loopback authenticated IPC,
and non-destructive port conflict management.
"""

from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import json
import logging
import msvcrt
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from dataclasses import asdict, dataclass, field
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import psutil
except ImportError:
    psutil = None  # type: ignore

# -----------------------------------------------------------------------------
# Constants & Defaults
# -----------------------------------------------------------------------------

APP_NAME = "SyllabusTracker"
APP_DISPLAY_NAME = "Hierarchical Syllabus Checklist & Progress Tracker"

DEFAULT_CONFIG: Dict[str, Any] = {
    "project_root": "",
    "backend": {
        "host": "127.0.0.1",
        "port": 8000,
        "health_path": "/api/health",
        "startup_timeout_seconds": 20,
    },
    "frontend": {
        "host": "127.0.0.1",
        "port": 5173,
        "startup_timeout_seconds": 20,
        "open_browser": True,
    },
    "ollama": {
        "host": "127.0.0.1",
        "port": 11434,
        "health_path": "/api/tags",
        "startup_timeout_seconds": 10,
        "required": False,
        "stop_when_launcher_stops": False,
    },
    "shutdown": {
        "grace_period_seconds": 5,
        "force_cleanup": True,
    },
    "logging": {
        "max_file_size_mb": 10,
        "backup_count": 3,
    },
}


def get_app_home() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        local_app_data = str(Path.home() / "AppData" / "Local")
    return Path(local_app_data) / APP_NAME


@dataclass
class PortStatus:
    port: int
    is_listening: bool
    owning_pid: Optional[int] = None
    is_launcher_owned: bool = False
    details: str = ""


# -----------------------------------------------------------------------------
# Windows Job Object API (ctypes)
# -----------------------------------------------------------------------------

JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000
JobObjectExtendedLimitInformation = 9


class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64),
        ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class IO_COUNTERS(ctypes.Structure):
    _fields_ = [
        ("ReadOperationCount", ctypes.c_uint64),
        ("WriteOperationCount", ctypes.c_uint64),
        ("OtherOperationCount", ctypes.c_uint64),
        ("ReadTransferCount", ctypes.c_uint64),
        ("WriteTransferCount", ctypes.c_uint64),
        ("OtherTransferCount", ctypes.c_uint64),
    ]


class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", JOBOBJECT_BASIC_LIMIT_INFORMATION),
        ("IoInfo", IO_COUNTERS),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryLimit", ctypes.c_size_t),
        ("PeakJobMemoryLimit", ctypes.c_size_t),
    ]


class WindowsJobGroup:
    """Encapsulates a Windows Job Object to guarantee child process tree cleanup."""

    def __init__(self, logger: logging.Logger) -> None:
        self.logger = logger
        self.handle: Optional[wintypes.HANDLE] = None
        self._init_job()

    def _init_job(self) -> None:
        if os.name != "nt":
            return
        try:
            kernel32 = ctypes.windll.kernel32
            h_job = kernel32.CreateJobObjectW(None, None)
            if not h_job:
                self.logger.warning("launcher.job_object_create_failed")
                return

            info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            success = kernel32.SetInformationJobObject(
                h_job,
                JobObjectExtendedLimitInformation,
                ctypes.byref(info),
                ctypes.sizeof(info),
            )
            if not success:
                self.logger.warning("launcher.job_object_set_limit_failed")
                kernel32.CloseHandle(h_job)
                return

            self.handle = h_job
            self.logger.info("launcher.job_object_initialized")
        except Exception as exc:
            self.logger.warning("launcher.job_object_exception err=%s", exc)

    def assign_process(self, pid: int, proc_handle: Any = None) -> bool:
        if not self.handle or os.name != "nt":
            return False
        try:
            kernel32 = ctypes.windll.kernel32
            if proc_handle:
                res = kernel32.AssignProcessToJobObject(self.handle, proc_handle)
                return bool(res)
            # Open process handle if not directly provided
            PROCESS_SET_QUOTA = 0x0100
            PROCESS_TERMINATE = 0x0001
            h_proc = kernel32.OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, False, pid)
            if not h_proc:
                return False
            try:
                res = kernel32.AssignProcessToJobObject(self.handle, h_proc)
                return bool(res)
            finally:
                kernel32.CloseHandle(h_proc)
        except Exception as exc:
            self.logger.warning("launcher.job_assign_failed pid=%d err=%s", pid, exc)
            return False

    def close(self) -> None:
        if self.handle:
            try:
                ctypes.windll.kernel32.CloseHandle(self.handle)
            except Exception:
                pass
            self.handle = None


# -----------------------------------------------------------------------------
# Configuration & Environment
# -----------------------------------------------------------------------------

class ConfigManager:
    """Manages persistent config, state, and logs under %LOCALAPPDATA%/SyllabusTracker."""

    def __init__(self, explicit_root: Optional[Path] = None, base_dir: Optional[Path] = None) -> None:
        self.base_dir = base_dir or get_app_home()
        self.state_dir = self.base_dir / "state"
        self.logs_dir = self.base_dir / "logs"
        self.config_file = self.base_dir / "config.json"
        self.instance_file = self.state_dir / "instance.json"
        self.lock_file = self.state_dir / "launcher.lock"

        self.ensure_dirs()
        self.config: Dict[str, Any] = self.load_or_create_config(explicit_root)

    @classmethod
    def ensure_config_exists(cls) -> Path:
        base = get_app_home()
        config_path = base / "config.json"
        if not config_path.is_file():
            base.mkdir(parents=True, exist_ok=True)
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_CONFIG, f, indent=2)
        return config_path

    @classmethod
    def load_config(cls, path: Path) -> Dict[str, Any]:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)

    def ensure_dirs(self) -> None:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    def load_or_create_config(self, explicit_root: Optional[Path]) -> Dict[str, Any]:
        cfg = dict(DEFAULT_CONFIG)
        if self.config_file.is_file():
            try:
                with open(self.config_file, "r", encoding="utf-8-sig") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        # Merge recursively
                        for k, v in loaded.items():
                            if isinstance(v, dict) and k in cfg and isinstance(cfg[k], dict):
                                cfg[k].update(v)
                            else:
                                cfg[k] = v
            except Exception as e:
                print(f"[WARN] Failed to read {self.config_file}: {e}", file=sys.stderr)

        # Detect project root if unset or invalid
        if explicit_root:
            cfg["project_root"] = str(explicit_root.resolve())
        elif not cfg.get("project_root") or not Path(cfg["project_root"]).is_dir():
            detected = self._detect_repo_root()
            if detected:
                cfg["project_root"] = str(detected)

        return cfg

    def save_config(self) -> None:
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"[WARN] Could not write config to {self.config_file}: {e}", file=sys.stderr)

    def _detect_repo_root(self) -> Optional[Path]:
        # Check current file's parent directory (scripts/ -> root)
        here = Path(__file__).resolve().parent.parent
        if (here / "backend" / "app" / "main.py").is_file():
            return here

        # Check current working directory
        cwd = Path.cwd().resolve()
        if (cwd / "backend" / "app" / "main.py").is_file():
            return cwd

        return None

    @property
    def project_root(self) -> Path:
        raw = self.config.get("project_root")
        if raw and Path(raw).is_dir():
            return Path(raw).resolve()
        # Fallback to file relative
        return Path(__file__).resolve().parent.parent


# -----------------------------------------------------------------------------
# Runtime State & IPC
# -----------------------------------------------------------------------------

@dataclass
class InstanceState:
    supervisor_pid: int
    control_port: int
    control_token: str
    backend_pid: Optional[int] = None
    frontend_pid: Optional[int] = None
    ollama_pid: Optional[int] = None
    ollama_owned: bool = False
    started_at: float = field(default_factory=time.time)
    project_root: str = ""
    backend_url: str = "http://127.0.0.1:8000"
    frontend_url: str = "http://localhost:5173"
    ollama_url: str = "http://127.0.0.1:11434"


class SingleInstanceLock:
    """Provides single-instance exclusivity using kernel-level file locking."""

    def __init__(self, lock_path: Path) -> None:
        self.lock_path = lock_path
        self.file_handle = None

    def acquire(self) -> bool:
        # Check if lock file exists and if recorded PID is dead
        if self.lock_path.is_file():
            try:
                content = self.lock_path.read_text(encoding="utf-8").strip()
                if content and content.isdigit():
                    recorded_pid = int(content)
                    if psutil and not psutil.pid_exists(recorded_pid):
                        try:
                            self.lock_path.unlink()
                        except Exception:
                            pass
            except Exception:
                pass

        try:
            self.file_handle = open(self.lock_path, "w+")
            if os.name == "nt":
                msvcrt.locking(self.file_handle.fileno(), msvcrt.LK_NBLCK, 1)
            self.file_handle.write(str(os.getpid()))
            self.file_handle.flush()
            return True
        except (IOError, OSError):
            if self.file_handle:
                try:
                    self.file_handle.close()
                except Exception:
                    pass
                self.file_handle = None
            return False

    def release(self) -> None:
        if self.file_handle:
            try:
                if os.name == "nt":
                    self.file_handle.seek(0)
                    msvcrt.locking(self.file_handle.fileno(), msvcrt.LK_UNLCK, 1)
                self.file_handle.close()
            except Exception:
                pass
            self.file_handle = None
            try:
                if self.lock_path.is_file():
                    self.lock_path.unlink()
            except Exception:
                pass


# -----------------------------------------------------------------------------
# Health Probes & Port Utilities
# -----------------------------------------------------------------------------

class HealthProbe:
    """Reliable HTTP polling with short timeouts."""

    @staticmethod
    def check_http(url: str, timeout: float = 2.0) -> Tuple[bool, Optional[int], Optional[str]]:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "SyllabusTracker-Launcher/1.0"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = resp.status
                body = resp.read(2048).decode("utf-8", errors="replace")
                return True, status, body
        except urllib.error.HTTPError as e:
            return False, e.code, str(e)
        except Exception as e:
            return False, None, str(e)

    @classmethod
    def wait_for_ready(
        cls,
        url: str,
        timeout_seconds: float,
        check_proc_alive: Optional[callable] = None,
        poll_interval: float = 0.5,
    ) -> bool:
        start = time.time()
        while time.time() - start < timeout_seconds:
            if check_proc_alive and not check_proc_alive():
                return False
            ok, status, _ = cls.check_http(url, timeout=1.5)
            if ok and status in (200, 204):
                return True
            time.sleep(poll_interval)
        return False

    @classmethod
    def wait_for_readiness(
        cls,
        url: str,
        service_name: str = "Service",
        timeout_seconds: float = 20.0,
        poll_interval: float = 0.5,
        check_proc_alive: Optional[callable] = None,
    ) -> Tuple[bool, Optional[str]]:
        start = time.time()
        last_err = None
        while time.time() - start < timeout_seconds:
            if check_proc_alive and not check_proc_alive():
                return False, f"{service_name} process exited unexpectedly."
            ok, status, err = cls.check_http(url, timeout=1.5)
            if ok and status in (200, 204):
                return True, None
            last_err = err
            time.sleep(poll_interval)
        return False, f"{service_name} failed to become ready within {timeout_seconds}s (last error: {last_err})"


class PortInspector:
    """Inspects ports safely without killing unrelated processes."""

    @staticmethod
    def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            try:
                return s.connect_ex((host, port)) == 0
            except Exception:
                return False

    @staticmethod
    def get_owning_pid(port: int) -> Optional[int]:
        if psutil:
            try:
                for conn in psutil.net_connections(kind="inet"):
                    if conn.laddr and conn.laddr.port == port and conn.status == psutil.CONN_LISTEN:
                        return conn.pid
            except Exception:
                pass

        # Windows netstat fallback
        if os.name == "nt":
            try:
                out = subprocess.check_output(
                    f"netstat -ano -p tcp | findstr /R /C:\":{port} \"",
                    shell=True,
                    text=True,
                    stderr=subprocess.DEVNULL,
                )
                for line in out.strip().splitlines():
                    parts = line.split()
                    if len(parts) >= 5 and "LISTENING" in parts:
                        return int(parts[-1])
            except Exception:
                pass
        return None

    @classmethod
    def verify_app_process(cls, pid: int, expected_part: str) -> bool:
        if not psutil:
            return False
        try:
            p = psutil.Process(pid)
            cmd = " ".join(p.cmdline()).lower()
            return expected_part.lower() in cmd
        except Exception:
            return False

    @classmethod
    def inspect_port(cls, port: int, host: str = "127.0.0.1", expected_marker: str = "") -> PortStatus:
        listening = cls.is_port_in_use(port, host)
        if not listening:
            return PortStatus(port=port, is_listening=False)
        pid = cls.get_owning_pid(port)
        owned = False
        if pid and expected_marker:
            owned = cls.verify_app_process(pid, expected_marker)
        return PortStatus(port=port, is_listening=True, owning_pid=pid, is_launcher_owned=owned)


# -----------------------------------------------------------------------------
# Control Server (Cross-Terminal Stop & Status)
# -----------------------------------------------------------------------------

class ControlServer:
    """Loopback-only HTTP control server for inter-process communication."""

    def __init__(
        self,
        supervisor: Optional[Any] = None,
        token: Optional[str] = None,
        auth_token: Optional[str] = None,
        on_stop: Optional[Any] = None,
        on_status: Optional[Any] = None,
    ) -> None:
        self.supervisor = supervisor
        self.token = token or auth_token or ""
        self.on_stop = on_stop
        self.on_status = on_status
        self.server: Optional[HTTPServer] = None
        self.thread: Optional[threading.Thread] = None
        self.port: int = 0

    def start(self) -> int:
        supervisor = self.supervisor
        token = self.token
        on_stop = self.on_stop
        on_status = self.on_status

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format: str, *args: Any) -> None:
                pass  # Silence standard access logs

            def _authenticate(self) -> bool:
                auth = self.headers.get("Authorization", "")
                if auth == f"Bearer {token}":
                    return True
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error": "Unauthorized"}')
                return False

            def do_GET(self) -> None:
                if self.path == "/status":
                    if not self._authenticate():
                        return
                    if on_status:
                        ok, status_dict = on_status()
                    elif supervisor:
                        status_dict = supervisor.get_status_snapshot()
                    else:
                        status_dict = {"status": "ok"}
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(status_dict).encode("utf-8"))
                else:
                    self.send_response(404)
                    self.end_headers()

            def do_POST(self) -> None:
                if self.path == "/stop":
                    if not self._authenticate():
                        return
                    content_length = int(self.headers.get("Content-Length", 0))
                    payload = {}
                    if content_length > 0:
                        try:
                            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
                        except Exception:
                            pass
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"status": "stopping"}')
                    if on_stop:
                        on_stop(force=payload.get("force", False), stop_ollama=payload.get("stop_ollama", False))
                    elif supervisor:
                        threading.Thread(target=supervisor.request_shutdown, daemon=True).start()
                else:
                    self.send_response(404)
                    self.end_headers()

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_port
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return self.port

    def stop(self) -> None:
        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception:
                pass
            self.server = None

    @staticmethod
    def send_command(
        port: int,
        command: str,
        token: str,
        payload: Optional[Dict[str, Any]] = None,
        timeout: float = 3.0,
    ) -> Dict[str, Any]:
        url = f"http://127.0.0.1:{port}/{command.lstrip('/')}"
        data = json.dumps(payload or {}).encode("utf-8") if (payload or command == "stop") else None
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST" if (data is not None or command == "stop") else "GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                return {"success": True, "data": json.loads(raw) if raw else {}}
        except urllib.error.HTTPError as e:
            return {"success": False, "message": f"HTTP {e.code}: {e.reason}"}
        except Exception as e:
            return {"success": False, "message": str(e)}


# -----------------------------------------------------------------------------
# Supervisor Engine
# -----------------------------------------------------------------------------

class Supervisor:
    """Central engine orchestrating lifecycle, monitoring, and teardown."""

    def __init__(self, config_manager: ConfigManager) -> None:
        self.config_mgr = config_manager
        self.config = config_manager.config
        self.logger = self._setup_logging()

        self.job_group = WindowsJobGroup(self.logger)
        self.single_lock = SingleInstanceLock(self.config_mgr.lock_file)
        self.control_server: Optional[ControlServer] = None

        self.shutdown_event = threading.Event()
        self.state = InstanceState(
            supervisor_pid=os.getpid(),
            control_port=0,
            control_token=secrets.token_hex(16),
            project_root=str(self.config_mgr.project_root),
        )

        self.backend_proc: Optional[subprocess.Popen] = None
        self.frontend_proc: Optional[subprocess.Popen] = None
        self.ollama_proc: Optional[subprocess.Popen] = None

        self.backend_log_file = None
        self.frontend_log_file = None
        self.ollama_log_file = None

    def _setup_logging(self) -> logging.Logger:
        logger = logging.getLogger("SyllabusSupervisor")
        logger.setLevel(logging.INFO)
        logger.handlers.clear()

        log_path = self.config_mgr.logs_dir / "launcher.log"
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        fh.setFormatter(fmt)
        logger.addHandler(fh)
        return logger

    def request_shutdown(self) -> None:
        self.logger.info("launcher.shutdown_requested")
        self.shutdown_event.set()

    # -------------------------------------------------------------------------
    # Lifecycle: Start
    # -------------------------------------------------------------------------

    def start(self, open_browser: Optional[bool] = None) -> int:
        print("==============================================================")
        print(f"  {APP_DISPLAY_NAME}")
        print("==============================================================")

        # 1. Acquire Single Instance Lock
        if not self.single_lock.acquire():
            # Check if active instance responds
            active = self._check_existing_instance()
            if active:
                print(f"[INFO] Syllabus Tracker is ALREADY RUNNING (PID {active.get('supervisor_pid')}).")
                print(f"       Frontend : {active.get('frontend_url', 'http://localhost:5173')}")
                print(f"       Backend  : {active.get('backend_url', 'http://127.0.0.1:8000')}")
                print("       Use 'syllabus status' for details, or 'syllabus stop' to terminate.")
                if open_browser is True or (open_browser is None and self.config["frontend"].get("open_browser")):
                    webbrowser.open(active.get("frontend_url", "http://localhost:5173"))
                return 0
            else:
                print("[WARN] Found stale supervisor lock. Reconciling previous state...")
                self._reconcile_stale_instance()
                if not self.single_lock.acquire():
                    print("[ERROR] Could not acquire supervisor lock. Exiting.", file=sys.stderr)
                    return 1

        # 2. Start IPC Control Server
        self.control_server = ControlServer(self, self.state.control_token)
        self.state.control_port = self.control_server.start()
        self._write_instance_state()

        # 3. Register Signal Handlers
        signal.signal(signal.SIGINT, lambda s, f: self.request_shutdown())
        signal.signal(signal.SIGTERM, lambda s, f: self.request_shutdown())
        if hasattr(signal, "SIGBREAK"):
            signal.signal(signal.SIGBREAK, lambda s, f: self.request_shutdown())

        try:
            # 4. Probe / Start Ollama
            self._handle_ollama_startup()

            # 5. Start Backend
            if not self._start_backend():
                print("[ERROR] Backend startup failed. Performing clean rollback...", file=sys.stderr)
                self.teardown()
                return 1

            # 6. Start Frontend
            if not self._start_frontend():
                print("[ERROR] Frontend startup failed. Performing clean rollback...", file=sys.stderr)
                self.teardown()
                return 1

            self._write_instance_state()

            # 7. Print Readiness Banner
            ollama_label = f"Ollama ({self.state.ollama_url})" if self._is_ollama_ready() else ("Ollama (Optional / Offline)" if not self.config["ollama"].get("required") else "Ollama (Offline)")
            print()
            print("==============================================================")
            print(f"  {APP_DISPLAY_NAME}")
            print("==============================================================")
            print(f"  Frontend UI : {self.state.frontend_url}")
            print(f"  API Backend : {self.state.backend_url}")
            print(f"  API Docs    : {self.state.backend_url}/docs")
            print(f"  Local LLM   : {ollama_label}")
            print("==============================================================")
            print("  Status      : All services active and healthy.")
            print("  Press [Ctrl+C] to stop all services.")
            print("==============================================================")
            print()

            # 8. Open default browser
            should_open = open_browser if open_browser is not None else self.config["frontend"].get("open_browser", True)
            if should_open:
                try:
                    webbrowser.open(self.state.frontend_url)
                except Exception as exc:
                    self.logger.warning("launcher.browser_open_failed err=%s", exc)

            # 9. Supervise until shutdown
            while not self.shutdown_event.is_set():
                # Check backend health
                if self.backend_proc and self.backend_proc.poll() is not None:
                    code = self.backend_proc.poll()
                    print(f"\n[ALERT] Backend process terminated unexpectedly (exit code {code})!", file=sys.stderr)
                    self.logger.error("backend.unexpected_exit code=%d", code)
                    break

                # Check frontend health
                if self.frontend_proc and self.frontend_proc.poll() is not None:
                    code = self.frontend_proc.poll()
                    print(f"\n[ALERT] Frontend process terminated unexpectedly (exit code {code})!", file=sys.stderr)
                    self.logger.error("frontend.unexpected_exit code=%d", code)
                    break

                time.sleep(0.5)

        except KeyboardInterrupt:
            self.logger.info("launcher.keyboard_interrupt")
        finally:
            self.teardown()

        return 0

    def _is_ollama_ready(self) -> bool:
        host = self.config["ollama"].get("host", "127.0.0.1")
        port = self.config["ollama"].get("port", 11434)
        path = self.config["ollama"].get("health_path", "/api/tags")
        ok, status, _ = HealthProbe.check_http(f"http://{host}:{port}{path}", timeout=1.5)
        return ok and status == 200

    def _handle_ollama_startup(self) -> None:
        host = self.config["ollama"].get("host", "127.0.0.1")
        port = self.config["ollama"].get("port", 11434)
        url = f"http://{host}:{port}"
        self.state.ollama_url = url

        if self._is_ollama_ready():
            self.logger.info("ollama.already_available url=%s", url)
            self.state.ollama_owned = False
            return

        ollama_bin = shutil.which("ollama")
        if not ollama_bin and os.name == "nt":
            # Check default AppData install location
            candidate = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe"
            if candidate.is_file():
                ollama_bin = str(candidate)

        if not ollama_bin:
            msg = "Ollama executable not found in PATH or standard install directory."
            if self.config["ollama"].get("required", False):
                raise RuntimeError(msg)
            self.logger.info("ollama.not_installed optional=True")
            return

        print("[START] Launching Ollama daemon (ollama serve)...")
        log_f = open(self.config_mgr.logs_dir / "ollama.log", "a", encoding="utf-8")
        self.ollama_log_file = log_f

        try:
            self.ollama_proc = subprocess.Popen(
                [ollama_bin, "serve"],
                stdout=log_f,
                stderr=log_f,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            self.state.ollama_pid = self.ollama_proc.pid
            self.state.ollama_owned = True
            self.job_group.assign_process(self.ollama_proc.pid)

            # Wait for Ollama readiness
            to = float(self.config["ollama"].get("startup_timeout_seconds", 10))
            path = self.config["ollama"].get("health_path", "/api/tags")
            ready = HealthProbe.wait_for_ready(
                f"{url}{path}",
                timeout_seconds=to,
                check_proc_alive=lambda: self.ollama_proc and self.ollama_proc.poll() is None,
            )
            if ready:
                self.logger.info("ollama.ready_after_launch pid=%d", self.ollama_proc.pid)
            else:
                self.logger.warning("ollama.timeout_after_launch limit=%.1fs", to)
        except Exception as exc:
            self.logger.error("ollama.launch_failed err=%s", exc)
            if self.config["ollama"].get("required", False):
                raise

    def _start_backend(self) -> bool:
        host = self.config["backend"].get("host", "127.0.0.1")
        port = int(self.config["backend"].get("port", 8000))
        health_path = self.config["backend"].get("health_path", "/api/health")
        url = f"http://{host}:{port}"
        self.state.backend_url = url

        # Check existing port
        if PortInspector.is_port_in_use(port, host):
            # Check if it's already a healthy instance of Syllabus Tracker
            ok, status, body = HealthProbe.check_http(f"{url}{health_path}", timeout=1.5)
            if ok and status == 200 and body and "database" in body:
                print(f"[OK] Reusing healthy pre-existing Syllabus Tracker backend on {url}.")
                self.state.backend_pid = PortInspector.get_owning_pid(port)
                return True
            else:
                pid = PortInspector.get_owning_pid(port)
                print(f"[ERROR] Port {port} is occupied by an unrelated process (PID {pid})!", file=sys.stderr)
                print("        Please free port 8000 or configure a different port in config.json.", file=sys.stderr)
                return False

        root = self.config_mgr.project_root
        venv_python = root / "backend" / "venv" / "Scripts" / "python.exe"
        if not venv_python.is_file():
            venv_python = Path(sys.executable)

        cmd = [
            str(venv_python),
            "-m",
            "uvicorn",
            "backend.app.main:app",
            "--host",
            host,
            "--port",
            str(port),
            "--reload",
            "--reload-dir",
            str(root / "backend" / "app"),
        ]

        print(f"[START] Launching Backend on {url}...")
        log_f = open(self.config_mgr.logs_dir / "backend.log", "a", encoding="utf-8")
        self.backend_log_file = log_f

        self.backend_proc = subprocess.Popen(
            cmd,
            cwd=str(root),
            stdout=log_f,
            stderr=log_f,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        self.state.backend_pid = self.backend_proc.pid
        self.job_group.assign_process(self.backend_proc.pid)

        to = float(self.config["backend"].get("startup_timeout_seconds", 20))
        ready = HealthProbe.wait_for_ready(
            f"{url}{health_path}",
            timeout_seconds=to,
            check_proc_alive=lambda: self.backend_proc and self.backend_proc.poll() is None,
        )
        if ready:
            print(f"[READY] Backend verified healthy on {url}{health_path}.")
            return True
        else:
            print(f"[ERROR] Backend failed readiness check within {to}s.", file=sys.stderr)
            return False

    def _start_frontend(self) -> bool:
        host = self.config["frontend"].get("host", "127.0.0.1")
        port = int(self.config["frontend"].get("port", 5173))
        url = f"http://{host}:{port}"
        self.state.frontend_url = url

        # Check existing port
        if PortInspector.is_port_in_use(port, host):
            ok, status, _ = HealthProbe.check_http(url, timeout=1.5)
            if ok and status in (200, 304):
                print(f"[OK] Reusing pre-existing frontend server on {url}.")
                self.state.frontend_pid = PortInspector.get_owning_pid(port)
                return True
            else:
                pid = PortInspector.get_owning_pid(port)
                print(f"[ERROR] Port {port} is occupied by an unrelated process (PID {pid})!", file=sys.stderr)
                return False

        root = self.config_mgr.project_root
        frontend_dir = root / "frontend"
        if not (frontend_dir / "package.json").is_file():
            print(f"[ERROR] Frontend directory not found at {frontend_dir}", file=sys.stderr)
            return False

        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        cmd = [
            npm_cmd,
            "run",
            "dev",
            "--",
            "--host",
            host,
            "--port",
            str(port),
            "--strictPort",
        ]

        print(f"[START] Launching Frontend on {url}...")
        log_f = open(self.config_mgr.logs_dir / "frontend.log", "a", encoding="utf-8")
        self.frontend_log_file = log_f

        self.frontend_proc = subprocess.Popen(
            cmd,
            cwd=str(frontend_dir),
            stdout=log_f,
            stderr=log_f,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        self.state.frontend_pid = self.frontend_proc.pid
        self.job_group.assign_process(self.frontend_proc.pid)

        to = float(self.config["frontend"].get("startup_timeout_seconds", 20))
        ready = HealthProbe.wait_for_ready(
            url,
            timeout_seconds=to,
            check_proc_alive=lambda: self.frontend_proc and self.frontend_proc.poll() is None,
        )
        if ready:
            print(f"[READY] Frontend verified healthy on {url}.")
            return True
        else:
            print(f"[ERROR] Frontend failed readiness check within {to}s.", file=sys.stderr)
            return False

    def teardown(self) -> None:
        print("[STOPPING] Shutting down application services...")
        grace_period = float(self.config["shutdown"].get("grace_period_seconds", 5))

        # 1. Frontend
        if self.frontend_proc and self.frontend_proc.poll() is None:
            try:
                self.frontend_proc.terminate()
                self.frontend_proc.wait(timeout=grace_period)
            except Exception:
                try:
                    self.frontend_proc.kill()
                except Exception:
                    pass
            self.frontend_proc = None

        # 2. Backend
        if self.backend_proc and self.backend_proc.poll() is None:
            try:
                self.backend_proc.terminate()
                self.backend_proc.wait(timeout=grace_period)
            except Exception:
                try:
                    self.backend_proc.kill()
                except Exception:
                    pass
            self.backend_proc = None

        # 3. Ollama (Only if launcher started it AND config says stop_when_launcher_stops)
        if self.ollama_proc and self.state.ollama_owned:
            if self.config["ollama"].get("stop_when_launcher_stops", False):
                try:
                    self.ollama_proc.terminate()
                    self.ollama_proc.wait(timeout=grace_period)
                except Exception:
                    try:
                        self.ollama_proc.kill()
                    except Exception:
                        pass
            self.ollama_proc = None

        # 4. Close log handles
        for lf in (self.backend_log_file, self.frontend_log_file, self.ollama_log_file):
            if lf and not lf.closed:
                try:
                    lf.close()
                except Exception:
                    pass

        # 5. Stop Control Server
        if self.control_server:
            self.control_server.stop()
            self.control_server = None

        # 6. Close Job Object & Release Lock
        self.job_group.close()
        self._clear_instance_state()
        self.single_lock.release()
        print("[OK] All launcher-owned services stopped cleanly.")

    # -------------------------------------------------------------------------
    # State Helpers
    # -------------------------------------------------------------------------

    def _write_instance_state(self) -> None:
        try:
            with open(self.config_mgr.instance_file, "w", encoding="utf-8") as f:
                json.dump(asdict(self.state), f, indent=2)
        except Exception as exc:
            self.logger.warning("launcher.write_state_failed err=%s", exc)

    def _clear_instance_state(self) -> None:
        try:
            if self.config_mgr.instance_file.is_file():
                self.config_mgr.instance_file.unlink()
        except Exception:
            pass

    def _check_existing_instance(self) -> Optional[Dict[str, Any]]:
        if not self.config_mgr.instance_file.is_file():
            return None
        try:
            with open(self.config_mgr.instance_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            port = data.get("control_port")
            token = data.get("control_token")
            if port and token:
                req = urllib.request.Request(
                    f"http://127.0.0.1:{port}/status",
                    headers={"Authorization": f"Bearer {token}"},
                )
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    if resp.status == 200:
                        return data
        except Exception:
            pass
        return None

    def _reconcile_stale_instance(self) -> None:
        if not self.config_mgr.instance_file.is_file():
            return
        try:
            with open(self.config_mgr.instance_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Verify and terminate lingering verified processes
            if psutil:
                for key in ("backend_pid", "frontend_pid"):
                    pid = data.get(key)
                    if pid and psutil.pid_exists(pid):
                        try:
                            p = psutil.Process(pid)
                            if "syllabus" in " ".join(p.cmdline()).lower() or "uvicorn" in p.name().lower():
                                p.terminate()
                                p.wait(timeout=2)
                        except Exception:
                            pass
        except Exception:
            pass
        finally:
            self._clear_instance_state()

    def get_status_snapshot(self) -> Dict[str, Any]:
        backend_ok, _, _ = HealthProbe.check_http(
            f"{self.state.backend_url}{self.config['backend'].get('health_path', '/api/health')}",
            timeout=1.0,
        )
        frontend_ok, _, _ = HealthProbe.check_http(self.state.frontend_url, timeout=1.0)
        ollama_ok = self._is_ollama_ready()

        return {
            "supervisor": {
                "status": "RUNNING",
                "pid": os.getpid(),
                "started_at": self.state.started_at,
            },
            "backend": {
                "status": "READY" if backend_ok else ("STARTING" if self.backend_proc else "STOPPED"),
                "pid": self.state.backend_pid,
                "url": self.state.backend_url,
            },
            "frontend": {
                "status": "READY" if frontend_ok else ("STARTING" if self.frontend_proc else "STOPPED"),
                "pid": self.state.frontend_pid,
                "url": self.state.frontend_url,
            },
            "ollama": {
                "status": "AVAILABLE" if ollama_ok else "NOT_RUNNING",
                "owned": self.state.ollama_owned,
                "pid": self.state.ollama_pid,
                "url": self.state.ollama_url,
            },
        }


# -----------------------------------------------------------------------------
# Subcommands: Stop, Status, Logs, Restart, Help
# -----------------------------------------------------------------------------

def cmd_stop(config_mgr: ConfigManager, force: bool = False, timeout: int = 5, stop_ollama: bool = False) -> int:
    """Stops the active supervisor and its managed processes cleanly."""
    if not config_mgr.instance_file.is_file():
        print("[INFO] Syllabus Tracker is not currently running.")
        return 0

    try:
        with open(config_mgr.instance_file, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception:
        print("[INFO] No active instance state found.")
        return 0

    port = data.get("control_port")
    token = data.get("control_token")
    sup_pid = data.get("supervisor_pid")

    print(f"[STOP] Requesting shutdown from supervisor (PID {sup_pid})...")
    stopped = False

    if port and token:
        try:
            payload = json.dumps({"force": force, "stop_ollama": stop_ollama}).encode("utf-8")
            req = urllib.request.Request(
                f"http://127.0.0.1:{port}/stop",
                data=payload,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.status == 200:
                    stopped = True
        except Exception:
            pass

    # Wait for supervisor lock release
    deadline = time.time() + float(timeout)
    while time.time() < deadline:
        lock = SingleInstanceLock(config_mgr.lock_file)
        if lock.acquire():
            lock.release()
            print("[OK] Syllabus Tracker supervisor stopped successfully.")
            return 0
        time.sleep(0.3)

    if not stopped:
        # Fallback to direct process termination if supervisor was hung
        print("[WARN] Supervisor did not respond via IPC. Checking verified processes...")
        if psutil and sup_pid and psutil.pid_exists(sup_pid):
            try:
                p = psutil.Process(sup_pid)
                p.terminate()
                p.wait(timeout=3)
                print(f"[OK] Terminated supervisor process {sup_pid}.")
            except Exception as e:
                print(f"[WARN] Could not terminate PID {sup_pid}: {e}")

    try:
        if config_mgr.instance_file.is_file():
            config_mgr.instance_file.unlink()
    except Exception:
        pass

    return 0


def cmd_status(config_mgr: ConfigManager) -> int:
    """Displays comprehensive health and ownership diagnostics."""
    print("==============================================================")
    print(f"  {APP_DISPLAY_NAME} - Status")
    print("==============================================================")

    instance_data = None
    if config_mgr.instance_file.is_file():
        try:
            with open(config_mgr.instance_file, "r", encoding="utf-8-sig") as f:
                instance_data = json.load(f)
        except Exception:
            pass

    # Query supervisor control server if alive
    live_status = None
    if instance_data:
        port = instance_data.get("control_port")
        token = instance_data.get("control_token")
        if port and token:
            try:
                req = urllib.request.Request(
                    f"http://127.0.0.1:{port}/status",
                    headers={"Authorization": f"Bearer {token}"},
                )
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    if resp.status == 200:
                        live_status = json.loads(resp.read().decode())
            except Exception:
                pass

    cfg = config_mgr.config
    b_host = cfg["backend"].get("host", "127.0.0.1")
    b_port = cfg["backend"].get("port", 8000)
    b_health = cfg["backend"].get("health_path", "/api/health")
    f_host = cfg["frontend"].get("host", "127.0.0.1")
    f_port = cfg["frontend"].get("port", 5173)
    o_host = cfg["ollama"].get("host", "127.0.0.1")
    o_port = cfg["ollama"].get("port", 11434)
    o_health = cfg["ollama"].get("health_path", "/api/tags")

    # Probes
    b_ready, _, _ = HealthProbe.check_http(f"http://{b_host}:{b_port}{b_health}", timeout=1.0)
    f_ready, _, _ = HealthProbe.check_http(f"http://{f_host}:{f_port}", timeout=1.0)
    o_ready, _, _ = HealthProbe.check_http(f"http://{o_host}:{o_port}{o_health}", timeout=1.0)

    sup_status = "RUNNING" if live_status else ("STALE" if instance_data else "STOPPED")
    sup_pid = instance_data.get("supervisor_pid") if instance_data else "N/A"

    print(f"  Supervisor : {sup_status:9} (PID: {sup_pid})")
    print(f"  Backend    : {('READY' if b_ready else 'STOPPED'):9} (http://{b_host}:{b_port})")
    print(f"  Frontend   : {('READY' if f_ready else 'STOPPED'):9} (http://{f_host}:{f_port})")
    print(f"  Ollama     : {('AVAILABLE' if o_ready else 'OFFLINE'):9} (http://{o_host}:{o_port})")
    print("--------------------------------------------------------------")
    print(f"  Project Root : {config_mgr.project_root}")
    print(f"  Logs Folder  : {config_mgr.logs_dir}")
    print(f"  Config File  : {config_mgr.config_file}")
    print("==============================================================")
    return 0


def cmd_logs(config_mgr: ConfigManager, service: str = "launcher", follow: bool = False, lines: int = 100) -> int:
    """Displays or follows persistent logs for backend, frontend, ollama, or launcher."""
    valid_services = {"backend", "frontend", "ollama", "launcher"}
    svc = service.lower()
    if svc not in valid_services:
        print(f"[ERROR] Invalid service '{service}'. Choose from: {', '.join(sorted(valid_services))}", file=sys.stderr)
        return 1

    log_path = config_mgr.logs_dir / f"{svc}.log"
    if not log_path.is_file():
        print(f"[INFO] Log file for '{svc}' does not exist yet ({log_path}).")
        return 0

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
            for line in all_lines[-lines:]:
                sys.stdout.write(line)
            sys.stdout.flush()

            if follow:
                print(f"\n--- Following {svc}.log (Press Ctrl+C to exit) ---")
                while True:
                    line = f.readline()
                    if line:
                        sys.stdout.write(line)
                        sys.stdout.flush()
                    else:
                        time.sleep(0.3)
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        print(f"[ERROR] Failed to read log: {exc}", file=sys.stderr)
        return 1
    return 0


def cmd_restart(config_mgr: ConfigManager) -> int:
    """Stops services and cleanly relaunches them."""
    print("[RESTART] Stopping current Syllabus Tracker instance...")
    cmd_stop(config_mgr)
    time.sleep(1.0)
    print("[RESTART] Starting fresh instance...")
    sup = Supervisor(config_mgr)
    return sup.start()


def print_help() -> None:
    help_text = f"""
{APP_DISPLAY_NAME} (Windows 11 Global CLI)

USAGE:
    syllabus [COMMAND] [OPTIONS]

COMMANDS:
    start           Start all application services and open browser (default action)
    stop            Gracefully stop all application-owned services
    status          Inspect live health, PIDs, and service ports
    logs [SERVICE]  View persistent service logs (launcher, backend, frontend, ollama)
    restart         Stop and immediately restart application services
    help            Show this usage information

OPTIONS:
    --no-browser    Start services without launching the default browser
    --follow, -f    Stream new log entries in real-time (for 'logs' command)
    -n LINES        Number of log lines to show (default: 100)

EXAMPLES:
    syllabus                    # Starts backend & frontend, opens browser
    syllabus status             # Displays status of all services
    syllabus logs backend -f    # Tail backend Uvicorn logs in real time
    syllabus stop               # Stops all services cleanly from any terminal
"""
    print(help_text.strip())


# -----------------------------------------------------------------------------
# Main Entry Point
# -----------------------------------------------------------------------------

def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="syllabus",
        description=f"{APP_DISPLAY_NAME} (Windows 11 Global CLI)",
        add_help=False,
    )
    parser.add_argument("command", nargs="?", default="start", help="Command to execute (start, stop, status, logs, restart, help)")
    parser.add_argument("component", nargs="?", default="launcher", help="Component name for logs (backend, frontend, ollama, launcher)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser on start")
    parser.add_argument("--follow", "-f", action="store_true", help="Follow log output")
    parser.add_argument("-n", "--lines", type=int, default=100, help="Number of lines for logs")
    parser.add_argument("--force", action="store_true", help="Force stop without graceful timeout")
    parser.add_argument("--timeout", type=int, default=5, help="Graceful stop timeout in seconds")
    parser.add_argument("--stop-ollama", action="store_true", help="Also stop Ollama daemon if started by launcher")
    parser.add_argument("--help", "-h", action="store_true", help="Show help")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_cli_parser()
    args, unknown = parser.parse_known_args(argv)

    if args.help or args.command in ("help", "--help", "-h"):
        print_help()
        return 0

    valid_commands = {"start", "stop", "status", "logs", "restart", "help"}
    cmd = args.command.lower()
    if cmd not in valid_commands:
        print(f"[ERROR] Unknown command '{cmd}'.", file=sys.stderr)
        print("        Run 'syllabus help' for a list of available commands.", file=sys.stderr)
        return 1

    config_mgr = ConfigManager()

    if cmd == "start":
        sup = Supervisor(config_mgr)
        open_browser = False if args.no_browser else None
        return sup.start(open_browser=open_browser)
    elif cmd == "stop":
        return cmd_stop(config_mgr, force=args.force, timeout=args.timeout, stop_ollama=args.stop_ollama)
    elif cmd == "status":
        return cmd_status(config_mgr)
    elif cmd == "logs":
        svc = args.component if args.component and args.component != "start" else "launcher"
        return cmd_logs(config_mgr, service=svc, follow=args.follow, lines=args.lines)
    elif cmd == "restart":
        return cmd_restart(config_mgr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
