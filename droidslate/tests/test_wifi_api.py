"""Unit tests for the WiFi (ADB over network) feature.

Covers the classic scrcpy flow: Get IP → Enable TCP/IP → Connect,
plus validation and the HTTP routes.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adb_manager import ADBManager
from dashboard_server import DashboardError, DroidSlateBackend

WLAN0_OUTPUT = """2: wlan0: <UP,BROADCAST,MULTICAST> mtu 1500
    inet 192.168.1.25/24 brd 192.168.1.255 scope global wlan0
       valid_lft forever preferred_lft forever
"""

ROUTE_OUTPUT = (
    "wlan0 proto kernel scope link src 192.168.1.25\n"
    "192.168.1.0/24 via 192.168.1.1 dev wlan0\n"
    "10.8.0.0/24 via 10.8.0.1 dev rmnet0\n"
)

MDNS_OUTPUT = (
    "List of discovered mdns services\n"
    "adb-1GKNWS93G2Y7I3Z5_adb-tls-connect._tcp\t192.168.1.25:37451\n"
    "adb-1GKNWS93G2Y7I3Z5_adb-tls-pairing._tcp\t192.168.1.25:42123\n"
    "weird name with spaces._tcp 10.0.0.2:5555\n"
    "garbage line without address\n"
    "not-an-ip:99999 _adb-tls-pairing._tcp\n"
)


class FakeADB(ADBManager):
    def __init__(self):
        super().__init__(adb_path="adb")
        self.calls: list[tuple[list[str], str | None]] = []
        self.wlan0 = ("success", WLAN0_OUTPUT)
        self.route = ("success", ROUTE_OUTPUT)
        self.tcpip = ("success", "restarting in TCP mode port: 5555")
        self.connect = ("success", "connected to 192.168.1.5:5555")
        self.disconnect = ("success", "disconnected 192.168.1.5:5555")
        self.mdns = ("success", MDNS_OUTPUT)
        self.pair = ("success", "Successfully paired with 192.168.1.25:42123 [guid=android]")
        self.start = ("success", "* daemon started successfully")

    def run(self, args, *, serial=None, timeout=30):
        self.calls.append((list(args), serial))
        state, output = "success", ""
        if args[:6] == ["shell", "ip", "-f", "inet", "addr", "show"]:
            state, output = self.wlan0
        elif args[:3] == ["shell", "ip", "route"]:
            state, output = self.route
        elif args[:1] == ["tcpip"]:
            state, output = self.tcpip
        elif args[:1] == ["connect"]:
            state, output = self.connect
        elif args[:1] == ["disconnect"]:
            state, output = self.disconnect
        elif args[:1] == ["mdns"]:
            state, output = self.mdns
        elif args[:1] == ["pair"]:
            state, output = self.pair
        elif args[:1] == ["kill-server"]:
            state, output = "success", ""
        elif args[:1] == ["start-server"]:
            state, output = self.start
        return {
            "success": state == "success",
            "stdout": output,
            "stderr": "",
            "returncode": 0 if state == "success" else 1,
        }


class WifiManagerTests(unittest.TestCase):
    def setUp(self):
        self.adb = FakeADB()

    def test_get_wifi_ip_from_wlan0(self):
        self.assertEqual(self.adb.get_wifi_ip("serial-1"), "192.168.1.25")
        self.assertEqual(self.adb.calls[0][0],
                         ["shell", "ip", "-f", "inet", "addr", "show", "wlan0"])
        self.assertEqual(self.adb.calls[0][1], "serial-1")

    def test_get_wifi_ip_falls_back_to_ip_route(self):
        self.adb.wlan0 = ("failure", "")
        self.assertEqual(self.adb.get_wifi_ip("serial-1"), "192.168.1.25")
        self.assertEqual(self.adb.calls[1][0], ["shell", "ip", "route"])

    def test_get_wifi_ip_ignores_non_wlan_interfaces(self):
        self.adb.wlan0 = ("failure", "")
        self.adb.route = ("success", "10.8.0.0/24 via 10.8.0.1 dev rmnet0 src 10.8.0.9\n")
        self.assertIsNone(self.adb.get_wifi_ip("serial-1"))

    def test_get_wifi_ip_none_when_wifi_off(self):
        self.adb.wlan0 = ("failure", "Cannot find device")
        self.adb.route = ("failure", "")
        self.assertIsNone(self.adb.get_wifi_ip("serial-1"))

    def test_get_wifi_ip_rejects_invalid_octets(self):
        self.adb.wlan0 = ("success", "    inet 999.1.1.1/24 scope global wlan0\n")
        self.adb.route = ("success", "wlan0 proto link src 300.0.0.1\n")
        self.assertIsNone(self.adb.get_wifi_ip("serial-1"))

    def test_enable_tcpip_uses_selected_serial_and_port(self):
        result = self.adb.enable_tcpip("serial-1", 5555)
        self.assertTrue(result["success"])
        self.assertEqual(self.adb.calls[-1], (["tcpip", "5555"], "serial-1"))

    def test_enable_tcpip_failure_reported(self):
        self.adb.tcpip = ("failure", "adb: unable to connect")
        self.assertFalse(self.adb.enable_tcpip("serial-1")["success"])

    def test_adb_connect_success_parsing(self):
        result = self.adb.adb_connect("192.168.1.5", 5555)
        self.assertTrue(result["success"])
        self.assertEqual(result["target"], "192.168.1.5:5555")
        self.assertEqual(self.adb.calls[-1][0], ["connect", "192.168.1.5:5555"])

    def test_adb_connect_already_connected_counts_as_success(self):
        self.adb.connect = ("success", "already connected to 192.168.1.5:5555")
        self.assertTrue(self.adb.adb_connect("192.168.1.5")["success"])

    def test_adb_connect_failure_parsing(self):
        self.adb.connect = ("failure", "failed to connect to 192.168.1.5:5555: Connection refused")
        result = self.adb.adb_connect("192.168.1.5")
        self.assertFalse(result["success"])
        self.assertIn("refused", result["output"])

    def test_adb_connect_cannot_connect_is_failure_even_with_rc0(self):
        self.adb.connect = ("success", "cannot connect to 192.168.1.5:5555: No route to host")
        self.assertFalse(self.adb.adb_connect("192.168.1.5")["success"])

    def test_adb_disconnect_success(self):
        result = self.adb.adb_disconnect("192.168.1.5", 5555)
        self.assertTrue(result["success"])
        self.assertEqual(self.adb.calls[-1][0], ["disconnect", "192.168.1.5:5555"])

    def test_adb_disconnect_cannot_is_failure(self):
        self.adb.disconnect = ("success", "cannot disconnect 192.168.1.5:5555")
        self.assertFalse(self.adb.adb_disconnect("192.168.1.5")["success"])

    def test_mdns_services_parses_pairing_and_connect(self):
        services = self.adb.mdns_services()
        self.assertEqual(self.adb.calls[-1][0], ["mdns", "services"])
        # garbage + header lines skipped; 3 valid entries remain
        self.assertEqual(len(services), 3)
        connect = services[0]
        self.assertEqual(connect["type"], "connect")
        self.assertEqual(connect["target"], "192.168.1.25:37451")
        self.assertEqual(connect["port"], 37451)
        pairing = services[1]
        self.assertEqual(pairing["type"], "pairing")
        self.assertEqual(pairing["target"], "192.168.1.25:42123")
        # service names may contain spaces (host:port is parsed from the end)
        self.assertEqual(services[2]["type"], "other")
        self.assertEqual(services[2]["target"], "10.0.0.2:5555")

    def test_mdns_services_failure_returns_empty(self):
        self.adb.mdns = ("failure", "adb: mdns not found")
        self.assertEqual(self.adb.mdns_services(), [])

    def test_adb_pair_success_detection(self):
        result = self.adb.adb_pair("192.168.1.25:42123", "482913")
        self.assertTrue(result["success"])
        self.assertEqual(self.adb.calls[-1][0], ["pair", "192.168.1.25:42123", "482913"])

    def test_adb_pair_requires_confirmation_line(self):
        # exit code alone is not enough — adb can print errors with rc 0
        self.adb.pair = ("success", "failed: Wrong password or pairing code")
        self.assertFalse(self.adb.adb_pair("192.168.1.25:42123", "000000")["success"])

    def test_adb_pair_failure_output_kept(self):
        self.adb.pair = ("failure", "error: no services found")
        result = self.adb.adb_pair("192.168.1.25:42123", "482913")
        self.assertFalse(result["success"])
        self.assertIn("no services", result["output"])

    def test_kill_and_start_server(self):
        self.assertTrue(self.adb.kill_server()["success"])
        self.assertEqual(self.adb.calls[-1][0], ["kill-server"])
        self.assertTrue(self.adb.start_server()["success"])
        self.assertEqual(self.adb.calls[-1][0], ["start-server"])


class WifiBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.adb = FakeADB()
        self.backend = DroidSlateBackend(self.tmp.name, adb=self.adb)
        self.addCleanup(self.backend.close)

    def test_get_ip_requires_device(self):
        with self.assertRaises(DashboardError) as ctx:
            self.backend.wifi_get_ip({})
        self.assertEqual(ctx.exception.status, 409)

    def test_get_ip_returns_address(self):
        self.backend._settings["selected_device"] = "emulator-5554"
        result = self.backend.wifi_get_ip({})
        self.assertEqual(result["ip"], "192.168.1.25")
        self.assertEqual(result["serial"], "emulator-5554")

    def test_get_ip_404_when_wifi_off(self):
        self.backend._settings["selected_device"] = "emulator-5554"
        self.adb.wlan0 = ("failure", "")
        self.adb.route = ("failure", "")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.wifi_get_ip({})
        self.assertEqual(ctx.exception.status, 404)
        self.assertIn("Wi-Fi", str(ctx.exception))

    def test_enable_tcp_defaults_to_5555(self):
        self.backend._settings["selected_device"] = "emulator-5554"
        result = self.backend.wifi_enable_tcp({})
        self.assertEqual(result["port"], 5555)
        self.assertEqual(self.adb.calls[-1], (["tcpip", "5555"], "emulator-5554"))

    def test_enable_tcp_validates_port(self):
        self.backend._settings["selected_device"] = "emulator-5554"
        for bad in (0, 65536, -1, "abc", True, 3.5):
            with self.assertRaises(DashboardError):
                self.backend.wifi_enable_tcp({"port": bad})

    def test_enable_tcp_failure_is_500(self):
        self.backend._settings["selected_device"] = "emulator-5554"
        self.adb.tcpip = ("failure", "adb: device still connecting")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.wifi_enable_tcp({})
        self.assertEqual(ctx.exception.status, 500)
        self.assertIn("device still connecting", str(ctx.exception))

    def test_connect_validates_ip(self):
        for bad in (None, "", "  ", "999.1.1.1", "1.2.3", "a.b.c.d",
                    "1.2.3.4.5", "192.168.1.25; rm -rf /", 12345, True):
            with self.assertRaises(DashboardError) as ctx:
                self.backend.wifi_connect({"ip": bad})
            self.assertEqual(ctx.exception.status, 400, bad)

    def test_connect_success(self):
        result = self.backend.wifi_connect({"ip": "192.168.1.5"})
        self.assertEqual(result["target"], "192.168.1.5:5555")
        self.assertIn("connected", result["output"])
        self.assertEqual(self.adb.calls[-1][0], ["connect", "192.168.1.5:5555"])

    def test_connect_with_custom_port(self):
        self.backend.wifi_connect({"ip": "192.168.1.5", "port": 5037})
        self.assertEqual(self.adb.calls[-1][0], ["connect", "192.168.1.5:5037"])

    def test_connect_failure_is_500_with_adb_output(self):
        self.adb.connect = ("failure", "failed to connect to 192.168.1.5:5555: Connection refused")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.wifi_connect({"ip": "192.168.1.5"})
        self.assertEqual(ctx.exception.status, 500)
        self.assertIn("refused", str(ctx.exception))

    def test_disconnect_success_and_failure(self):
        result = self.backend.wifi_disconnect({"ip": "192.168.1.5"})
        self.assertIn("192.168.1.5:5555", result["target"])
        self.adb.disconnect = ("failure", "error: device offline")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.wifi_disconnect({"ip": "192.168.1.5"})
        self.assertEqual(ctx.exception.status, 500)

    def test_mdns_returns_services(self):
        result = self.backend.wifi_mdns({})
        self.assertEqual(len(result["services"]), 3)
        self.assertEqual(result["services"][1]["type"], "pairing")

    def test_pair_validates_target(self):
        for bad in (None, "", "nope", "192.168.1.25", "192.168.1.25:99999",
                    "999.1.1.1:42123", "192.168.1.25:abc", 12345):
            with self.assertRaises(DashboardError) as ctx:
                self.backend.wifi_pair({"target": bad, "code": "482913"})
            self.assertEqual(ctx.exception.status, 400, bad)

    def test_pair_validates_code(self):
        for bad in (None, "", "12345", "1234567", "abcdef", "48 913", 482913, True):
            with self.assertRaises(DashboardError) as ctx:
                self.backend.wifi_pair({"target": "192.168.1.25:42123", "code": bad})
            self.assertEqual(ctx.exception.status, 400, bad)

    def test_pair_success(self):
        result = self.backend.wifi_pair({"target": "192.168.1.25:42123", "code": "482913"})
        self.assertEqual(result["target"], "192.168.1.25:42123")
        self.assertIn("Successfully paired", result["output"])

    def test_pair_failure_is_500(self):
        self.adb.pair = ("failure", "error: wrong password")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.wifi_pair({"target": "192.168.1.25:42123", "code": "482913"})
        self.assertEqual(ctx.exception.status, 500)
        self.assertIn("wrong password", str(ctx.exception))

    def test_connect_records_wifi_history(self):
        self.backend.wifi_connect({"ip": "192.168.1.5"})
        self.assertEqual(self.backend.snapshot()["wifiHistory"], ["192.168.1.5"])
        # most recent first, duplicates collapsed
        self.backend.wifi_connect({"ip": "192.168.1.6"})
        self.backend.wifi_connect({"ip": "192.168.1.5"})
        self.assertEqual(
            self.backend.snapshot()["wifiHistory"],
            ["192.168.1.5", "192.168.1.6"],
        )
        # capped at 8 entries
        for index in range(10):
            self.backend.wifi_connect({"ip": f"10.0.0.{index}"})
        history = self.backend.snapshot()["wifiHistory"]
        self.assertEqual(len(history), 8)
        self.assertEqual(history[0], "10.0.0.9")

    def test_wifi_history_persisted_to_settings(self):
        self.backend.wifi_connect({"ip": "192.168.1.5"})
        path = os.path.join(self.tmp.name, "settings.json")
        with open(path, encoding="utf-8") as handle:
            self.assertEqual(json.load(handle)["wifi_history"], ["192.168.1.5"])

    def test_adb_restart_success_and_failure(self):
        self.assertEqual(self.backend.adb_restart({}), {"ok": True})
        self.assertEqual(self.adb.calls[-2][0], ["kill-server"])
        self.assertEqual(self.adb.calls[-1][0], ["start-server"])
        self.adb.start = ("failure", "cannot start daemon")
        with self.assertRaises(DashboardError) as ctx:
            self.backend.adb_restart({})
        self.assertEqual(ctx.exception.status, 500)


class WifiHTTPTests(unittest.TestCase):
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

    def test_routes_require_session(self):
        status, _ = self.request("POST", "/api/v1/wifi/get-ip", body="{}", headers={
            "Host": f"127.0.0.1:{self.port}",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "same-origin",
            "Sec-Fetch-Dest": "empty",
        })
        self.assertEqual(status, 401)

    def test_get_ip_and_connect_over_http(self):
        cookie = self.cookie()
        status, payload = self.post("/api/v1/wifi/get-ip", {}, cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["ip"], "192.168.1.25")

        status, payload = self.post("/api/v1/wifi/connect", {"ip": "192.168.1.5"}, cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["target"], "192.168.1.5:5555")

        status, payload = self.post("/api/v1/wifi/enable-tcp", {}, cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["port"], 5555)

        status, payload = self.post("/api/v1/wifi/disconnect", {"ip": "192.168.1.5"}, cookie)
        self.assertEqual(status, 200)

    def test_connect_bad_ip_is_400(self):
        cookie = self.cookie()
        status, payload = self.post("/api/v1/wifi/connect", {"ip": "not-an-ip"}, cookie)
        self.assertEqual(status, 400)
        self.assertIn("IPv4", json.loads(payload)["error"])

    def test_mdns_pair_restart_routes_over_http(self):
        cookie = self.cookie()
        status, payload = self.post("/api/v1/wifi/mdns", {}, cookie)
        self.assertEqual(status, 200)
        services = json.loads(payload)["services"]
        self.assertEqual(len(services), 3)
        self.assertEqual(services[1]["type"], "pairing")

        status, payload = self.post(
            "/api/v1/wifi/pair", {"target": "192.168.1.25:42123", "code": "482913"}, cookie
        )
        self.assertEqual(status, 200)
        self.assertIn("Successfully paired", json.loads(payload)["output"])

        status, payload = self.post("/api/v1/wifi/pair", {"target": "192.168.1.25:42123"}, cookie)
        self.assertEqual(status, 400)
        self.assertIn("pairing code", json.loads(payload)["error"])

        status, payload = self.post("/api/v1/adb/restart", {}, cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload), {"ok": True})

    def test_snapshot_exposes_wifi_history(self):
        cookie = self.cookie()
        status, _ = self.post("/api/v1/wifi/connect", {"ip": "192.168.1.9"}, cookie)
        self.assertEqual(status, 200)
        status, payload = self.request("GET", "/api/v1/snapshot", headers={
            "Host": f"127.0.0.1:{self.port}",
            "Cookie": cookie,
            "Origin": f"http://127.0.0.1:{self.port}",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        })
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload)["wifiHistory"], ["192.168.1.9"])


if __name__ == "__main__":
    unittest.main()
