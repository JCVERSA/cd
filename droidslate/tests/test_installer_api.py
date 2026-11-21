"""Unit tests for the Installer tab API (stage / inspect / install)."""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import threading
import unittest
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adb_manager import ADBManager
from dashboard_server import DashboardError, DroidSlateBackend

PROFILE = {
    "abis": ["arm64-v8a", "armeabi-v7a"],
    "density": 440,
    "sdk": 34,
    "locales": ["fr-FR"],
}

MANIFEST = {
    "package_name": "com.example.game",
    "name": "Example Game",
    "version_name": "2.1.0",
    "version_code": "210",
    "min_sdk_version": "24",
}


def build_zip(entries: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as handle:
        for name, data in entries.items():
            handle.writestr(name, data)
    return buffer.getvalue()


XAPK_BYTES = build_zip({
    "base.apk": b"BASE",
    "config.arm64_v8a.apk": b"ABI64",
    "config.armeabi_v7a.apk": b"ABI32",
    "config.xxhdpi.apk": b"DPI",
    "config.fr.apk": b"FR",
    "manifest.json": json.dumps(MANIFEST).encode(),
    "icon.png": b"PNG",
    "Android/obb/main.210.com.example.game.obb": b"OBB",
})

PLAIN_APK_BYTES = build_zip({"AndroidManifest.xml": b"\x00", "classes.dex": b"d"})


class FakeADB(ADBManager):
    def __init__(self, *, install_ok: bool = True):
        super().__init__(adb_path="adb")
        self.calls: list[tuple[str, list]] = []
        self.install_ok = install_ok
        self.push_ok = True

    def device_install_profile(self, serial, *, timeout=20):
        self.calls.append(("profile", [serial]))
        return dict(PROFILE)

    def install_apk(self, serial, apk_path, *, timeout=600, reinstall=True,
                    downgrade=False, grant=False):
        args = ["install"]
        if reinstall:
            args.append("-r")
        if downgrade:
            args.append("-d")
        if grant:
            args.append("-g")
        args.append(apk_path)
        self.calls.append(("install_apk", args))
        return {"success": self.install_ok,
                "stdout": "Success" if self.install_ok else "",
                "stderr": "" if self.install_ok else "Failure [INSTALL_FAILED_XXX]",
                "returncode": 0 if self.install_ok else 1}

    def install_multiple(self, serial, apk_paths, *, timeout=900, reinstall=True,
                         downgrade=False, grant=False):
        args = ["install-multiple"]
        if reinstall:
            args.append("-r")
        if downgrade:
            args.append("-d")
        if grant:
            args.append("-g")
        args.extend(apk_paths)
        self.calls.append(("install_multiple", args))
        return {"success": self.install_ok,
                "stdout": "Success" if self.install_ok else "",
                "stderr": "" if self.install_ok else "Failure [INSTALL_FAILED_INVALID_APK]",
                "returncode": 0 if self.install_ok else 1}

    def push(self, serial, local_path, remote_path, *, timeout=300):
        self.calls.append(("push", [local_path, remote_path, str(timeout)]))
        return {"success": self.push_ok, "stdout": "", "stderr": "",
                "returncode": 0 if self.push_ok else 1}


class InstallerBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)
        self.backend._settings["selected_device"] = "emulator-5554"
        self.stage_dir = self.backend._stage_dir

    def stage(self, name: str, data: bytes) -> str:
        from dashboard_server import BUNDLE_NAME_RE
        result = self.backend.stage_apk(name, io.BytesIO(data), len(data),
                                        name_re=BUNDLE_NAME_RE)
        return result["name"]

    # -- staging -----------------------------------------------------------

    def test_stage_accepts_all_bundle_extensions(self):
        for name in ("a.apk", "a.apks", "a.xapk", "a.apkm", "a.zip", "A.XAPK"):
            result = self.stage(name, b"PK\x03\x04data")
            self.assertEqual(result, name)
            os.unlink(os.path.join(self.stage_dir, name))

    def test_stage_rejects_bad_names_for_bundles(self):
        from dashboard_server import BUNDLE_NAME_RE
        for name in ("../evil.xapk", "sub/dir.apk", "not-a-bundle.txt",
                     "game.aab", "x" * 300 + ".zip", "", None, 42):
            with self.assertRaises(DashboardError):
                self.backend.stage_apk(name, io.BytesIO(b"x"), 1,
                                       name_re=BUNDLE_NAME_RE)
        self.assertEqual(os.listdir(self.stage_dir), [])

    def test_apps_stage_still_rejects_bundles(self):
        with self.assertRaises(DashboardError):
            self.backend.stage_apk("game.xapk", io.BytesIO(b"x"), 1)
        self.assertEqual(os.listdir(self.stage_dir), [])

    # -- inspect -----------------------------------------------------------

    def test_inspect_plain_apk(self):
        name = self.stage("app.apk", PLAIN_APK_BYTES)
        info = self.backend.inspect_staged_bundle({"filename": name})
        self.assertEqual(info["format"], "apk")
        self.assertTrue(info["single"])
        self.assertEqual(info["plan"]["selected"], [name])
        self.assertIsNotNone(info["device"])

    def test_inspect_xapk_with_plan(self):
        name = self.stage("game.xapk", XAPK_BYTES)
        info = self.backend.inspect_staged_bundle({"filename": name})
        self.assertEqual(info["format"], "xapk")
        self.assertEqual(info["meta"]["package"], "com.example.game")
        selected = info["plan"]["selected"]
        self.assertIn("base.apk", selected)
        self.assertIn("config.arm64_v8a.apk", selected)
        self.assertNotIn("config.armeabi_v7a.apk", selected)  # primary ABI only
        self.assertIn("config.xxhdpi.apk", selected)
        self.assertIn("config.fr.apk", selected)
        self.assertEqual(len(info["obb"]), 1)

    def test_inspect_without_device_has_no_plan(self):
        self.backend._settings["selected_device"] = ""
        name = self.stage("game.xapk", XAPK_BYTES)
        info = self.backend.inspect_staged_bundle({"filename": name})
        self.assertIsNone(info["device"])
        self.assertIsNone(info["plan"])

    def test_inspect_missing_file_404(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.inspect_staged_bundle({"filename": "ghost.xapk"})
        self.assertEqual(ctx.exception.status, 404)

    def test_inspect_corrupt_zip_400(self):
        name = self.stage("junk.apks", b"definitely not a zip")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.inspect_staged_bundle({"filename": name})
        self.assertEqual(ctx.exception.status, 400)

    def test_inspect_rejects_bad_name(self):
        for bad in (None, 42, "../x.apk", "a.txt"):
            with self.assertRaises(DashboardError):
                self.backend.inspect_staged_bundle({"filename": bad})

    # -- install -----------------------------------------------------------

    def test_install_requires_device(self):
        name = self.stage("app.apk", PLAIN_APK_BYTES)
        self.backend._settings["selected_device"] = ""
        with self.assertRaises(DashboardError) as ctx:
            self.backend.install_staged_bundle({"filename": name})
        self.assertEqual(ctx.exception.status, 409)

    def test_install_plain_apk_with_flags(self):
        name = self.stage("app.apk", PLAIN_APK_BYTES)
        result = self.backend.install_staged_bundle({
            "filename": name,
            "options": {"reinstall": True, "downgrade": True, "grant": True},
        })
        self.assertTrue(result["ok"])
        call = [c for c in self.adb.calls if c[0] == "install_apk"][-1]
        self.assertIn("-r", call[1])
        self.assertIn("-d", call[1])
        self.assertIn("-g", call[1])
        self.assertTrue(call[1][-1].endswith("app.apk"))

    def test_install_xapk_extracts_and_installs_selected(self):
        name = self.stage("game.xapk", XAPK_BYTES)
        result = self.backend.install_staged_bundle({"filename": name})
        self.assertTrue(result["ok"])
        self.assertEqual(result["format"], "xapk")
        self.assertGreaterEqual(result["installed"], 4)
        call = [c for c in self.adb.calls if c[0] == "install_multiple"][-1]
        args = call[1]
        self.assertEqual(args[0], "install-multiple")
        self.assertIn("-r", args)
        # base first
        self.assertTrue(args[2].endswith("base.apk"), args)
        joined = " ".join(args)
        self.assertIn("config.arm64_v8a.apk", joined)
        self.assertNotIn("config.armeabi_v7a.apk", joined)
        # extraction dir cleaned up
        leftovers = [n for n in os.listdir(self.stage_dir) if n.endswith(".extract")]
        self.assertEqual(leftovers, [])

    def test_install_xapk_pushes_obb_to_package_dir(self):
        name = self.stage("game.xapk", XAPK_BYTES)
        result = self.backend.install_staged_bundle({"filename": name})
        pushes = [c for c in self.adb.calls if c[0] == "push"]
        self.assertEqual(len(pushes), 1)
        remote = pushes[0][1][1]
        self.assertTrue(remote.startswith("/sdcard/Android/obb/com.example.game/"), remote)
        self.assertTrue(remote.endswith(".obb"))
        self.assertEqual(result["obbPushed"], [remote])

    def test_install_obb_disabled(self):
        name = self.stage("game.xapk", XAPK_BYTES)
        result = self.backend.install_staged_bundle({
            "filename": name, "options": {"obb": False},
        })
        self.assertEqual(result["obbPushed"], [])
        self.assertFalse([c for c in self.adb.calls if c[0] == "push"])

    def test_install_failure_is_500(self):
        self.adb.install_ok = False
        name = self.stage("app.apk", PLAIN_APK_BYTES)
        with self.assertRaises(DashboardError) as ctx:
            self.backend.install_staged_bundle({"filename": name})
        self.assertEqual(ctx.exception.status, 500)
        self.assertIn("INSTALL_FAILED_XXX", str(ctx.exception))

    def test_install_rejects_non_bool_options(self):
        name = self.stage("app.apk", PLAIN_APK_BYTES)
        for bad in ({"reinstall": "yes"}, {"downgrade": 1}, "options", []):
            with self.assertRaises(DashboardError):
                self.backend.install_staged_bundle({"filename": name, "options": bad})

    def test_install_corrupt_bundle_400(self):
        name = self.stage("junk.zip", b"nope")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.install_staged_bundle({"filename": name})
        self.assertEqual(ctx.exception.status, 400)


class DeviceProfileTests(unittest.TestCase):
    """The real getprop-based profile parser (FakeADB.run only)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

        class PropADB(ADBManager):
            def __init__(self):
                super().__init__(adb_path="adb")

            def run(self, args, *, serial=None, timeout=30):
                if args[:2] == ["shell", "getprop"]:
                    stdout = (
                        "[ro.product.cpu.abilist]: [arm64-v8a,armeabi-v7a,arm64]\n"
                        "[ro.sf.lcd_density]: [440]\n"
                        "[ro.build.version.sdk]: [34]\n"
                        "[persist.sys.locale]: [fr-FR]\n"
                        "[ro.product.model]: [Pixel 8]\n"
                    )
                    return {"success": True, "stdout": stdout, "stderr": "", "returncode": 0}
                if args[:3] == ["shell", "wm", "density"]:
                    return {"success": True, "stdout": "", "stderr": "", "returncode": 0}
                return {"success": True, "stdout": "", "stderr": "", "returncode": 0}

        self.adb = PropADB()

    def test_profile_from_getprop(self):
        profile = self.adb.device_install_profile("serial-1")
        self.assertEqual(profile["abis"], ["arm64-v8a", "armeabi-v7a", "arm64"])
        self.assertEqual(profile["density"], 440)
        self.assertEqual(profile["sdk"], 34)
        self.assertEqual(profile["locales"], ["fr-FR"])

    def test_density_falls_back_to_wm(self):
        from adb_manager import ADBManager as _ADB

        class WmADB(_ADB):
            def __init__(self):
                super().__init__(adb_path="adb")

            def run(self, args, *, serial=None, timeout=30):
                if args[:2] == ["shell", "getprop"]:
                    return {"success": True,
                            "stdout": "[ro.product.cpu.abilist]: [arm64-v8a]\n"
                                      "[ro.build.version.sdk]: [30]\n",
                            "stderr": "", "returncode": 0}
                if args[:3] == ["shell", "wm", "density"]:
                    return {"success": True, "stdout": "Physical density: 420\n",
                            "stderr": "", "returncode": 0}
                return {"success": True, "stdout": "", "stderr": "", "returncode": 0}

        profile = WmADB().device_install_profile("serial-1")
        self.assertEqual(profile["density"], 420)
        self.assertEqual(profile["locales"], ["en"])


class InstallerHTTPTests(unittest.TestCase):
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

    def upload(self, name: str, data: bytes, cookie: str):
        return self.request(
            "POST", f"/api/v1/installer/stage?name={name}", body=data,
            headers={
                "Host": f"127.0.0.1:{self.port}",
                "Cookie": cookie,
                "Origin": f"http://127.0.0.1:{self.port}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(data)),
            },
        )

    def test_full_flow_over_http(self):
        cookie = self.cookie()
        status, payload = self.upload("game.xapk", XAPK_BYTES, cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["name"], "game.xapk")

        status, payload = self.post("/api/v1/installer/inspect",
                                    {"filename": "game.xapk"}, cookie)
        self.assertEqual(status, 200)
        info = json.loads(payload)
        self.assertEqual(info["format"], "xapk")
        self.assertIn("plan", info)

        status, payload = self.post(
            "/api/v1/installer/install", {"filename": "game.xapk"}, cookie)
        self.assertEqual(status, 200)
        result = json.loads(payload)
        self.assertTrue(result["ok"])
        self.assertGreaterEqual(result["installed"], 4)

    def test_routes_require_session(self):
        status, _ = self.request("POST", "/api/v1/installer/inspect",
                                 body="{}", headers={
                                     "Host": f"127.0.0.1:{self.port}",
                                     "Sec-Fetch-Site": "same-origin",
                                     "Sec-Fetch-Mode": "same-origin",
                                     "Sec-Fetch-Dest": "empty",
                                 })
        self.assertEqual(status, 401)

    def test_upload_rejects_bad_extension(self):
        cookie = self.cookie()
        status, _ = self.upload("evil.exe", b"data", cookie)
        self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
