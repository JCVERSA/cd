"""Unit tests for Phase 3: File Explorer endpoints and DeGoogle jobs."""

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
from degoogle import (
    ALL_SET,
    RISKY_PACKAGES,
    SAFE_PACKAGES,
    UNSAFE_PACKAGES,
    load_state,
    save_state,
    simple_candidates,
)
from win32_dialogs import _parse_multi_select

INSTALLED_LIST = "\n".join(f"package:{name}" for name in [
    "com.google.android.youtube",
    "com.google.android.gm",
    "com.google.android.gsf.login",
    "com.android.vending",
    "com.example.other",
]) + "\n"


class FakeADB(ADBManager):
    def __init__(self, ls_output: str = ""):
        super().__init__(adb_path="adb")
        self.calls: list[tuple[list[str], str | None]] = []
        self.ls_output = ls_output
        self.push_ok = True
        self.pull_ok = True
        self.enable_ok = True
        self.uninstall_ok = True
        self.reinstall_ok = True
        self.delete_ok = True
        self.missing_installed: set[str] = set()

    def run(self, args, *, serial=None, timeout=30):
        self.calls.append((list(args), serial))
        if args[:4] == ["shell", "pm", "list", "packages"]:
            lines = [line for line in INSTALLED_LIST.splitlines()
                     if line.replace("package:", "") not in self.missing_installed]
            return {"success": True, "stdout": "\n".join(lines) + "\n", "stderr": "", "returncode": 0}
        if args[:4] == ["shell", "rm", "-rf"] or args[:4] == ["shell", "rm", "-r"]:
            return {"success": self.delete_ok, "stdout": "",
                    "stderr": "" if self.delete_ok else "Permission denied", "returncode": 0 if self.delete_ok else 1}
        if args[:3] == ["shell", "mkdir", "-p"]:
            return {"success": True, "stdout": "", "stderr": "", "returncode": 0}
        if args[:2] == ["shell", "mv"]:
            return {"success": True, "stdout": "", "stderr": "", "returncode": 0}
        if args[:3] == ["shell", "pm", "install-existing"]:
            return {"success": self.reinstall_ok, "stdout": "Success" if self.reinstall_ok else "",
                    "stderr": "" if self.reinstall_ok else "Failure", "returncode": 0 if self.reinstall_ok else 1}
        if args[:3] in (["shell", "pm", "enable"], ["shell", "pm", "disable-user"]):
            return {"success": self.enable_ok, "stdout": "", "stderr": "",
                    "returncode": 0 if self.enable_ok else 1}
        if args[:1] == ["uninstall"]:
            ok = self.uninstall_ok
            return {"success": ok, "stdout": "Success" if ok else "Failure [DELETE_FAILED_USER]",
                    "stderr": "", "returncode": 0 if ok else 1}
        if args[:1] == ["push"]:
            return {"success": self.push_ok, "stdout": "", "stderr": "" if self.push_ok else "read-only",
                    "returncode": 0 if self.push_ok else 1}
        if args[:1] == ["pull"]:
            return {"success": self.pull_ok, "stdout": "", "stderr": "" if self.pull_ok else "no such file",
                    "returncode": 0 if self.pull_ok else 1}
        if args[:3] == ["shell", "ls", "-la"]:
            return {"success": True, "stdout": self.ls_output, "stderr": "", "returncode": 0}
        return {"success": True, "stdout": "", "stderr": "", "returncode": 0}


class FilesBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB(ls_output=(
            "drwxrwx--x 2 root sdcard_rw 4096 2024-05-01 12:00 DCIM\n"
            "-rw-rw---- 1 root sdcard_rw 100 2024-04-30 08:15 photo.jpg\n"
        ))
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)
        self.backend._settings["selected_device"] = "emulator-5554"
        self.root = os.path.join(self.tmp.name, "pc")
        os.makedirs(os.path.join(self.root, "docs"))
        with open(os.path.join(self.root, "note.txt"), "w", encoding="utf-8") as handle:
            handle.write("hi")

    def test_list_local_dir_sorts_dirs_first(self):
        result = self.backend.list_local_dir(self.root)
        self.assertEqual(result["path"], os.path.abspath(self.root))
        self.assertEqual([e["name"] for e in result["entries"]], ["docs", "note.txt"])
        self.assertTrue(result["entries"][0]["is_dir"])
        self.assertEqual(result["parent"], os.path.abspath(self.tmp.name))

    def test_list_local_dir_rejects_missing(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.list_local_dir(os.path.join(self.root, "ghost"))
        self.assertEqual(ctx.exception.status, 404)

    def test_list_local_dir_validates_input(self):
        for bad in (123, "a\x00b", "x" * 40000):
            with self.assertRaises(DashboardError):
                self.backend.list_local_dir(bad)

    def test_list_local_dir_defaults_to_home(self):
        result = self.backend.list_local_dir("")
        self.assertEqual(result["path"], os.path.abspath(os.path.expanduser("~")))

    def test_list_device_dir_requires_device_and_absolute_path(self):
        self.backend._settings["selected_device"] = ""
        with self.assertRaises(DashboardError) as ctx:
            self.backend.list_device_dir("/sdcard")
        self.assertEqual(ctx.exception.status, 409)
        self.backend._settings["selected_device"] = "emulator-5554"
        with self.assertRaises(DashboardError):
            self.backend.list_device_dir("relative/path")

    def test_list_device_dir_parses_entries(self):
        result = self.backend.list_device_dir("/sdcard")
        self.assertEqual(result["path"], "/sdcard")
        self.assertEqual(result["parent"], "/")
        self.assertEqual([e["name"] for e in result["entries"]], ["DCIM", "photo.jpg"])

    def test_push_validates_and_calls_adb(self):
        local = os.path.join(self.root, "note.txt")
        with self.assertRaises(DashboardError):
            self.backend.push_file({"localPath": os.path.join(self.root, "ghost.txt"),
                                    "devicePath": "/sdcard/note.txt"})
        with self.assertRaises(DashboardError):
            self.backend.push_file({"localPath": local, "devicePath": "relative.txt"})
        result = self.backend.push_file({"localPath": local, "devicePath": "/sdcard/note.txt"})
        self.assertTrue(result["ok"])
        self.assertEqual(self.adb.calls[-1][0], ["push", local, "/sdcard/note.txt"])
        self.assertEqual(self.adb.calls[-1][1], "emulator-5554")

    def test_push_failure_raises(self):
        self.adb.push_ok = False
        with self.assertRaises(DashboardError) as ctx:
            self.backend.push_file({"localPath": os.path.join(self.root, "note.txt"),
                                    "devicePath": "/sdcard/note.txt"})
        self.assertIn("read-only", str(ctx.exception))

    def test_pull_requires_absolute_local_destination(self):
        with self.assertRaises(DashboardError):
            self.backend.pull_file({"devicePath": "/sdcard/a.txt", "localPath": "relative.txt"})
        target_dir = os.path.join(self.root, "docs")
        target = os.path.join(target_dir, "a.txt")
        result = self.backend.pull_file({"devicePath": "/sdcard/a.txt", "localPath": target})
        self.assertTrue(result["ok"])
        self.assertEqual(self.adb.calls[-1][0], ["pull", "/sdcard/a.txt", target])

    @unittest.skipIf(sys.platform == "win32", "native dialogs available on Windows")
    def test_push_pick_unavailable_off_windows(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.push_pick({"deviceDir": "/sdcard"})
        self.assertEqual(ctx.exception.status, 501)

    def test_push_pick_cancelled_without_dialog(self):
        with mock.patch("dashboard_server.dialogs_supported", return_value=True), \
                mock.patch("dashboard_server.pick_files", return_value=None):
            result = self.backend.push_pick({"deviceDir": "/sdcard"})
        self.assertTrue(result.get("cancelled"))

    def test_push_pick_pushes_each_file(self):
        picked = [os.path.join(self.root, "note.txt")]
        with mock.patch("dashboard_server.dialogs_supported", return_value=True), \
                mock.patch("dashboard_server.pick_files", return_value=picked):
            result = self.backend.push_pick({"deviceDir": "/sdcard"})
        self.assertEqual(result["pushed"], 1)
        self.assertEqual(result["failed"], 0)
        push_calls = [c for c in self.adb.calls if c[0] and c[0][0] == "push"]
        self.assertEqual(push_calls[-1][0][2], "/sdcard/note.txt")

    @unittest.skipIf(sys.platform == "win32", "native dialogs available on Windows")
    def test_save_as_unavailable_off_windows(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.save_as({"devicePath": "/sdcard/photo.jpg"})
        self.assertEqual(ctx.exception.status, 501)

    def test_save_as_cancelled_without_dialog(self):
        with mock.patch("dashboard_server.dialogs_supported", return_value=True), \
                mock.patch("dashboard_server.pick_save_path", return_value=None):
            result = self.backend.save_as({"devicePath": "/sdcard/photo.jpg"})
        self.assertTrue(result.get("cancelled"))

    def test_save_as_pulls_to_chosen_path(self):
        target = os.path.join(self.root, "docs", "saved.jpg")
        with mock.patch("dashboard_server.dialogs_supported", return_value=True), \
                mock.patch("dashboard_server.pick_save_path", return_value=target):
            result = self.backend.save_as({"devicePath": "/sdcard/photo.jpg"})
        self.assertTrue(result["ok"])
        self.assertEqual(result["path"], target)
        pull_calls = [c for c in self.adb.calls if c[0] and c[0][0] == "pull"]
        self.assertEqual(pull_calls[-1][0], ["pull", "/sdcard/photo.jpg", target])

    def test_device_ops_shapes(self):
        self.backend.device_mkdir({"path": "/sdcard/New"})
        self.assertEqual(self.adb.calls[-1][0], ["shell", "mkdir", "-p", "/sdcard/New"])
        self.backend.device_rename({"from": "/sdcard/a", "to": "/sdcard/b"})
        self.assertEqual(self.adb.calls[-1][0], ["shell", "mv", "/sdcard/a", "/sdcard/b"])
        self.backend.device_delete({"path": "/sdcard/DCIM/old.jpg"})
        self.assertEqual(self.adb.calls[-1][0], ["shell", "rm", "-rf", "/sdcard/DCIM/old.jpg"])

    def test_device_delete_blocks_top_level_paths(self):
        for path in ("/", "/sdcard", "/data"):
            with self.assertRaises(DashboardError):
                self.backend.device_delete({"path": path})
        # no rm call happened for the blocked paths
        rm_calls = [c for c in self.adb.calls if c[0][:2] == ["shell", "rm"]]
        self.assertEqual(rm_calls, [])


class DeGoogleBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)
        self.backend._settings["selected_device"] = "emulator-5554"
        self.state_path = os.path.join(self.tmp.name, "degoogle_state.json")

    def wait_job(self):
        deadline = time.time() + 10
        while time.time() < deadline:
            job = self.backend.degoogle_status()["job"]
            if not job["running"]:
                return job
            time.sleep(0.02)
        raise AssertionError("DeGoogle job did not finish in time")

    def test_catalog_is_disjoint_and_simple_excludes_unsafe(self):
        self.assertEqual(len(SAFE_PACKAGES) + len(RISKY_PACKAGES) + len(UNSAFE_PACKAGES),
                         len(ALL_SET))
        self.assertFalse(set(simple_candidates(True)) & set(UNSAFE_PACKAGES))
        self.assertFalse(set(simple_candidates(False)) & set(RISKY_PACKAGES))

    def test_status_reports_installed_buckets(self):
        status = self.backend.degoogle_status()
        self.assertEqual(status["device"], "emulator-5554")
        self.assertIn("com.google.android.youtube", status["installed"]["safe"])
        self.assertIn("com.google.android.gsf.login", status["installed"]["risky"])
        self.assertIn("com.android.vending", status["installed"]["unsafe"])
        self.assertNotIn("com.example.other", status["installed"]["safe"])

    def test_run_simple_disables_and_records_state(self):
        result = self.backend.degoogle_run({"mode": "simple", "action": "disable"})
        self.assertTrue(result["started"])
        # only installed catalog packages are touched
        expected = {"com.google.android.youtube", "com.google.android.gm"}
        job = self.wait_job()
        self.assertEqual(set(job["lastRun"]["disabled"]), expected)
        self.assertEqual(job["lastRun"]["failed"], [])
        state = load_state(self.state_path)
        self.assertEqual(set(state["emulator-5554"]["disabled"]), expected)
        # disable calls used pm disable-user
        disable_calls = [c for c in self.adb.calls if c[0][:3] == ["shell", "pm", "disable-user"]]
        self.assertEqual(len(disable_calls), 2)

    def test_run_simple_uninstall_records_uninstalled(self):
        self.backend.degoogle_run({"mode": "simple", "action": "uninstall"})
        job = self.wait_job()
        self.assertEqual(len(job["lastRun"]["uninstalled"]), 2)
        state = load_state(self.state_path)
        self.assertEqual(len(state["emulator-5554"]["uninstalled"]), 2)
        uninstall_calls = [c for c in self.adb.calls
                           if c[0][:2] == ["uninstall", "--user"]]
        self.assertEqual(len(uninstall_calls), 2)

    def test_run_simple_include_risky_adds_risky_bucket(self):
        self.backend.degoogle_run({"mode": "simple", "action": "disable", "includeRisky": True})
        job = self.wait_job()
        self.assertEqual(set(job["lastRun"]["disabled"]),
                         {"com.google.android.youtube", "com.google.android.gm",
                          "com.google.android.gsf.login"})

    def test_run_custom_rejects_unknown_packages(self):
        with self.assertRaises(DashboardError):
            self.backend.degoogle_run({"mode": "custom", "action": "disable",
                                       "packages": ["com.not.in.catalog"]})

    def test_run_custom_allows_unsafe(self):
        self.backend.degoogle_run({"mode": "custom", "action": "uninstall",
                                   "packages": ["com.android.vending"]})
        job = self.wait_job()
        self.assertEqual(job["lastRun"]["uninstalled"], ["com.android.vending"])

    def test_run_validates_mode_action_and_device(self):
        with self.assertRaises(DashboardError):
            self.backend.degoogle_run({"mode": "nope", "action": "disable"})
        with self.assertRaises(DashboardError):
            self.backend.degoogle_run({"mode": "simple", "action": "wipe"})
        self.backend._settings["selected_device"] = ""
        with self.assertRaises(DashboardError) as ctx:
            self.backend.degoogle_run({"mode": "simple", "action": "disable"})
        self.assertEqual(ctx.exception.status, 409)

    def test_run_rejects_when_job_running(self):
        with self.backend._degoogle_lock:
            self.backend._degoogle_job["running"] = True
        try:
            with self.assertRaises(DashboardError) as ctx:
                self.backend.degoogle_run({"mode": "simple", "action": "disable"})
            self.assertEqual(ctx.exception.status, 409)
        finally:
            with self.backend._degoogle_lock:
                self.backend._degoogle_job["running"] = False

    def test_run_with_nothing_installed(self):
        self.adb.missing_installed = {
            "com.google.android.youtube", "com.google.android.gm",
        }
        result = self.backend.degoogle_run({"mode": "simple", "action": "disable"})
        self.assertFalse(result["started"])

    def test_undo_restores_and_clears_state(self):
        save_state(self.state_path, {
            "emulator-5554": {
                "disabled": ["com.google.android.gm"],
                "uninstalled": ["com.google.android.youtube"],
                "updated": "2026-01-01 12:00:00",
            }
        })
        result = self.backend.degoogle_undo({})
        self.assertTrue(result["started"])
        job = self.wait_job()
        self.assertEqual(set(job["lastUndo"]["restored"]),
                         {"com.google.android.gm", "com.google.android.youtube"})
        # state no longer lists the device (both lists emptied)
        self.assertNotIn("emulator-5554", load_state(self.state_path))
        enable_calls = [c for c in self.adb.calls if c[0][:3] == ["shell", "pm", "enable"]]
        reinstall_calls = [c for c in self.adb.calls if c[0][:3] == ["shell", "pm", "install-existing"]]
        self.assertEqual(len(enable_calls), 1)
        self.assertEqual(len(reinstall_calls), 1)

    def test_undo_rejects_packages_not_in_state(self):
        save_state(self.state_path, {
            "emulator-5554": {"disabled": [], "uninstalled": [], "updated": ""}
        })
        with self.assertRaises(DashboardError):
            self.backend.degoogle_undo({"uninstalled": ["com.google.android.gm"]})
        with self.assertRaises(DashboardError):
            self.backend.degoogle_undo({})  # nothing recorded

    def test_state_roundtrip_and_corrupt_file(self):
        save_state(self.state_path, {"serial": {"disabled": ["a.b"], "uninstalled": [], "updated": "x"}})
        self.assertEqual(load_state(self.state_path)["serial"]["disabled"], ["a.b"])
        with open(self.state_path, "w", encoding="utf-8") as handle:
            handle.write("{not json")
        self.assertEqual(load_state(self.state_path), {})


class ParseMultiSelectTests(unittest.TestCase):
    def test_multi_select_buffer(self):
        buffer = "C:\\apk\x00base.apk\x00split.apk\x00\x00"
        self.assertEqual(_parse_multi_select(buffer),
                         [os.path.join("C:\\apk", "base.apk"), os.path.join("C:\\apk", "split.apk")])

    def test_single_file_buffer(self):
        self.assertEqual(_parse_multi_select("C:\\only.apk\x00\x00"), ["C:\\only.apk"])

    def test_empty_buffer(self):
        self.assertEqual(_parse_multi_select(""), [])

    @unittest.skipIf(sys.platform == "win32", "would open a real dialog on Windows")
    def test_dialogs_unavailable_off_windows(self):
        from win32_dialogs import pick_files, pick_save_path
        self.assertIsNone(pick_files())
        self.assertIsNone(pick_save_path())


class FilesDegoogleHTTPTests(unittest.TestCase):
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
        self.backend = DroidSlateBackend(self.data_tmp.name, adb=FakeADB())
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

    def get(self, path, cookie):
        return self.request("GET", path, headers={
            "Host": f"127.0.0.1:{self.port}",
            "Cookie": cookie,
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "same-origin",
            "Sec-Fetch-Dest": "empty",
        })

    def test_files_local_requires_session(self):
        status, _ = self.request("GET", "/api/v1/files/local", headers={
            "Host": f"127.0.0.1:{self.port}",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "same-origin",
            "Sec-Fetch-Dest": "empty",
        })
        self.assertEqual(status, 401)

    def test_files_local_and_degoogle_over_http(self):
        import urllib.parse
        cookie = self.cookie()
        status, payload = self.get(
            "/api/v1/files/local?path=" + urllib.parse.quote(tempfile.gettempdir()), cookie)
        self.assertEqual(status, 200)
        self.assertIn("entries", json.loads(payload))

        status, payload = self.get("/api/v1/degoogle", cookie)
        self.assertEqual(status, 200)
        data = json.loads(payload)
        self.assertEqual(data["device"], "emulator-5554")
        self.assertIn("installed", data)
        self.assertIn("job", data)


if __name__ == "__main__":
    unittest.main()
