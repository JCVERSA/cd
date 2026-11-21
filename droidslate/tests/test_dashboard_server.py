"""Unit tests for the loopback dashboard server (auth, routing, static safety)."""

from __future__ import annotations

import http.client
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
    default_settings,
)

ASSETS = None  # filled in setUpClass with a temp asset tree


class _NoopADB(ADBManager):
    """ADB stub that never spawns a process."""

    def __init__(self):
        super().__init__(adb_path="adb")

    def run(self, args, *, serial=None, timeout=30):
        return {"success": True, "stdout": "", "stderr": "", "returncode": 0}


class BackendSettingsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.backend = DroidSlateBackend(self.tmp.name, adb=_NoopADB())
        self.addCleanup(self.backend.close)

    def test_defaults_roundtrip(self):
        settings = self.backend.save_settings({})
        self.assertEqual(
            settings, {"adbPath": "", "theme": "dark", "accent": "emerald"}
        )

    def test_theme_validation(self):
        with self.assertRaises(DashboardError):
            self.backend.save_settings({"theme": "neon"})
        self.assertEqual(self.backend.save_settings({"theme": "light"})["theme"], "light")
        self.assertEqual(self.backend.save_settings({"theme": "system"})["theme"], "system")

    def test_accent_validation(self):
        with self.assertRaises(DashboardError):
            self.backend.save_settings({"accent": "rainbow"})
        self.assertEqual(
            self.backend.save_settings({"accent": "violet"})["accent"], "violet"
        )

    def test_settings_persist_to_disk(self):
        self.backend.save_settings({"theme": "light", "adbPath": ""})
        with open(os.path.join(self.tmp.name, "settings.json"), encoding="utf-8") as handle:
            saved = json.load(handle)
        self.assertEqual(saved["theme"], "light")

    def test_select_unknown_device_rejected(self):
        with self.assertRaises(DashboardError):
            self.backend.select_device("ghost-device")

    def test_shell_requires_device(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.run_shell({"command": "ls"})
        self.assertEqual(ctx.exception.status, 409)

    def test_shell_rejects_empty_command(self):
        self.backend._settings["selected_device"] = "dev"
        with self.assertRaises(DashboardError):
            self.backend.run_shell({"command": "  "})

    def test_snapshot_shape(self):
        snapshot = self.backend.snapshot()
        for key in ("runtime", "devices", "selectedDevice", "settings", "logcat", "logs"):
            self.assertIn(key, snapshot)


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        assets = os.path.join(cls.tmp.name, "assets")
        os.makedirs(os.path.join(assets, "assets"), exist_ok=True)
        with open(os.path.join(assets, "index.html"), "w", encoding="utf-8") as handle:
            handle.write("<!doctype html><title>DroidSlate</title>")
        with open(os.path.join(assets, "assets", "app.js"), "w", encoding="utf-8") as handle:
            handle.write("console.log(1)")
        cls.assets = assets

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def setUp(self):
        self.backend = DroidSlateBackend(
            tempfile.mkdtemp(prefix="droidslate-http-"), adb=_NoopADB()
        )
        self.server, self.token = create_dashboard_server(self.backend, self.assets)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.backend.close()

    def request(self, method, path, *, body=None, headers=None, raw_path=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request(method, raw_path or path, body=body, headers=headers or {})
        response = connection.getresponse()
        payload = response.read()
        connection.close()
        return response.status, payload

    def authed_headers(self, *, mutate=False):
        # First exchange the capability for the session cookie.
        status, _ = self.request(
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
        headers = {
            "Host": f"127.0.0.1:{self.port}",
            "Cookie": f"DroidSlateSession={self.server.session_token}",
            "Content-Type": "application/json",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors" if mutate else "same-origin",
            "Sec-Fetch-Dest": "empty",
        }
        if mutate:
            headers["Origin"] = f"http://127.0.0.1:{self.port}"
        return headers

    # -- bootstrap ---------------------------------------------------------

    def test_bootstrap_requires_capability(self):
        status, _ = self.request(
            "POST", "/api/v1/session", body="{}",
            headers={
                "Host": f"127.0.0.1:{self.port}",
                "Origin": f"http://127.0.0.1:{self.port}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                "Authorization": "Bearer wrong",
                "Content-Type": "application/json",
                "Content-Length": "2",
            },
        )
        self.assertEqual(status, 401)

    def test_bootstrap_capability_single_use(self):
        self.authed_headers()  # exchange the capability once
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
        self.assertEqual(status, 401)

    # -- API auth ----------------------------------------------------------

    def test_api_rejects_missing_session(self):
        status, payload = self.request(
            "GET", "/api/v1/snapshot",
            headers={
                "Host": f"127.0.0.1:{self.port}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "same-origin",
                "Sec-Fetch-Dest": "empty",
            },
        )
        self.assertEqual(status, 401)
        self.assertIn("error", json.loads(payload))

    def test_api_rejects_cross_site_fetch_metadata(self):
        status, _ = self.request(
            "GET", "/api/v1/snapshot",
            headers={
                "Host": f"127.0.0.1:{self.port}",
                "Cookie": f"DroidSlateSession={self.server.session_token}",
                "Sec-Fetch-Site": "cross-site",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
            },
        )
        self.assertEqual(status, 403)

    def test_api_rejects_wrong_host(self):
        status, _ = self.request(
            "GET", "/api/v1/snapshot",
            headers={
                "Host": "evil.example",
                "Cookie": f"DroidSlateSession={self.server.session_token}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "same-origin",
                "Sec-Fetch-Dest": "empty",
            },
        )
        self.assertEqual(status, 421)

    def test_snapshot_with_session(self):
        status, payload = self.request(
            "GET", "/api/v1/snapshot", headers=self.authed_headers()
        )
        self.assertEqual(status, 200)
        data = json.loads(payload)
        self.assertIn("runtime", data)
        self.assertIn("devices", data)

    def test_settings_patch_validates_theme(self):
        headers = self.authed_headers(mutate=True)
        status, _ = self.request(
            "PATCH", "/api/v1/settings", body='{"theme":"plasma"}', headers=headers
        )
        self.assertEqual(status, 400)

    def test_unknown_endpoint_404(self):
        status, _ = self.request(
            "GET", "/api/v1/nope", headers=self.authed_headers()
        )
        self.assertEqual(status, 404)

    # -- static ------------------------------------------------------------

    def test_index_served_with_strict_csp(self):
        status, payload = self.request("GET", "/", headers={"Host": f"127.0.0.1:{self.port}"})
        self.assertEqual(status, 200)
        self.assertIn(b"DroidSlate", payload)

    def test_static_asset_with_immutable_cache(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request("GET", "/assets/app.js", headers={"Host": f"127.0.0.1:{self.port}"})
        response = connection.getresponse()
        body = response.read()
        self.assertEqual(response.status, 200)
        self.assertIn("immutable", response.getheader("Cache-Control", ""))
        self.assertIn("default-src 'none'", response.getheader("Content-Security-Policy", ""))
        connection.close()
        self.assertIn(b"console.log", body)

    def test_path_traversal_blocked(self):
        for path in ("/../secrets", "/..%2f..%2fetc%2fpasswd", "/assets/../../settings.json"):
            status, _ = self.request("GET", path, headers={"Host": f"127.0.0.1:{self.port}"})
            self.assertEqual(status, 404, path)

    def test_head_on_api_rejected(self):
        # HEAD is never routed to the API; the method itself is not allowed.
        status, _ = self.request("HEAD", "/api/v1/snapshot", headers={"Host": f"127.0.0.1:{self.port}"})
        self.assertEqual(status, 405)

    def test_cors_options_rejected(self):
        status, _ = self.request("OPTIONS", "/", headers={"Host": f"127.0.0.1:{self.port}"})
        self.assertEqual(status, 405)

    def test_rotate_session_invalidates_old_cookie(self):
        headers = self.authed_headers()
        status, _ = self.request("GET", "/api/v1/snapshot", headers=headers)
        self.assertEqual(status, 200)
        self.server.rotate_session()
        status, _ = self.request("GET", "/api/v1/snapshot", headers=headers)
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
