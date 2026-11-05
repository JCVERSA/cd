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
        (self.assets / "logo.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>', encoding="utf-8")
        source_commands = Path(__file__).parents[1] / "commands.json"
        shutil.copy2(source_commands, self.root / "commands.json")
        self.opened_urls: list[str] = []
        self.backend = DashboardBackend(
            str(self.root),
            open_url=lambda url: (self.opened_urls.append(url) is None),
        )
        self.server, self.token = create_dashboard_server(self.backend, str(self.assets), token="test-token")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temporary.cleanup()

    def request(self, method, path, body=None, *, auth=True, origin=True, fetch_metadata=True):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        } if fetch_metadata else {}
        if auth:
            headers["Cookie"] = f"SwiftSlateSession={self.server.session_token}"
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
        policy = response.getheader("Content-Security-Policy")
        self.assertIn("default-src 'none'", policy)
        self.assertIn("script-src 'self'", policy)
        self.assertNotIn("script-src 'self' 'unsafe-inline'", policy)
        self.assertIn("style-src-attr 'unsafe-inline'", policy)
        self.assertEqual(response.getheader("X-Frame-Options"), "DENY")

    def test_bootstrap_capability_becomes_http_only_session_cookie_once(self):
        def exchange():
            connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
            connection.request("POST", "/api/v1/session", body="{}", headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "Origin": f"http://127.0.0.1:{self.server.server_port}",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
            })
            response = connection.getresponse()
            body = json.loads(response.read())
            cookie = response.getheader("Set-Cookie")
            connection.close()
            return response.status, body, cookie

        status, payload, cookie = exchange()
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertNotIn(self.token, cookie)

        status, payload, _ = exchange()
        self.assertEqual(status, 401)
        self.assertEqual(payload["error"], "Bootstrap capability has already been used.")

    def test_session_rotation_invalidates_previous_cookie_and_bootstrap(self):
        previous_session = self.server.session_token
        previous_bootstrap = self.server.token
        self.server.bootstrap_used = True
        fresh_bootstrap = self.server.rotate_session()
        self.assertNotEqual(fresh_bootstrap, previous_bootstrap)
        self.assertNotEqual(self.server.session_token, previous_session)
        self.assertFalse(self.server.bootstrap_used)

    def test_api_rejects_invalid_host_header(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        connection.putrequest("GET", "/api/v1/snapshot", skip_host=True)
        connection.putheader("Host", "attacker.example")
        connection.putheader("Cookie", f"SwiftSlateSession={self.server.session_token}")
        connection.putheader("Sec-Fetch-Site", "same-origin")
        connection.putheader("Sec-Fetch-Mode", "cors")
        connection.putheader("Sec-Fetch-Dest", "empty")
        connection.endheaders()
        response = connection.getresponse()
        payload = json.loads(response.read())
        connection.close()
        self.assertEqual(response.status, 421)
        self.assertEqual(payload["error"], "Invalid host.")

    def test_api_rejects_missing_capability(self):
        status, payload, _ = self.request("GET", "/api/v1/snapshot", auth=False, origin=False)
        self.assertEqual(status, 401)
        self.assertEqual(payload["error"], "Unauthorized.")

    def test_api_rejects_cross_site_or_missing_fetch_metadata(self):
        status, payload, _ = self.request(
            "GET", "/api/v1/snapshot", origin=False, fetch_metadata=False,
        )
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"], "Invalid browser request context.")

    def test_mutating_api_rejects_missing_origin(self):
        status, payload, _ = self.request("PUT", "/api/v1/runtime/pause", {"paused": True}, origin=False)
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"], "Invalid origin.")

    def test_static_server_rejects_encoded_traversal(self):
        status, payload, _ = self.request("GET", "/%2e%2e/commands.json", auth=False, origin=False)
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"], "Not found.")

    def test_api_rejects_oversized_json_before_parsing(self):
        status, payload, _ = self.request(
            "PATCH", "/api/v1/settings", {"padding": "x" * (70 * 1024)},
        )
        self.assertEqual(status, 413)
        self.assertEqual(payload["error"], "The request body is too large.")

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

    def test_api_cannot_create_shell_commands(self):
        command = {
            "id": "danger", "trigger": "danger", "type": "system",
            "prompt": "", "value": "powershell -Command whoami", "enabled": True,
        }
        status, payload, _ = self.request("PUT", "/api/v1/commands/danger", command)
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"], "Unknown or read-only command type.")

    def test_pause_updates_runtime(self):
        status, payload, _ = self.request("PUT", "/api/v1/runtime/pause", {"paused": True})
        self.assertEqual(status, 200)
        self.assertTrue(payload["paused"])

    def test_provider_portal_opens_only_allowlisted_https_url(self):
        status, payload, _ = self.request(
            "POST",
            "/api/v1/providers/deepseek/portal",
            {"url": "https://evil.example/phish"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["url"], "https://platform.deepseek.com/api_keys")
        self.assertEqual(self.opened_urls, ["https://platform.deepseek.com/api_keys"])

        status_custom, payload_custom, _ = self.request("POST", "/api/v1/providers/custom/portal", {})
        self.assertEqual(status_custom, 400)
        self.assertIn("portal", payload_custom["error"].lower())

        status_missing, _, _ = self.request("POST", "/api/v1/providers/unknown/portal", {})
        self.assertEqual(status_missing, 404)
        self.assertEqual(self.opened_urls, ["https://platform.deepseek.com/api_keys"])

    def test_static_server_serves_svg_with_image_svg_xml_mime(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        connection.request("GET", "/logo.svg")
        response = connection.getresponse()
        body = response.read()
        content_type = response.getheader("Content-Type")
        connection.close()
        self.assertEqual(response.status, 200)
        self.assertEqual(content_type, "image/svg+xml")
        self.assertIn(b"<svg", body)


if __name__ == "__main__":
    unittest.main()
