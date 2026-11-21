"""Unit tests for the ADB command layer."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adb_manager import ADBManager, find_adb, parse_devices, parse_ls, parse_packages


DEVICES_OUTPUT = """List of devices attached
emulator-5554\tdevice product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1
R58N12345AB\tunauthorized usb:1-1 transport_id:2
192.168.1.20:5555\tdevice model:Pixel_8_Pro product:husky
badline-no-tab
"""

LS_OUTPUT = """total 24
drwxrwx--x 2 root sdcard_rw 4096 2024-05-01 12:00 DCIM
-rw-rw---- 1 root sdcard_rw 102400 2024-04-30 08:15 photo.jpg
lrwxrwxrwx 1 root root 21 2024-01-02 00:00 link -> /data/local/tmp/target
total: bogus line
cannot access '/nope': Permission denied
drwxrwx--x 2 root sdcard_rw 4096 2024-05-02 09:30 Movies
"""


class ParseDevicesTests(unittest.TestCase):
    def test_parses_statuses_and_models(self):
        devices = parse_devices(DEVICES_OUTPUT)
        self.assertEqual(len(devices), 4)
        self.assertEqual(devices[0]["id"], "emulator-5554")
        self.assertEqual(devices[0]["status"], "device")
        self.assertEqual(devices[0]["model"], "sdk gphone64 x86 64")
        self.assertEqual(devices[1]["status"], "unauthorized")
        self.assertIsNone(devices[1]["model"])

    def test_parses_network_device_and_underscores(self):
        devices = parse_devices(DEVICES_OUTPUT)
        network = devices[2]
        self.assertEqual(network["id"], "192.168.1.20:5555")
        self.assertEqual(network["model"], "Pixel 8 Pro")
        self.assertEqual(network["product"], "husky")

    def test_line_without_status_column(self):
        devices = parse_devices(DEVICES_OUTPUT)
        self.assertEqual(devices[3]["id"], "badline-no-tab")
        self.assertEqual(devices[3]["status"], "unknown")

    def test_empty_output(self):
        self.assertEqual(parse_devices(""), [])
        self.assertEqual(parse_devices("List of devices attached\n\n"), [])


class ParsePackagesTests(unittest.TestCase):
    def test_strips_prefix_and_skips_noise(self):
        output = (
            "package:com.android.settings\n"
            "package:com.example.app\n"
            "Some error text\n"
            "package:\n"
        )
        self.assertEqual(parse_packages(output), ["com.android.settings", "com.example.app"])


class ParseLsTests(unittest.TestCase):
    def test_parses_dirs_files_and_links(self):
        entries = parse_ls(LS_OUTPUT)
        names = [entry["name"] for entry in entries]
        # Directories sort before files, then alphabetically.
        self.assertEqual(names, ["DCIM", "Movies", "link", "photo.jpg"])
        self.assertTrue(entries[0]["is_dir"])
        self.assertFalse(entries[2]["is_dir"])
        self.assertTrue(entries[2]["is_link"])
        self.assertEqual(entries[2]["link_target"], "/data/local/tmp/target")
        self.assertEqual(entries[3]["size"], 102400)

    def test_ignores_permission_errors(self):
        entries = parse_ls(LS_OUTPUT)
        self.assertNotIn("cannot access '/nope': Permission denied", [e["name"] for e in entries])


class FindAdbTests(unittest.TestCase):
    def test_explicit_file_wins(self):
        self.assertEqual(find_adb("/somewhere/adb.exe"), "/somewhere/adb.exe")

    def test_falls_back_to_adb_token(self):
        # No bundled adb exists in the checkout, so resolution degrades to PATH lookup.
        resolved = find_adb()
        self.assertTrue(resolved)


class FakeAdb(ADBManager):
    """ADBManager with run() replaced by canned responses (no subprocess)."""

    def __init__(self, responses=None):
        super().__init__(adb_path="adb")
        self.calls = []
        self.responses = responses or {}

    def run(self, args, *, serial=None, timeout=30):
        self.calls.append((list(args), serial))
        key = tuple(args)
        return self.responses.get(key, {"success": True, "stdout": "", "stderr": "", "returncode": 0})


class ADBManagerTests(unittest.TestCase):
    def test_shell_strips_adb_prefix_and_uses_serial(self):
        manager = FakeAdb()
        manager.shell("SER123", "adb shell getprop ro.build.version.release")
        self.assertEqual(manager.calls[0], (["shell", "getprop ro.build.version.release"], "SER123"))

    def test_shell_strips_adb_with_serial_prefix(self):
        manager = FakeAdb()
        manager.shell("SER123", "adb -s OTHER shell ls /sdcard")
        self.assertEqual(manager.calls[0], (["shell", "ls /sdcard"], "SER123"))

    def test_shell_rejects_empty_command(self):
        manager = FakeAdb()
        result = manager.shell("SER123", "   ")
        self.assertFalse(result["success"])
        self.assertEqual(manager.calls, [])

    def test_uninstall_falls_back_to_user_zero(self):
        manager = FakeAdb(responses={
            ("uninstall", "com.app"): {"success": False, "stdout": "", "stderr": "Failure", "returncode": 1},
            ("uninstall", "--user", "0", "com.app"): {"success": True, "stdout": "Success", "stderr": "", "returncode": 0},
        })
        result = manager.uninstall("SER", "com.app")
        self.assertTrue(result["success"])
        self.assertEqual(len(manager.calls), 2)

    def test_reinstall_uses_install_existing(self):
        manager = FakeAdb()
        manager.reinstall("SER", "com.app")
        self.assertEqual(manager.calls[0], (["shell", "pm", "install-existing", "--user", "0", "com.app"], "SER"))

    def test_set_package_enabled_switches_verb(self):
        manager = FakeAdb()
        manager.set_package_enabled("SER", "com.app", enabled=False)
        manager.set_package_enabled("SER", "com.app", enabled=True)
        self.assertEqual(manager.calls[0][0], ["shell", "pm", "disable-user", "--user", "0", "com.app"])
        self.assertEqual(manager.calls[1][0], ["shell", "pm", "enable", "--user", "0", "com.app"])

    def test_reboot_rejects_unknown_mode(self):
        manager = FakeAdb()
        result = manager.reboot("SER", "safe-mode")
        self.assertFalse(result["success"])
        self.assertEqual(manager.calls, [])

    def test_package_path_parses_output(self):
        manager = FakeAdb(responses={
            ("shell", "pm", "path", "com.app"): {
                "success": True,
                "stdout": "package:/data/app/com.app/base.apk\n",
                "stderr": "",
                "returncode": 0,
            },
        })
        self.assertEqual(manager.package_path("SER", "com.app"), "/data/app/com.app/base.apk")


if __name__ == "__main__":
    unittest.main()
