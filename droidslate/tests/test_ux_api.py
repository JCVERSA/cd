"""Unit tests for the UX pack: adb update check, diagnostics report, file drop.

Covers the platform-tools index parser, the updates/diagnostics backend
methods and HTTP routes, plus the global drag & drop push endpoint.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adb_manager import ADBManager
from dashboard_server import (
    DashboardError,
    DroidSlateBackend,
    parse_platform_tools_version,
)

VERSION_OUTPUT = (
    "Android Debug Bridge version 1.0.41\n"
    "Version 35.0.4-12147458\n"
    "Running on Windows 11 (10.0.26100)\n"
)

INDEX_XML = """<?xml version="1.0" encoding="UTF-8"?>
<repository>
  <remotePackage path="platform-tools">
    <type>REVISION</type>
    <previousRevision>
      <major>35</major>
      <minor>0</minor>
      <micro>4</micro>
    </previousRevision>
    <revision>
      <major>35</major>
      <minor>0</minor>
      <micro>5</micro>
    </revision>
    <display-name>Android SDK Platform-Tools</display-name>
  </remotePackage>
  <remotePackage path="emulator">
    <revision>
      <major>36</major>
      <minor>1</minor>
      <micro>0</micro>
    </revision>
  </remotePackage>
</repository>
"""


class FakeADB(ADBManager):
    def __init__(self):
        super().__init__(adb_path="adb")
        self.calls: list[list[str]] = []
        self.version_output = VERSION_OUTPUT
        self.push_state = ("success", "1 file pushed")

    def run(self, args, *, serial=None, timeout=30):
        self.calls.append(list(args))
        state, output = "success", ""
        if args[:1] == ["version"]:
            output = self.version_output
        elif args[:1] == ["push"]:
            state, output = self.push_state
        return {
            "success": state == "success",
            "stdout": output,
            "stderr": "",
            "returncode": 0 if state == "success" else 1,
        }


class PlatformToolsParserTests(unittest.TestCase):
    def test_parses_revision_and_ignores_previous_and_other_packages(self):
        self.assertEqual(parse_platform_tools_version(INDEX_XML), "35.0.5")

    def test_missing_minor_and_micro_default_to_zero(self):
        xml = (
            '<remotePackage path="platform-tools">'
            "<revision><major>36</major></revision>"
            "</remotePackage>"
        )
        self.assertEqual(parse_platform_tools_version(xml), "36.0.0")

    def test_unknown_layout_returns_none(self):
        self.assertIsNone(parse_platform_tools_version("<repository/>"))
        self.assertIsNone(
            parse_platform_tools_version(
                '<remotePackage path="platform-tools"><type>X</type></remotePackage>'
            )
        )


class UpdatesBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)

    def test_update_available_when_latest_is_newer(self):
        with mock.patch(
            "dashboard_server._fetch_platform_tools_index", return_value=INDEX_XML
        ):
            result = self.backend.updates_adb({})
        self.assertEqual(result["localVersion"], "35.0.4")
        self.assertEqual(result["latestVersion"], "35.0.5")
        self.assertTrue(result["updateAvailable"])
        self.assertEqual(result["error"], "")
        self.assertIn("platform-tools", result["url"])

    def test_up_to_date_and_older_latest(self):
        with mock.patch(
            "dashboard_server._fetch_platform_tools_index", return_value=INDEX_XML
        ):
            self.adb.version_output = VERSION_OUTPUT.replace("35.0.4", "35.0.5")
            self.assertFalse(self.backend.updates_adb({})["updateAvailable"])
            self.adb.version_output = VERSION_OUTPUT.replace("35.0.4", "36.0.1")
            self.assertFalse(self.backend.updates_adb({})["updateAvailable"])

    def test_network_failure_degrades_gracefully(self):
        with mock.patch(
            "dashboard_server._fetch_platform_tools_index",
            side_effect=OSError("no route to host"),
        ):
            result = self.backend.updates_adb({})
        self.assertIsNone(result["latestVersion"])
        self.assertFalse(result["updateAvailable"])
        self.assertIn("no route", result["error"])

    def test_local_version_missing_is_not_an_error(self):
        self.adb.version_output = "Android Debug Bridge version 1.0.41\n"
        with mock.patch(
            "dashboard_server._fetch_platform_tools_index", return_value=INDEX_XML
        ):
            result = self.backend.updates_adb({})
        self.assertIsNone(result["localVersion"])
        self.assertFalse(result["updateAvailable"])
        self.assertEqual(result["error"], "")


class DiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)

    def test_report_contains_core_fields_and_truncated_logs(self):
        self.backend._settings["selected_device"] = "emulator-5554"
        self.backend.log("INFO", "SHELL", "x" * 1000)
        for index in range(60):
            self.backend.log("INFO", "LOGCAT", f"line {index}")
        report = self.backend.diagnostics_report({})["report"]
        self.assertEqual(report["app"], "DroidSlate")
        self.assertEqual(report["selectedDevice"], "emulator-5554")
        self.assertEqual(report["adbPlatformTools"], "35.0.4")
        self.assertTrue(report["adbFound"])
        self.assertLessEqual(len(report["recentLogs"]), 50)
        for record in report["recentLogs"]:
            self.assertLessEqual(len(record["message"]), 301)
        # no settings secrets leak into the report
        self.assertNotIn("settings", report)
        self.assertNotIn("token", json.dumps(report).lower().replace("logcat", ""))

    def test_save_requires_a_report_and_windows_dialogs(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.diagnostics_save({"report": {}})
        self.assertEqual(ctx.exception.status, 400)
        if not os.sys.platform == "win32":
            with self.assertRaises(DashboardError) as ctx:
                self.backend.diagnostics_save({"report": {"app": "DroidSlate"}})
            self.assertEqual(ctx.exception.status, 501)

    def test_save_writes_json_through_the_dialog(self):
        target = os.path.join(self.tmp.name, "report.json")
        with mock.patch("dashboard_server.dialogs_supported", return_value=True), \
                mock.patch("dashboard_server.pick_save_path", return_value=target):
            result = self.backend.diagnostics_save({"report": {"app": "DroidSlate"}})
        self.assertEqual(result, {"ok": True, "path": target})
        with open(target, encoding="utf-8") as handle:
            self.assertEqual(json.load(handle)["app"], "DroidSlate")

    def test_save_cancelled_returns_flag(self):
        with mock.patch("dashboard_server.dialogs_supported", return_value=True), \
                mock.patch("dashboard_server.pick_save_path", return_value=None):
            result = self.backend.diagnostics_save({"report": {"app": "DroidSlate"}})
        self.assertEqual(result, {"cancelled": True})


class FileDropTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)

    def test_drop_pushes_to_download_and_cleans_stage(self):
        import io

        self.backend._settings["selected_device"] = "emulator-5554"
        result = self.backend.file_drop("notes.txt", io.BytesIO(b"hello"), 5)
        self.assertEqual(result["path"], "/sdcard/Download/notes.txt")
        self.assertTrue(result["ok"])
        self.assertEqual(self.adb.calls[-1][:1], ["push"])
        self.assertIn("/sdcard/Download/notes.txt", self.adb.calls[-1])
        # staged temp file is removed after the push
        staged = os.listdir(self.backend._stage_dir)
        self.assertEqual(staged, [])

    def test_drop_rejects_unsafe_names(self):
        import io

        for bad in (None, "", "../evil.txt", "a/b.txt", "a\\b.txt", "x" * 300):
            with self.assertRaises(DashboardError) as ctx:
                self.backend.file_drop(bad, io.BytesIO(b"x"), 1)
            self.assertEqual(ctx.exception.status, 400, bad)

    def test_drop_requires_device(self):
        import io

        with self.assertRaises(DashboardError) as ctx:
            self.backend.file_drop("notes.txt", io.BytesIO(b"hello"), 5)
        self.assertEqual(ctx.exception.status, 409)

    def test_drop_push_failure_is_500_and_still_cleans_stage(self):
        import io

        self.backend._settings["selected_device"] = "emulator-5554"
        self.adb.push_state = ("failure", "remote couldn't create file")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.file_drop("notes.txt", io.BytesIO(b"hello"), 5)
        self.assertEqual(ctx.exception.status, 500)
        self.assertIn("couldn't", str(ctx.exception))
        self.assertEqual(os.listdir(self.backend._stage_dir), [])


class UxHTTPTests(unittest.TestCase):
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
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.data_tmp.name, adb=self.adb)
        self.backend._settings["selected_device"] = "emulator-5554"
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
            "Cookie": cookie,
            "Origin": f"http://127.0.0.1:{self.port}",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Content-Type": "application/json",
            "Content-Length": str(len(body)),
        })

    def raw_post(self, path, data, cookie, *, content_type="application/octet-stream"):
        return self.request("POST", path, body=data, headers={
            "Host": f"127.0.0.1:{self.port}",
            "Cookie": cookie,
            "Origin": f"http://127.0.0.1:{self.port}",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Content-Type": content_type,
            "Content-Length": str(len(data)),
        })

    def test_updates_and_diagnostics_routes(self):
        cookie = self.cookie()
        with mock.patch(
            "dashboard_server._fetch_platform_tools_index", return_value=INDEX_XML
        ):
            status, payload = self.post("/api/v1/updates/adb", {}, cookie)
        self.assertEqual(status, 200)
        body = json.loads(payload)
        self.assertEqual(body["latestVersion"], "35.0.5")
        self.assertTrue(body["updateAvailable"])

        status, payload = self.post("/api/v1/diagnostics/report", {}, cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["report"]["app"], "DroidSlate")

        with mock.patch("dashboard_server.dialogs_supported", return_value=False):
            status, payload = self.post(
                "/api/v1/diagnostics/save", {"report": {"app": "DroidSlate"}}, cookie
            )
        # Forced no-Windows path: on a real Win32 runner this would open a
        # native save dialog and block CI.
        self.assertEqual(status, 501)
        self.assertIn("Windows", json.loads(payload)["error"])

    def test_drop_route_pushes_file(self):
        cookie = self.cookie()
        status, payload = self.raw_post(
            "/api/v1/files/drop?name=notes.txt", b"hello", cookie
        )
        self.assertEqual(status, 200)
        body = json.loads(payload)
        self.assertEqual(body["path"], "/sdcard/Download/notes.txt")
        self.assertEqual(body["size"], 5)
        self.assertEqual(self.adb.calls[-1][:1], ["push"])

    def test_drop_route_rejects_bad_content_type_and_name(self):
        cookie = self.cookie()
        status, _ = self.raw_post(
            "/api/v1/files/drop?name=notes.txt", b"hello", cookie,
            content_type="text/plain",
        )
        self.assertEqual(status, 415)
        status, payload = self.raw_post(
            "/api/v1/files/drop?name=../evil.txt", b"hello", cookie
        )
        self.assertEqual(status, 400)
        self.assertIn("characters", json.loads(payload)["error"])

    def test_routes_require_session(self):
        status, _ = self.request(
            "POST", "/api/v1/updates/adb", body="{}", headers={
                "Host": f"127.0.0.1:{self.port}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "same-origin",
                "Sec-Fetch-Dest": "empty",
            }
        )
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
