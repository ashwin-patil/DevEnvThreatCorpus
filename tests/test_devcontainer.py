from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import tempfile
import unittest
from contextlib import redirect_stderr
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("workbench_lifecycle", ROOT / ".devcontainer/workbench.py")
lifecycle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lifecycle)


class DevcontainerConfigurationTests(unittest.TestCase):
    def test_ac01_ac02_build_and_lifecycle_reuse_existing_pins(self) -> None:
        config = json.loads((ROOT / ".devcontainer/devcontainer.json").read_text())
        self.assertEqual(config["build"], {"dockerfile": "Dockerfile", "context": ".."})
        self.assertEqual(config["remoteUser"], "vscode")
        self.assertTrue(config["init"])
        self.assertEqual(config["postCreateCommand"], ["python", ".devcontainer/workbench.py", "check"])
        self.assertEqual(config["postStartCommand"], ["python", ".devcontainer/workbench.py", "start"])
        self.assertEqual(config["waitFor"], "postStartCommand")
        dockerfile = (ROOT / ".devcontainer/Dockerfile").read_text()
        self.assertRegex(dockerfile, r"FROM .*python:1-3\.12-bookworm@sha256:[0-9a-f]{64}")
        self.assertIn("COPY scripts/.node-version ", dockerfile)
        self.assertIn("COPY requirements-governance.txt ", dockerfile)
        self.assertIn("sha256sum --check --strict", dockerfile)
        self.assertIn("pip install --no-cache-dir --requirement", dockerfile)
        self.assertNotIn((ROOT / "scripts/.node-version").read_text().strip(), dockerfile)
        self.assertNotIn("privileged", config)
        self.assertNotIn("capAdd", config)

    def test_ac03_only_preview_port_requested_without_data_or_credentials(self) -> None:
        config = json.loads((ROOT / ".devcontainer/devcontainer.json").read_text())
        self.assertEqual(config["forwardPorts"], [4173])
        self.assertEqual(config["portsAttributes"]["4173"], {
            "label": "Research Workbench (private)", "protocol": "http", "onAutoForward": "openBrowser",
        })
        self.assertEqual(config["otherPortsAttributes"], {"onAutoForward": "ignore"})
        self.assertNotIn("secrets", config)
        self.assertNotIn("containerEnv", config)
        self.assertEqual((ROOT / ".devcontainer/Dockerfile.dockerignore").read_text().splitlines(), [
            "**", "!scripts/", "!scripts/.node-version", "!requirements-governance.txt",
        ])
        with patch.dict(os.environ, {"GITHUB_TOKEN": "synthetic", "NODE_OPTIONS": "--inspect", "PRIVATE_STORE": "synthetic"}):
            environment = lifecycle.server_environment()
        self.assertLessEqual(set(environment), {"PATH", "HOME", "LANG"})
        self.assertNotIn("NODE_OPTIONS", environment)

    def test_ac01_runtime_mismatch_fails_visibly_before_start(self) -> None:
        with patch.object(lifecycle.subprocess, "check_output", return_value="v0.0.0\n"):
            with self.assertRaisesRegex(RuntimeError, "Node differs.*rebuild"):
                lifecycle.check()

    def test_ac01_dependency_mismatch_fails_visibly(self) -> None:
        version = (ROOT / "scripts/.node-version").read_text().strip()
        with patch.object(lifecycle.subprocess, "check_output", return_value=f"v{version}\n"):
            with patch.object(lifecycle.importlib.metadata, "version", return_value="0.0.0"):
                with self.assertRaisesRegex(RuntimeError, "requirements-governance.txt.*rebuild"):
                    lifecycle.check()

    def test_ac04_invalid_command_exits_nonzero(self) -> None:
        result = subprocess.run(
            ["python", str(ROOT / ".devcontainer/workbench.py"), "invalid"],
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("Usage:", result.stderr)


@unittest.skipUnless(os.name == "posix" and Path("/proc").is_dir(), "Linux devcontainer lifecycle")
class DevcontainerLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory(prefix="workbench lifecycle ")
        self.addCleanup(self.directory.cleanup)
        state = Path(self.directory.name) / "state"
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        patches = [
            patch.object(lifecycle, "STATE", state),
            patch.object(lifecycle, "PORT", port),
            patch.object(lifecycle, "check"),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        previous_umask = os.umask(0o077)
        self.addCleanup(os.umask, previous_umask)
        self.addCleanup(lambda: lifecycle.execute("stop"))

    def test_ac02_ac04_repeated_concurrent_start_and_restart_have_one_managed_process(self) -> None:
        with ThreadPoolExecutor(max_workers=2) as executor:
            list(executor.map(lifecycle.execute, ["start", "start"]))
        first = lifecycle.managed_process()
        self.assertIsNotNone(first)
        self.assertTrue(lifecycle.ready())
        lifecycle.execute("start")
        self.assertEqual(lifecycle.managed_process(), first)
        lifecycle.execute("status")
        lifecycle.execute("restart")
        self.assertNotEqual(lifecycle.managed_process(), first)
        self.assertIsNone(lifecycle.process_identity(first))
        self.assertTrue(lifecycle.ready())
        lifecycle.execute("stop")
        lifecycle.execute("stop")
        with self.assertRaisesRegex(RuntimeError, "stopped"):
            lifecycle.execute("status")
        lifecycle.execute("start")
        self.assertTrue(lifecycle.ready())

    def test_ac03_started_process_is_data_free_and_state_is_restricted(self) -> None:
        lifecycle.execute("start")
        record = json.loads((lifecycle.STATE / "process.json").read_text())
        self.assertEqual(lifecycle.process_identity(record["pid"])[1], [
            record["node"], str(lifecycle.SERVER), "--port", str(lifecycle.PORT),
        ])
        for name, mode in [("", 0o700), ("process.json", 0o600), ("server.log", 0o600), ("lifecycle.lock", 0o600)]:
            self.assertEqual(stat.S_IMODE((lifecycle.STATE / name).stat().st_mode), mode)

    def test_ac04_foreign_listener_failure_is_visible_and_recovery_works(self) -> None:
        errors = io.StringIO()
        with socket.socket() as occupied:
            occupied.bind(("127.0.0.1", lifecycle.PORT))
            occupied.listen()
            with redirect_stderr(errors), self.assertRaisesRegex(RuntimeError, "exited"):
                lifecycle.execute("start")
            self.assertIn("Preview server could not start.", errors.getvalue())
            self.assertIn("Preview server could not start.", (lifecycle.STATE / "server.log").read_text())
            self.assertIsNone(lifecycle.managed_process())
            self.assertGreaterEqual(occupied.fileno(), 0)
        lifecycle.execute("start")
        self.assertTrue(lifecycle.ready())

    def test_ac04_stale_identity_never_stops_unrelated_process(self) -> None:
        lifecycle.execute("start")
        owned = (lifecycle.STATE / "process.json").read_text()
        with subprocess.Popen(["sleep", "30"]) as unrelated:
            try:
                identity = lifecycle.process_identity(unrelated.pid)
                (lifecycle.STATE / "process.json").write_text(json.dumps({
                    "pid": unrelated.pid, "started": identity[0], "node": "sleep",
                }))
                self.assertIsNone(lifecycle.managed_process())
                lifecycle.execute("stop")
                self.assertIsNone(unrelated.poll())
            finally:
                unrelated.terminate()
                unrelated.wait(timeout=5)
                (lifecycle.STATE / "process.json").write_text(owned)

    def test_ac04_dead_record_recovers_and_unsafe_state_fails_closed(self) -> None:
        lifecycle.STATE.mkdir(mode=0o700)
        (lifecycle.STATE / "process.json").write_text(json.dumps({
            "pid": 99999999, "started": "0", "node": "/missing/node",
        }))
        lifecycle.execute("start")
        self.assertTrue(lifecycle.ready())
        lifecycle.execute("stop")
        lifecycle.STATE.chmod(0o755)
        try:
            with self.assertRaisesRegex(RuntimeError, "Unsafe lifecycle state"):
                lifecycle.execute("start")
        finally:
            lifecycle.STATE.chmod(0o700)


if __name__ == "__main__":
    unittest.main()
