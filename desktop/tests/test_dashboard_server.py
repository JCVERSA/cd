import http.client
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest

from dashboard_server import DashboardBackend, create_dashboard_server


class DashboardServerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.assets = self.root / "assets"
        self.assets.mkdir()
        (self.assets / "index.html").write_text("<!doctype html><title>SwiftSlate</title>", encoding="utf-8")
        source_commands = Path(__file__).parents[1] / "commands.json"
        shutil.copy2(source_commands, self.root / "commands.json")
        self.backend = DashboardBackend(str(self.root))
        self.server, self.token = create_dashboard_server(self.backend, str(self.assets), token="test-token")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temporary.cleanup()

    def request(self, method, path, body=None, *, auth=True, origin=True):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {}
        if auth:
            headers["Authorization"] = f"Bearer {self.token}"
        if origin:
            headers["Origin"] = f"http://127.0.0.1:{self.server.server_port}"
        if body is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(body)
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        payload = response.read()
        result = json.loads(payload) if response.getheader("Content-Type", "").startswith("application/json") else payload
        connection.close()
        return response.status, result, response

    def test_static_shell_is_served_with_restrictive_policy(self):
        status, body, response = self.request("GET", "/", auth=False, origin=False)
        self.assertEqual(status, 200)
        self.assertIn(b"SwiftSlate", body)
        self.assertIn("default-src 'none'", response.getheader("Content-Security-Policy"))
        self.assertEqual(response.getheader("X-Frame-Options"), "DENY")

    def test_api_rejects_missing_capability(self):
        status, payload, _ = self.request("GET", "/api/v1/snapshot", auth=False, origin=False)
        self.assertEqual(status, 401)
        self.assertEqual(payload["error"], "Unauthorized.")

    def test_mutating_api_rejects_missing_origin(self):
        status, payload, _ = self.request("PUT", "/api/v1/runtime/pause", {"paused": True}, origin=False)
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"], "Invalid origin.")

    def test_snapshot_contains_all_providers_and_no_credentials(self):
        status, payload, _ = self.request("GET", "/api/v1/snapshot", origin=False)
        self.assertEqual(status, 200)
        self.assertEqual(len(payload["providers"]), 10)
        self.assertNotIn("api_key", json.dumps(payload))
        self.assertGreaterEqual(len(payload["commands"]), 18)

    def test_command_update_preserves_builtin_shell_commands(self):
        command = {
            "id": "fix", "trigger": "fix", "type": "ai", "prompt": "Polish it.",
            "value": "", "enabled": True, "uses": 0,
        }
        status, payload, _ = self.request("PUT", "/api/v1/commands/fix", command)
        self.assertEqual(status, 200)
        self.assertEqual(payload["prompt"], "Polish it.")
        persisted = json.loads((self.root / "commands.json").read_text(encoding="utf-8"))
        date = next(item for item in persisted if item["trigger"] == "date")
        self.assertEqual(date["type"], "replacer-shell")

    def test_pause_updates_runtime(self):
        status, payload, _ = self.request("PUT", "/api/v1/runtime/pause", {"paused": True})
        self.assertEqual(status, 200)
        self.assertTrue(payload["paused"])


if __name__ == "__main__":
    unittest.main()
