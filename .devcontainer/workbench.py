"""Manage the default, data-free Linux devcontainer preview without changing the server."""

from __future__ import annotations

import fcntl
import hashlib
import http.client
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "scripts" / "server.mjs"
PORT = 4173
STATE = Path("/tmp") / f"research-workbench-{os.getuid()}-{hashlib.sha256(os.fsencode(ROOT)).hexdigest()[:16]}"
TIMEOUT = 15
CHILDREN: dict[int, subprocess.Popen] = {}


def server_environment() -> dict[str, str]:
    return {key: os.environ[key] for key in ("PATH", "HOME", "LANG") if key in os.environ}


def check() -> None:
    if sys.version_info[:2] != (3, 12):
        raise RuntimeError("Python 3.12 required; rebuild the container.")
    expected = (ROOT / "scripts" / ".node-version").read_text().strip()
    actual = subprocess.check_output(
        ["node", "--version"], text=True, env=server_environment(), timeout=10
    ).strip()
    if actual != f"v{expected}":
        raise RuntimeError("Node differs from scripts/.node-version; rebuild the container.")
    print(f"Node {actual}; Python {sys.version.split()[0]}", flush=True)
    for line in (ROOT / "requirements-governance.txt").read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        name, version = line.strip().split("==")
        if importlib.metadata.version(name) != version:
            raise RuntimeError(f"{name} differs from requirements-governance.txt; rebuild the container.")
        print(f"{name}=={version}", flush=True)
    subprocess.run([sys.executable, "-m", "pip", "check"], check=True, timeout=30)


def process_identity(pid: int) -> tuple[str, list[str]] | None:
    try:
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(") ", 1)[1].split()
        if fields[0] == "Z":
            return None
        command = Path(f"/proc/{pid}/cmdline").read_bytes().rstrip(b"\0").decode().split("\0")
        return fields[19], command
    except (FileNotFoundError, ProcessLookupError):
        return None


def managed_process() -> int | None:
    try:
        record = json.loads((STATE / "process.json").read_text())
    except FileNotFoundError:
        return None
    identity = process_identity(record["pid"])
    if identity == (record["started"], [record["node"], str(SERVER), "--port", str(PORT)]):
        return record["pid"]
    return None


def ready() -> bool:
    connection = http.client.HTTPConnection("127.0.0.1", PORT, timeout=1)
    try:
        connection.request("GET", "/api/corpus")
        response = connection.getresponse()
        return response.status == 200 and response.getheader("X-Corpus-Mode") == "public-draft"
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


def stop() -> None:
    pid = managed_process()
    if pid is not None:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + 5
        while managed_process() is not None and time.monotonic() < deadline:
            time.sleep(0.1)
        if managed_process() is not None:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            deadline = time.monotonic() + 5
            while managed_process() is not None and time.monotonic() < deadline:
                time.sleep(0.1)
            if managed_process() is not None:
                raise RuntimeError("Managed workbench did not stop; inspect the log.")
        if child := CHILDREN.pop(pid, None):
            child.wait(timeout=5)
    (STATE / "process.json").unlink(missing_ok=True)
    print("Managed workbench stopped; unrelated processes were not touched.", flush=True)


def start() -> None:
    if pid := managed_process():
        if not ready():
            raise RuntimeError("Managed workbench is not ready; use restart and inspect the log.")
        print(f"Workbench already running (PID {pid}): http://127.0.0.1:{PORT}/", flush=True)
        return
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node is missing; rebuild the container.")
    log = STATE / "server.log"
    with log.open("w") as output:
        child = subprocess.Popen(
            [node, str(SERVER), "--port", str(PORT)], cwd=ROOT,
            env=server_environment(), stdin=subprocess.DEVNULL, stdout=output,
            stderr=subprocess.STDOUT, start_new_session=True,
        )
    try:
        identity = process_identity(child.pid)
        if identity is None:
            raise RuntimeError("Workbench exited before startup.")
        (STATE / "process.json").write_text(json.dumps({
            "pid": child.pid, "started": identity[0], "node": node,
        }))
        deadline = time.monotonic() + TIMEOUT
        while time.monotonic() < deadline:
            if child.poll() is not None:
                raise RuntimeError(f"Workbench exited with status {child.returncode}; check port {PORT} for another listener.")
            # The server prints this only after successfully binding its own listener.
            if f"Local workbench: http://127.0.0.1:{PORT}/" in log.read_text() and ready():
                CHILDREN[child.pid] = child
                print(f"Workbench ready (PID {child.pid}): http://127.0.0.1:{PORT}/", flush=True)
                return
            time.sleep(0.1)
        raise RuntimeError("Workbench readiness timed out.")
    except BaseException:
        if child.poll() is None:
            child.terminate()
        child.wait(timeout=5)
        (STATE / "process.json").unlink(missing_ok=True)
        print(log.read_text()[-4096:], file=sys.stderr)
        raise


def execute(action: str) -> None:
    if action == "check":
        check()
        return
    STATE.mkdir(mode=0o700, exist_ok=True)
    info = STATE.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise RuntimeError("Unsafe lifecycle state directory; expected an owned mode-0700 directory.")
    os.umask(0o077)
    with (STATE / "lifecycle.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        print(f"Workbench log: {STATE / 'server.log'}", flush=True)
        if action in {"stop", "restart"}:
            stop()
        if action in {"start", "restart"}:
            check()
            start()
        elif action == "status":
            pid = managed_process()
            if pid is None or not ready():
                raise RuntimeError("Managed workbench is stopped or not ready.")
            print(f"Workbench ready (PID {pid}): http://127.0.0.1:{PORT}/", flush=True)


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"check", "start", "stop", "restart", "status"}:
        print("Usage: python .devcontainer/workbench.py check|start|stop|restart|status", file=sys.stderr)
        return 2
    try:
        execute(sys.argv[1])
        return 0
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Workbench lifecycle failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
