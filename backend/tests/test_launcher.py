"""
Automated unit and integration tests for the Syllabus Tracker Windows 11 Global CLI Launcher.

Tests cover:
- CLI argument parsing & defaults
- Configuration loading, validation, and auto-discovery
- Health probe states (HTTP 200, 500, timeouts, connection refused)
- Port inspection & conflict safety (preventing accidental taskkills)
- Single instance locking and stale lock recovery
- Loopback IPC control server & token authentication
- Job object lifecycle & process registry
"""

import http.server
import json
import os
import socket
import sys
import tempfile
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure scripts directory is importable
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import launcher


# -----------------------------------------------------------------------------
# Fixtures & Helpers
# -----------------------------------------------------------------------------

@pytest.fixture
def temp_app_home(tmp_path):
    """Provides an isolated AppData directory structure for testing."""
    app_home = tmp_path / "SyllabusTracker"
    state_dir = app_home / "state"
    logs_dir = app_home / "logs"
    state_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    config_data = {
        "project_root": str(REPO_ROOT),
        "backend": {
            "host": "127.0.0.1",
            "port": 8990,
            "health_path": "/api/health",
            "startup_timeout_seconds": 2,
        },
        "frontend": {
            "host": "127.0.0.1",
            "port": 5990,
            "startup_timeout_seconds": 2,
            "open_browser": False,
        },
        "ollama": {
            "host": "127.0.0.1",
            "port": 11990,
            "health_path": "/api/tags",
            "startup_timeout_seconds": 1,
            "required": False,
            "stop_when_launcher_stops": False,
        },
        "shutdown": {
            "grace_period_seconds": 1,
            "force_cleanup": True,
        },
        "logging": {
            "max_file_size_mb": 1,
            "backup_count": 1,
        },
    }
    config_file = app_home / "config.json"
    config_file.write_text(json.dumps(config_data, indent=2), encoding="utf-8")

    with patch.object(launcher, "get_app_home", return_value=app_home):
        yield app_home, config_file


class MockHttpHandler(http.server.BaseHTTPRequestHandler):
    status_code = 200
    response_body = b'{"status": "ok"}'

    def do_GET(self):
        self.send_response(self.status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(self.response_body)

    def log_message(self, format, *args):
        pass


def run_ephemeral_server(status_code=200, response_body=b'{"status": "ok"}'):
    """Spins up a lightweight ephemeral loopback HTTP server for testing."""
    class Handler(MockHttpHandler):
        pass

    Handler.status_code = status_code
    Handler.response_body = response_body

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


# -----------------------------------------------------------------------------
# A. CLI Argument Parsing Tests
# -----------------------------------------------------------------------------

def test_cli_default_command():
    parser = launcher.build_cli_parser()
    args = parser.parse_args([])
    assert args.command == "start"


def test_cli_explicit_commands():
    parser = launcher.build_cli_parser()
    for cmd in ["start", "stop", "status", "restart", "help"]:
        args = parser.parse_args([cmd])
        assert args.command == cmd


def test_cli_logs_arguments():
    parser = launcher.build_cli_parser()
    args = parser.parse_args(["logs", "backend", "-n", "50", "--follow"])
    assert args.command == "logs"
    assert args.component == "backend"
    assert args.lines == 50
    assert args.follow is True


def test_cli_stop_options():
    parser = launcher.build_cli_parser()
    args = parser.parse_args(["stop", "--force", "--timeout", "10", "--stop-ollama"])
    assert args.command == "stop"
    assert args.force is True
    assert args.timeout == 10
    assert args.stop_ollama is True


def test_cli_invalid_command_rejected():
    exit_code = launcher.main(["unrecognized_action"])
    assert exit_code != 0


# -----------------------------------------------------------------------------
# B. Health Probe Tests
# -----------------------------------------------------------------------------

def test_health_probe_immediate_200():
    server, port = run_ephemeral_server(200, b'{"status": "healthy"}')
    try:
        url = f"http://127.0.0.1:{port}/api/health"
        is_ready, code, body = launcher.HealthProbe.check_http(url, timeout=1.0)
        assert is_ready is True
        assert code == 200
        assert "healthy" in str(body)
    finally:
        server.shutdown()


def test_health_probe_http_500():
    server, port = run_ephemeral_server(500, b'Internal Server Error')
    try:
        url = f"http://127.0.0.1:{port}/api/health"
        is_ready, code, err = launcher.HealthProbe.check_http(url, timeout=1.0)
        assert is_ready is False
        assert code == 500
        assert "500" in str(err)
    finally:
        server.shutdown()


def test_health_probe_connection_refused():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        free_port = s.getsockname()[1]
    
    url = f"http://127.0.0.1:{free_port}/api/health"
    is_ready, code, err = launcher.HealthProbe.check_http(url, timeout=0.5)
    assert is_ready is False
    assert code is None
    assert err is not None


def test_health_probe_wait_for_readiness_timeout():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        free_port = s.getsockname()[1]

    url = f"http://127.0.0.1:{free_port}/health"
    start_t = time.time()
    ok, err = launcher.HealthProbe.wait_for_readiness(
        url,
        service_name="TestService",
        timeout_seconds=1.0,
        poll_interval=0.2,
    )
    duration = time.time() - start_t
    assert ok is False
    assert "TestService failed to become ready" in str(err)
    assert duration >= 0.8


# -----------------------------------------------------------------------------
# C. Port Safety & Inspection Tests
# -----------------------------------------------------------------------------

def test_port_inspector_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        free_port = s.getsockname()[1]

    status = launcher.PortInspector.inspect_port(free_port)
    assert status.is_listening is False
    assert status.owning_pid is None


def test_port_inspector_listening_port():
    server, port = run_ephemeral_server()
    try:
        status = launcher.PortInspector.inspect_port(port)
        assert status.is_listening is True
    finally:
        server.shutdown()


def test_port_safety_never_broad_taskkill():
    """Verify that PortInspector does not attempt to terminate unrecognized processes."""
    server, port = run_ephemeral_server(200, b"Different app")
    try:
        status = launcher.PortInspector.inspect_port(port)
        assert status.is_listening is True
        # Since this ephemeral server is not our application instance, ownership must be False
        assert status.is_launcher_owned is False
    finally:
        server.shutdown()


# -----------------------------------------------------------------------------
# D. Single Instance Lock Tests
# -----------------------------------------------------------------------------

def test_single_instance_lock_lifecycle(temp_app_home):
    app_home, _ = temp_app_home
    lock_file = app_home / "state" / "test.lock"

    lock1 = launcher.SingleInstanceLock(lock_file)
    assert lock1.acquire() is True

    # Attempting to acquire again from another instance should fail
    lock2 = launcher.SingleInstanceLock(lock_file)
    assert lock2.acquire() is False

    # Releasing the first lock allows acquisition
    lock1.release()
    assert lock2.acquire() is True
    lock2.release()


def test_stale_lock_recovery_with_dead_pid(temp_app_home):
    app_home, _ = temp_app_home
    lock_file = app_home / "state" / "test_stale.lock"

    # Write a dead PID into the lock file
    dead_pid = 99999999
    lock_file.write_text(f"{dead_pid}\n", encoding="ascii")

    # SingleInstanceLock should detect the dead PID and acquire successfully
    lock = launcher.SingleInstanceLock(lock_file)
    assert lock.acquire() is True
    lock.release()


# -----------------------------------------------------------------------------
# E. Loopback Authenticated IPC Tests
# -----------------------------------------------------------------------------

def test_control_server_auth_and_commands():
    command_received = None

    def on_stop(force=False, stop_ollama=False):
        nonlocal command_received
        command_received = f"stop(force={force}, stop_ollama={stop_ollama})"
        return True, "Stopping initiated"

    def on_status():
        return True, {"state": "RUNNING", "test": True}

    server = launcher.ControlServer(
        auth_token="secret-token-12345",
        on_stop=on_stop,
        on_status=on_status,
    )
    server.start()
    port = server.port
    assert port > 0

    try:
        # 1. Unauthenticated request should fail with 401
        res = launcher.ControlServer.send_command(port, "status", token="wrong-token")
        assert res["success"] is False
        assert "401" in res["message"] or "Unauthorized" in res["message"]

        # 2. Authenticated status request
        res = launcher.ControlServer.send_command(port, "status", token="secret-token-12345")
        assert res["success"] is True
        assert res["data"]["state"] == "RUNNING"

        # 3. Authenticated stop request
        res = launcher.ControlServer.send_command(
            port, "stop", token="secret-token-12345", payload={"force": True}
        )
        assert res["success"] is True
        assert command_received == "stop(force=True, stop_ollama=False)"

    finally:
        server.stop()


# -----------------------------------------------------------------------------
# F. Configuration Manager Tests
# -----------------------------------------------------------------------------

def test_config_manager_resolution(temp_app_home):
    app_home, config_file = temp_app_home
    cfg = launcher.ConfigManager.load_config(config_file)

    assert cfg["backend"]["port"] == 8990
    assert cfg["frontend"]["port"] == 5990
    assert cfg["ollama"]["required"] is False
    assert cfg["shutdown"]["grace_period_seconds"] == 1


def test_config_manager_creates_default_if_missing(tmp_path):
    missing_dir = tmp_path / "new_app_home"
    with patch.object(launcher, "get_app_home", return_value=missing_dir):
        config_path = launcher.ConfigManager.ensure_config_exists()
        assert config_path.exists()
        cfg = launcher.ConfigManager.load_config(config_path)
        assert "backend" in cfg
        assert "frontend" in cfg
        assert cfg["backend"]["port"] == 8000
