"""Unit tests for Phase 2: apps management, screenshots, reboot."""

from __future__ import annotations

import http.client
import io
import json
import os
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adb_manager import ADBManager
from dashboard_server import (
    DashboardError,
    DroidSlateBackend,
    create_dashboard_server,
)

INSTALLED = "package:com.android.settings\npackage:com.example.chat\npackage:com.android.vending\n"
KNOWN = INSTALLED + "package:com.carrier.app\n"
THIRD_PARTY = "package:com.example.chat\n"
DISABLED = "package:com.example.chat\n"


class FakeADB(ADBManager):
    """ADB stub: canned pm list output, recorded command shapes."""

    def __init__(self):
        super().__init__(adb_path="adb")
        self.calls: list[tuple[list[str], str | None]] = []
        self.install_result = {"success": True, "stdout": "Success\n", "stderr": "", "returncode": 0}
        self.uninstall_result = {"success": True, "stdout": "Success\n", "stderr": "", "returncode": 0}
        self.reinstall_result = {"success": True, "stdout": "Success\n", "stderr": "", "returncode": 0}
        self.enable_result = {"success": True, "stdout": "", "stderr": "", "returncode": 0}
        self.reboot_result = {"success": True, "stdout": "", "stderr": "", "returncode": 0}
        self.screenshot_bytes = b"\x89PNG-fake"
        self.screenshot_error: str | None = None

    def run(self, args, *, serial=None, timeout=30):
        self.calls.append((list(args), serial))
        if args[:4] == ["shell", "pm", "list", "packages"]:
            flags = set(args[4:])
            if flags == set():
                output = INSTALLED
            elif flags == {"-u"}:
                output = KNOWN
            elif flags == {"-3"}:
                output = THIRD_PARTY
            elif flags == {"-d"}:
                output = DISABLED
            else:
                output = ""
            return {"success": True, "stdout": output, "stderr": "", "returncode": 0}
        if args[:1] == ["install"]:
            return dict(self.install_result)
        if args[:2] == ["uninstall", "--user"]:
            return dict(self.uninstall_result)
        if args[:1] == ["uninstall"]:
            return dict(self.uninstall_result)
        if args[:3] == ["shell", "pm", "install-existing"]:
            return dict(self.reinstall_result)
        if args[:3] in (["shell", "pm", "enable"], ["shell", "pm", "disable-user"]):
            return dict(self.enable_result)
        if args[:1] == ["reboot"]:
            return dict(self.reboot_result)
        return {"success": True, "stdout": "", "stderr": "", "returncode": 0}

    def screenshot(self, serial, out_path, *, timeout=60):
        if self.screenshot_error:
            return {"success": False, "stderr": self.screenshot_error}
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "wb") as handle:
            handle.write(self.screenshot_bytes)
        return {"success": True, "path": out_path}


class AppsBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)
        self.backend._settings["selected_device"] = "emulator-5554"

    def test_list_apps_classifies_packages(self):
        result = self.backend.list_apps()
        self.assertEqual(result["device"], "emulator-5554")
        by_name = {app["name"]: app for app in result["apps"]}
        self.assertEqual(set(by_name), {
            "com.android.settings", "com.example.chat", "com.android.vending", "com.carrier.app",
        })
        self.assertTrue(by_name["com.android.settings"]["system"])
        self.assertTrue(by_name["com.android.settings"]["installed"])
        self.assertFalse(by_name["com.android.settings"]["disabled"])
        self.assertFalse(by_name["com.example.chat"]["system"])
        self.assertTrue(by_name["com.example.chat"]["disabled"])
        self.assertFalse(by_name["com.carrier.app"]["installed"])

    def test_list_apps_requires_device(self):
        self.backend._settings["selected_device"] = ""
        with self.assertRaises(DashboardError) as ctx:
            self.backend.list_apps()
        self.assertEqual(ctx.exception.status, 409)

    def test_package_name_validation(self):
        for bad in (None, "", "rm -rf /", "a b", "x" * 300, "--user", ["com.a"]):
            with self.assertRaises(DashboardError):
                self.backend.uninstall_app({"package": bad})

    def test_uninstall_success_and_failure(self):
        result = self.backend.uninstall_app({"package": "com.example.chat"})
        self.assertTrue(result["ok"])
        self.assertEqual(self.adb.calls[-1][0][0], "uninstall")

        self.adb.uninstall_result = {"success": False, "stdout": "Failure [DELETE_FAILED]",
                                     "stderr": "", "returncode": 1}
        with self.assertRaises(DashboardError):
            self.backend.uninstall_app({"package": "com.example.chat"})

    def test_reinstall_uses_install_existing(self):
        self.backend.reinstall_app({"package": "com.android.settings"})
        self.assertEqual(self.adb.calls[-1][0],
                         ["shell", "pm", "install-existing", "--user", "0", "com.android.settings"])

    def test_set_app_enabled_requires_bool(self):
        with self.assertRaises(DashboardError):
            self.backend.set_app_enabled({"package": "com.a", "enabled": "yes"})
        self.backend.set_app_enabled({"package": "com.a", "enabled": False})
        self.assertEqual(self.adb.calls[-1][0][:4], ["shell", "pm", "disable-user", "--user"])

    def test_reboot_mode_validation(self):
        with self.assertRaises(DashboardError):
            self.backend.reboot_device({"mode": "safe-mode"})
        result = self.backend.reboot_device({"mode": "bootloader"})
        self.assertTrue(result["ok"])
        self.assertEqual(self.adb.calls[-1][0], ["reboot", "bootloader"])


class StagingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)
        self.backend._settings["selected_device"] = "emulator-5554"
        self.stage_dir = self.backend._stage_dir

    def stage(self, name, data):
        return self.backend.stage_apk(name, io.BytesIO(data), len(data))

    def test_stage_stores_file(self):
        result = self.stage("base.apk", b"APKDATA")
        self.assertEqual(result, {"name": "base.apk", "size": 7})
        with open(os.path.join(self.stage_dir, "base.apk"), "rb") as handle:
            self.assertEqual(handle.read(), b"APKDATA")

    def test_stage_rejects_bad_names(self):
        for name in ("../evil.apk", "sub/dir.apk", "not-an-apk.txt", "x" * 300 + ".apk",
                     "bad:name.apk", "", None, 42):
            with self.assertRaises(DashboardError):
                self.backend.stage_apk(name, io.BytesIO(b"x"), 1)
        self.assertEqual(os.listdir(self.stage_dir), [])

    def test_stage_rejects_oversize_and_empty(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.stage_apk("big.apk", io.BytesIO(b"x"), 3 * 1024 ** 3)
        self.assertEqual(ctx.exception.status, 413)
        with self.assertRaises(DashboardError):
            self.backend.stage_apk("empty.apk", io.BytesIO(b""), 0)

    def test_stage_rejects_truncated_body(self):
        with self.assertRaises(DashboardError):
            self.backend.stage_apk("short.apk", io.BytesIO(b"abc"), 100)
        self.assertEqual(os.listdir(self.stage_dir), [])

    def test_install_single_uses_install_r(self):
        self.stage("one.apk", b"data")
        result = self.backend.install_staged({"files": ["one.apk"]})
        self.assertTrue(result["ok"])
        self.assertEqual(self.adb.calls[-1][0][0:2], ["install", "-r"])
        # staging is cleared after the attempt
        self.assertEqual(os.listdir(self.stage_dir), [])

    def test_install_split_uses_install_multiple(self):
        self.stage("base.apk", b"1")
        self.stage("split_config.arm64_v8a.apk", b"2")
        result = self.backend.install_staged({"files": ["base.apk", "split_config.arm64_v8a.apk"]})
        self.assertTrue(result["ok"])
        self.assertEqual(self.adb.calls[-1][0][0:2], ["install-multiple", "-r"])
        self.assertEqual(os.listdir(self.stage_dir), [])

    def test_install_requires_staged_files(self):
        with self.assertRaises(DashboardError):
            self.backend.install_staged({"files": []})
        with self.assertRaises(DashboardError):
            self.backend.install_staged({"files": ["ghost.apk"]})

    def test_install_failure_raises_with_detail(self):
        self.stage("bad.apk", b"x")
        self.adb.install_result = {"success": False, "stdout": "",
                                   "stderr": "Failure [INSTALL_FAILED_OLDFORM]",
                                   "returncode": 1}
        with self.assertRaises(DashboardError) as ctx:
            self.backend.install_staged({"files": ["bad.apk"]})
        self.assertIn("INSTALL_FAILED_OLDFORM", str(ctx.exception))
        self.assertEqual(os.listdir(self.stage_dir), [])

    def test_stage_dir_cleared_on_backend_restart(self):
        self.stage("leftover.apk", b"x")
        backend2 = DroidSlateBackend(self.tmp.name, adb=FakeADB())
        try:
            self.assertEqual(os.listdir(backend2._stage_dir), [])
        finally:
            backend2.close()


class ScreenshotRebootTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)
        self.backend._settings["selected_device"] = "emulator-5554"

    def test_take_screenshot_saves_and_returns_url(self):
        result = self.backend.take_screenshot()
        self.assertRegex(result["name"], r"^screenshot_\d{8}_\d{6}(_\d+)?\.png$")
        self.assertEqual(result["url"], f"/shots/{result['name']}")
        self.assertTrue(os.path.isfile(result["path"]))
        with open(result["path"], "rb") as handle:
            self.assertEqual(handle.read(), b"\x89PNG-fake")

    def test_take_screenshot_collision_gets_suffix(self):
        from unittest import mock

        with mock.patch("dashboard_server.time") as fake_time:
            fake_time.strftime.return_value = "screenshot_20260101_120000"
            fake_time.monotonic.return_value = 100.0
            first = self.backend.take_screenshot()
            second = self.backend.take_screenshot()
        self.assertEqual(first["name"], "screenshot_20260101_120000.png")
        self.assertEqual(second["name"], "screenshot_20260101_120000_2.png")
        self.assertTrue(os.path.isfile(first["path"]))
        self.assertTrue(os.path.isfile(second["path"]))

    def test_take_screenshot_failure_raises(self):
        self.adb.screenshot_error = "device offline"
        with self.assertRaises(DashboardError):
            self.backend.take_screenshot()

    def test_latest_screenshot_none_then_found(self):
        self.assertEqual(self.backend.latest_screenshot(), {"none": True})
        shot = self.backend.take_screenshot()
        latest = self.backend.latest_screenshot()
        self.assertEqual(latest["name"], shot["name"])

    def test_shot_file_validates_names(self):
        shot = self.backend.take_screenshot()
        self.assertIsNotNone(self.backend.shot_file(shot["name"]))
        self.assertIsNone(self.backend.shot_file("../settings.json"))
        self.assertIsNone(self.backend.shot_file("evil.png"))
        self.assertIsNone(self.backend.shot_file("screenshot_20260101_120000.png"))  # does not exist

    def test_open_folder_not_supported_off_windows(self):
        if hasattr(os, "startfile"):
            self.skipTest("Windows host")
        with self.assertRaises(DashboardError):
            self.backend.open_screenshots_folder()


class ShotsHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        assets = os.path.join(cls.tmp.name, "assets")
        os.makedirs(assets, exist_ok=True)
        with open(os.path.join(assets, "index.html"), "w", encoding="utf-8") as handle:
            handle.write("<!doctype html><title>DroidSlate</title>")
        cls.assets = assets

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def setUp(self):
        self.data_tmp = tempfile.TemporaryDirectory()
        self.backend = DroidSlateBackend(self.data_tmp.name, adb=FakeADB())
        self.backend._settings["selected_device"] = "emulator-5554"
        self.server, self.token = create_dashboard_server(self.backend, self.assets)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.backend.close()
        self.data_tmp.cleanup()

    def request(self, method, path, *, headers=None, body=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        payload = response.read()
        headers_out = dict(response.getheaders())
        connection.close()
        return response.status, payload, headers_out

    def session_cookie(self) -> str:
        status, _, _ = self.request(
            "POST", "/api/v1/session",
            body="{}",
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

    def test_shot_requires_session(self):
        shot = self.backend.take_screenshot()
        status, _, _ = self.request("GET", f"/shots/{shot['name']}",
                                    headers={"Host": f"127.0.0.1:{self.port}"})
        self.assertEqual(status, 401)

    def test_shot_serves_png_with_session(self):
        shot = self.backend.take_screenshot()
        cookie = self.session_cookie()
        status, payload, headers = self.request(
            "GET", f"/shots/{shot['name']}",
            headers={"Host": f"127.0.0.1:{self.port}", "Cookie": cookie},
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload, b"\x89PNG-fake")
        self.assertEqual(headers.get("Content-Type"), "image/png")
        self.assertIn("max-age", headers.get("Cache-Control", ""))

    def test_shot_traversal_and_bad_names_404(self):
        cookie = self.session_cookie()
        for path in ("/shots/../settings.json", "/shots/evil.png",
                     "/shots/..%2Fsettings.json",
                     "/shots/screenshot_20260101_120000.png"):
            status, _, _ = self.request(
                "GET", path,
                headers={"Host": f"127.0.0.1:{self.port}", "Cookie": cookie},
            )
            self.assertEqual(status, 404, path)

    def test_stage_upload_over_http(self):
        cookie = self.session_cookie()
        body = b"APK-BYTES"
        status, payload, _ = self.request(
            "POST", "/api/v1/apps/stage?name=game.apk",
            body=body,
            headers={
                "Host": f"127.0.0.1:{self.port}",
                "Cookie": cookie,
                "Origin": f"http://127.0.0.1:{self.port}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(body)),
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["name"], "game.apk")
        with open(os.path.join(self.backend._stage_dir, "game.apk"), "rb") as handle:
            self.assertEqual(handle.read(), body)

    def test_apps_list_over_http(self):
        cookie = self.session_cookie()
        status, payload, _ = self.request(
            "GET", "/api/v1/apps",
            headers={
                "Host": f"127.0.0.1:{self.port}",
                "Cookie": cookie,
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "same-origin",
                "Sec-Fetch-Dest": "empty",
            },
        )
        self.assertEqual(status, 200)
        data = json.loads(payload)
        self.assertEqual(data["device"], "emulator-5554")
        self.assertEqual(len(data["apps"]), 4)


if __name__ == "__main__":
    unittest.main()
