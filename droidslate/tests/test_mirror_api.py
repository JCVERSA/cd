"""Unit tests for the Mirror (scrcpy) feature.

Covers config validation, CLI argument building (flags verified against
scrcpy v5.0.1), scrcpy discovery/version parsing, the process lifecycle
with a fake scrcpy binary (POSIX), the backend methods and the HTTP
routes.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adb_manager import ADBManager
from dashboard_server import DashboardError, DroidSlateBackend
from scrcpy_manager import (
    ScrcpyError,
    ScrcpyManager,
    build_args,
    find_scrcpy,
    normalize_config,
)


class _NoopADB(ADBManager):
    """ADB stub that never spawns a process."""

    def __init__(self):
        super().__init__(adb_path="adb")

    def run(self, args, *, serial=None, timeout=30):
        return {"success": True, "stdout": "", "stderr": "", "returncode": 0}


class ConfigTests(unittest.TestCase):
    def test_defaults(self):
        cfg = normalize_config({})
        self.assertEqual(cfg["codec"], "h264")
        self.assertTrue(cfg["audio"])
        self.assertEqual(cfg["audioCodec"], "opus")
        self.assertEqual(cfg["bitrate"], 8)
        self.assertEqual(cfg["maxSize"], 0)
        self.assertEqual(cfg["fps"], 0)
        self.assertEqual(cfg["rotation"], "0")
        self.assertFalse(cfg["record"])

    def test_validation_rejects_bad_values(self):
        for payload in (
            "nope",                       # not an object
            {"codec": "vp9"},             # v1 subset: h264/h265 only
            {"audioCodec": "mp3"},
            {"rotation": "5"},
            {"bitrate": "fast"},
            {"bitrate": 0},               # below range
            {"fps": 9999},
            {"maxSize": -1},
            {"recordPath": 42},
        ):
            with self.subTest(payload=payload):
                with self.assertRaises(ScrcpyError) as ctx:
                    normalize_config(payload)
                self.assertEqual(ctx.exception.status, 400)

    def test_none_config_is_default(self):
        self.assertEqual(normalize_config(None)["codec"], "h264")


class BuildArgsTests(unittest.TestCase):
    def test_minimal_defaults(self):
        args = build_args("emulator-5554", normalize_config({}))
        self.assertEqual(args[0:2], ["-s", "emulator-5554"])
        self.assertIn("--video-codec=h264", args)
        i = args.index("--video-bit-rate")
        self.assertEqual(args[i + 1], "8M")
        # opus is the default: only --no-audio or differing codecs are spelled out.
        self.assertNotIn("--audio-codec=opus", args)
        self.assertNotIn("--no-audio", args)
        self.assertNotIn("--max-size", args)
        self.assertNotIn("--max-fps", args)
        self.assertNotIn("--orientation", args)

    def test_full_config(self):
        cfg = normalize_config({
            "codec": "h265",
            "audio": False,
            "bitrate": 24,
            "maxSize": 1920,
            "fps": 60,
            "rotation": "2",
            "alwaysOnTop": True,
            "fullscreen": True,
            "borderless": True,
            "stayAwake": True,
            "turnScreenOff": True,
            "keepActive": True,
            "record": True,
            "recordPath": "/tmp/vids",
        })
        args = build_args("R58M12345", cfg)
        self.assertIn("--video-codec=h265", args)
        self.assertIn("--no-audio", args)
        i = args.index("--video-bit-rate")
        self.assertEqual(args[i + 1], "24M")
        self.assertEqual(args[args.index("--max-size") + 1], "1920")
        self.assertEqual(args[args.index("--max-fps") + 1], "60")
        self.assertEqual(args[args.index("--orientation") + 1], "2")
        for flag in (
            "--always-on-top", "--fullscreen", "--window-borderless",
            "--stay-awake", "--turn-screen-off", "--no-power-on", "--keep-active",
        ):
            self.assertIn(flag, args)
        record = next(a for a in args if a.startswith("--record="))
        self.assertTrue(record.endswith(".mkv"))
        self.assertIn("scrcpy_R58M12345_", record)
        self.assertTrue(record.startswith("--record=/tmp/vids" + os.sep) or
                        record.startswith("--record=/tmp/vids/"))

    def test_audio_codec_spelled_out_when_not_default(self):
        args = build_args("dev", normalize_config({"audioCodec": "aac"}))
        self.assertIn("--audio-codec=aac", args)


class DiscoveryTests(unittest.TestCase):
    def test_explicit_file(self):
        with tempfile.NamedTemporaryFile(prefix="scrcpy", delete=False) as handle:
            path = handle.name
        try:
            self.assertEqual(find_scrcpy(path), path)
        finally:
            os.unlink(path)

    def test_explicit_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            binary = os.path.join(directory, "scrcpy.exe" if sys.platform == "win32" else "scrcpy")
            with open(binary, "w", encoding="utf-8") as handle:
                handle.write("x")
            self.assertEqual(find_scrcpy(directory), binary)

    def test_not_found(self):
        with mock.patch("scrcpy_manager._bundled_roots", return_value=[]), \
             mock.patch("scrcpy_manager.shutil.which", return_value=None):
            self.assertIsNone(find_scrcpy())

    def test_version_parses_output(self):
        manager = ScrcpyManager(scrcpy_path="/nonexistent/scrcpy")
        completed = mock.Mock(stdout="scrcpy 5.0.1 (https://github.com/Genymobile/scrcpy)\n", stderr="")
        with mock.patch("scrcpy_manager.find_scrcpy", return_value="/bin/scrcpy"), \
             mock.patch("scrcpy_manager.subprocess.run", return_value=completed):
            result = manager.version()
        self.assertTrue(result["found"])
        self.assertEqual(result["version"], "5.0.1")

    def test_version_reports_missing_binary(self):
        manager = ScrcpyManager()
        with mock.patch("scrcpy_manager.find_scrcpy", return_value=None):
            result = manager.version()
        self.assertEqual(result, {"found": False, "path": None, "version": None})


@unittest.skipIf(sys.platform == "win32", "fake scrcpy is a shell script")
class LifecycleTests(unittest.TestCase):
    """Real subprocess lifecycle against a fake scrcpy (POSIX only)."""

    def setUp(self):
        self.directory = tempfile.mkdtemp(prefix="fake-scrcpy-")
        self.binary = os.path.join(self.directory, "scrcpy")
        with open(self.binary, "w", encoding="utf-8") as handle:
            handle.write("#!/bin/sh\necho \"fake scrcpy up\"\nsleep 30\n")
        os.chmod(self.binary, 0o755)
        self.manager = ScrcpyManager(scrcpy_path=self.directory)
        self.addCleanup(self.manager.shutdown)

    def test_start_status_logs_stop(self):
        result = self.manager.start("dev-1", {})
        self.assertTrue(result["ok"])
        self.assertGreater(result["pid"], 0)

        status = self.manager.status()
        self.assertTrue(status["dev-1"]["running"])

        deadline = time.time() + 5
        lines: list[str] = []
        while time.time() < deadline:
            lines = self.manager.logs("dev-1")
            if any("fake scrcpy up" in line for line in lines):
                break
            time.sleep(0.05)
        self.assertTrue(any("fake scrcpy up" in line for line in lines), lines)
        self.assertTrue(any(line.startswith("$ ") and "-s dev-1" in line for line in lines), lines)

        stopped = self.manager.stop("dev-1")
        self.assertFalse(stopped["running"])
        self.assertNotIn("dev-1", self.manager.status())
        # Idempotent: stopping again is not an error.
        self.assertFalse(self.manager.stop("dev-1")["running"])

    def test_second_start_conflicts(self):
        self.manager.start("dev-1", {})
        with self.assertRaises(ScrcpyError) as ctx:
            self.manager.start("dev-1", {})
        self.assertEqual(ctx.exception.status, 409)
        self.manager.stop("dev-1")


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.backend = DroidSlateBackend(self.tmp.name, adb=_NoopADB())
        self.addCleanup(self.backend.close)

    def test_start_without_device_is_409(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.mirror_start({})
        self.assertEqual(ctx.exception.status, 409)

    def test_start_with_bad_config_is_400(self):
        self.backend._settings["selected_device"] = "dev-1"
        with self.assertRaises(DashboardError) as ctx:
            self.backend.mirror_start({"config": {"codec": "av1"}})
        self.assertEqual(ctx.exception.status, 400)

    def test_start_without_scrcpy_is_404(self):
        self.backend._settings["selected_device"] = "dev-1"
        with mock.patch("scrcpy_manager.find_scrcpy", return_value=None):
            with self.assertRaises(DashboardError) as ctx:
                self.backend.mirror_start({})
        self.assertEqual(ctx.exception.status, 404)

    def test_status_and_logs(self):
        self.assertEqual(self.backend.mirror_status(), {"processes": {}})
        self.backend._settings["selected_device"] = "dev-1"
        logs = self.backend.mirror_logs({})
        self.assertEqual(logs, {"serial": "dev-1", "lines": []})

    def test_logs_without_device_is_409(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.mirror_logs({})
        self.assertEqual(ctx.exception.status, 409)

    def test_version_found_flag(self):
        with mock.patch("scrcpy_manager.find_scrcpy", return_value=None):
            result = self.backend.mirror_version()
        self.assertFalse(result["found"])

    @unittest.skipIf(sys.platform == "win32", "fake scrcpy is a shell script")
    def test_full_lifecycle_through_backend(self):
        directory = tempfile.mkdtemp(prefix="fake-scrcpy-")
        binary = os.path.join(directory, "scrcpy")
        with open(binary, "w", encoding="utf-8") as handle:
            handle.write("#!/bin/sh\necho up\nsleep 30\n")
        os.chmod(binary, 0o755)
        self.backend.scrcpy = ScrcpyManager(scrcpy_path=directory)
        self.backend._settings["selected_device"] = "dev-9"

        started = self.backend.mirror_start({"config": {"fps": 30}})
        self.assertTrue(started["ok"])
        status = self.backend.mirror_status()
        self.assertTrue(status["processes"]["dev-9"]["running"])
        self.backend.mirror_stop({})
        self.assertFalse(self.backend.mirror_status()["processes"].get("dev-9", {}).get("running", False))


class MirrorHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        assets = os.path.join(cls.tmp.name, "assets")
        os.makedirs(assets, exist_ok=True)
        with open(os.path.join(assets, "index.html"), "w", encoding="utf-8") as handle:
            handle.write("<!doctype html>")
        cls.assets = assets

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def setUp(self):
        from dashboard_server import create_dashboard_server
        self.data_tmp = tempfile.TemporaryDirectory()
        self.backend = DroidSlateBackend(self.data_tmp.name, adb=_NoopADB())
        self.backend._settings["selected_device"] = "dev-1"
        self.server, self.token = create_dashboard_server(self.backend, self.assets)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.port = self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.backend.close()
        self.data_tmp.cleanup()

    def request(self, method, path, *, body=None, headers=None):
        import http.client
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        payload = response.read()
        connection.close()
        return response.status, payload

    def cookie(self) -> str:
        status, _ = self.request(
            "POST", "/api/v1/session", body="{}",
            headers={
                "Host": f"127.0.0.1:{self.port}",
                "Origin": f"http://127.0.0.1:{self.port}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "Content-Length": "2",
            },
        )
        self.assertEqual(status, 200)
        return f"DroidSlateSession={self.server.session_token}"

    def post(self, path, payload, cookie):
        body = json.dumps(payload)
        return self.request("POST", path, body=body, headers={
            "Host": f"127.0.0.1:{self.port}",
            "Origin": f"http://127.0.0.1:{self.port}",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Cookie": cookie,
            "Content-Type": "application/json",
            "Content-Length": str(len(body)),
        })

    def get(self, path, cookie):
        return self.request("GET", path, headers={
            "Host": f"127.0.0.1:{self.port}",
            "Origin": f"http://127.0.0.1:{self.port}",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Cookie": cookie,
        })

    def test_version_route(self):
        cookie = self.cookie()
        with mock.patch("scrcpy_manager.find_scrcpy", return_value=None):
            status, payload = self.get("/api/v1/mirror/version", cookie)
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(payload)["found"])

    def test_start_route_validation(self):
        cookie = self.cookie()
        status, payload = self.post(
            "/api/v1/mirror/start", {"config": {"codec": "banana"}}, cookie
        )
        self.assertEqual(status, 400)
        self.assertIn("codec", json.loads(payload)["error"].lower())

    def test_start_route_without_scrcpy_is_404(self):
        cookie = self.cookie()
        with mock.patch("scrcpy_manager.find_scrcpy", return_value=None):
            status, payload = self.post("/api/v1/mirror/start", {}, cookie)
        self.assertEqual(status, 404)
        self.assertIn("scrcpy", json.loads(payload)["error"].lower())

    def test_status_and_logs_routes(self):
        cookie = self.cookie()
        status, payload = self.get("/api/v1/mirror/status", cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload), {"processes": {}})

        status, payload = self.post("/api/v1/mirror/logs", {}, cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload), {"serial": "dev-1", "lines": []})

    @unittest.skipIf(sys.platform == "win32", "fake scrcpy is a shell script")
    def test_start_status_logs_stop_over_http(self):
        directory = tempfile.mkdtemp(prefix="fake-scrcpy-")
        binary = os.path.join(directory, "scrcpy")
        with open(binary, "w", encoding="utf-8") as handle:
            handle.write("#!/bin/sh\necho \"http fake up\"\nsleep 30\n")
        os.chmod(binary, 0o755)
        self.backend.scrcpy = ScrcpyManager(scrcpy_path=directory)
        cookie = self.cookie()

        status, payload = self.post("/api/v1/mirror/start", {"config": {}}, cookie)
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(payload)["ok"])

        status, payload = self.get("/api/v1/mirror/status", cookie)
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(payload)["processes"]["dev-1"]["running"])

        deadline = time.time() + 5
        lines: list[str] = []
        while time.time() < deadline:
            status, payload = self.post("/api/v1/mirror/logs", {}, cookie)
            lines = json.loads(payload)["lines"]
            if any("http fake up" in line for line in lines):
                break
            time.sleep(0.05)
        self.assertTrue(any("http fake up" in line for line in lines), lines)

        status, payload = self.post("/api/v1/mirror/stop", {}, cookie)
        self.assertEqual(status, 200)
        status, payload = self.get("/api/v1/mirror/status", cookie)
        self.assertNotIn("dev-1", json.loads(payload)["processes"])


if __name__ == "__main__":
    unittest.main()
