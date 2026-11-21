"""Private localhost dashboard server for DroidSlate.

The server is created on demand by the Win32 tray engine.  It binds only to
an IPv4 loopback address, authenticates every API request with a
process-random token, and serves a fixed, bundled asset directory.  All ADB
operations go through :class:`adb_manager.ADBManager`; the UI never spawns
processes itself.
"""

from __future__ import annotations

import collections
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import shutil
import tempfile
import threading
import time
import urllib.parse

from adb_manager import ADBManager, find_adb, parse_packages

MAX_REQUEST_BYTES = 64 * 1024
MAX_APK_BYTES = 2 * 1024 * 1024 * 1024  # 2 GiB streamed to disk, never buffered
MAX_LOG_RECORDS = 500
DEVICE_REFRESH_INTERVAL = 5.0
VALID_THEMES = {"dark", "light"}
APP_VERSION = "1.0.0"
PACKAGE_NAME_RE = re.compile(r"[A-Za-z0-9._]{1,255}\Z")
APK_NAME_RE = re.compile(r"[^/\\:*?\"<>|\x00-\x1f]{1,200}\.apk\Z", re.IGNORECASE)
SHOT_NAME_RE = re.compile(r"screenshot_\d{8}_\d{6}(_\d+)?\.png\Z")
REBOOT_MODES = ("normal", "recovery", "bootloader")


class DashboardError(RuntimeError):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.status = int(status)


def default_settings() -> dict:
    return {
        "adb_path": "",
        "theme": "dark",
        "selected_device": "",
    }


def _atomic_json(path: str, payload: object) -> None:
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".settings.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


class DroidSlateBackend:
    """State adapter used by the HTTP handler and by unit tests."""

    def __init__(self, data_dir: str, *, adb: ADBManager | None = None):
        self.data_dir = os.path.abspath(data_dir)
        self.settings_path = os.path.join(self.data_dir, "settings.json")
        self.adb = adb or ADBManager()
        self.started_at = time.monotonic()
        self._lock = threading.RLock()
        self._logs: collections.deque[dict] = collections.deque(maxlen=MAX_LOG_RECORDS)
        self._devices: list[dict] = []
        self._devices_checked_at = 0.0
        self._settings = self._load_settings()
        self._apply_adb_setting()
        # APK staging is ephemeral: drop anything a previous session left behind.
        self._stage_dir = os.path.join(self.data_dir, "apk-stage")
        shutil.rmtree(self._stage_dir, ignore_errors=True)
        os.makedirs(self._stage_dir, exist_ok=True)
        self._screenshots_dir = os.path.join(self.data_dir, "screenshots")
        self._install_lock = threading.Lock()
        self._stop_refresh = threading.Event()
        self._refresh_thread = threading.Thread(
            target=self._refresh_loop, name="DroidSlateDeviceRefresh", daemon=True
        )
        self._refresh_thread.start()

    # -- settings ----------------------------------------------------------

    def _load_settings(self) -> dict:
        settings = default_settings()
        if os.path.exists(self.settings_path):
            try:
                with open(self.settings_path, "r", encoding="utf-8-sig") as handle:
                    payload = json.load(handle)
                if isinstance(payload, dict):
                    for key in settings:
                        if key in payload:
                            settings[key] = payload[key]
            except (OSError, ValueError):
                pass
        return settings

    def _save_settings(self) -> None:
        _atomic_json(self.settings_path, self._settings)

    def _apply_adb_setting(self) -> None:
        explicit = self._settings.get("adb_path") or ""
        if explicit:
            self.adb.set_adb_path(explicit)

    def save_settings(self, payload: dict) -> dict:
        with self._lock:
            if "adbPath" in payload:
                adb_path = payload["adbPath"]
                if not isinstance(adb_path, str) or len(adb_path) > 1024:
                    raise DashboardError("The ADB path must be text.")
                adb_path = adb_path.strip()
                if adb_path and not self.adb.set_adb_path(adb_path):
                    raise DashboardError("That path does not contain an adb executable.")
                self._settings["adb_path"] = adb_path
                if not adb_path:
                    self.adb.adb_path = find_adb()
            if "theme" in payload:
                if payload["theme"] not in VALID_THEMES:
                    raise DashboardError("Unknown color theme.")
                self._settings["theme"] = payload["theme"]
            self._save_settings()
            return self._public_settings()

    def _public_settings(self) -> dict:
        return {
            "adbPath": self._settings.get("adb_path", ""),
            "theme": self._settings.get("theme", "dark"),
        }

    # -- logging -----------------------------------------------------------

    def log(self, level: str, tag: str, message: str) -> None:
        record = {
            "id": secrets.token_hex(6),
            "time": time.strftime("%H:%M:%S"),
            "level": level,
            "tag": tag,
            "message": str(message)[:4000],
        }
        with self._lock:
            self._logs.append(record)

    def logs(self) -> list[dict]:
        with self._lock:
            return list(self._logs)[-200:]

    # -- devices -----------------------------------------------------------

    def _refresh_loop(self) -> None:
        while not self._stop_refresh.wait(DEVICE_REFRESH_INTERVAL):
            try:
                self.refresh_devices(silent=True)
            except Exception:
                pass

    def refresh_devices(self, *, silent: bool = False) -> list[dict]:
        devices = self.adb.get_devices()
        with self._lock:
            previous = {item["id"] for item in self._devices}
            current = {item["id"] for item in devices}
            self._devices = devices
            self._devices_checked_at = time.monotonic()
            selected = self._settings.get("selected_device", "")
            if selected and selected not in current:
                self._settings["selected_device"] = ""
                self._save_settings()
                if not silent:
                    self.log("WARN", "DEVICE", f"Device {selected} disconnected.")
            elif not selected and len(devices) == 1 and devices[0]["status"] == "device":
                self._settings["selected_device"] = devices[0]["id"]
                self._save_settings()
        if not silent and previous != current:
            added = current - previous
            removed = previous - current
            for device_id in sorted(added):
                self.log("INFO", "DEVICE", f"Device connected: {device_id}")
            for device_id in sorted(removed):
                self.log("INFO", "DEVICE", f"Device disconnected: {device_id}")
        return devices

    def devices(self) -> list[dict]:
        with self._lock:
            return list(self._devices)

    def selected_device(self) -> str:
        with self._lock:
            return self._settings.get("selected_device", "")

    def select_device(self, serial: str) -> dict:
        if not isinstance(serial, str):
            raise DashboardError("The device id must be text.")
        with self._lock:
            known = {item["id"] for item in self._devices}
            if serial and serial not in known:
                raise DashboardError("That device is not connected.", 404)
            self._settings["selected_device"] = serial
            self._save_settings()
            if serial:
                self.log("INFO", "DEVICE", f"Selected device: {serial}")
            return {"selectedDevice": serial}

    def _require_device(self) -> str:
        serial = self.selected_device()
        if not serial:
            raise DashboardError("Select a connected device first.", 409)
        return serial

    def device_info(self, serial: str) -> dict:
        if not isinstance(serial, str) or not serial:
            raise DashboardError("The device id must be text.")
        return self.adb.get_device_info(serial)

    # -- apps --------------------------------------------------------------

    @staticmethod
    def _validate_package(package: object) -> str:
        if not isinstance(package, str) or not PACKAGE_NAME_RE.fullmatch(package):
            raise DashboardError("That is not a valid package name.")
        return package

    def list_apps(self) -> dict:
        """Classify every package on the device for the Apps page.

        Four ``pm list packages`` queries: installed, installed+uninstalled-for-user,
        third-party only, disabled only.  Their set differences give each package
        its installed/system/disabled flags without per-package round-trips.
        """
        serial = self._require_device()

        def query(*flags: str) -> set[str]:
            result = self.adb.run(["shell", "pm", "list", "packages", *flags], serial=serial)
            if not result["success"]:
                detail = (result["stderr"] or result["stdout"] or "pm failed").strip()
                raise DashboardError(f"Could not list packages: {detail[:300]}", 500)
            return set(parse_packages(result["stdout"]))

        installed = query()
        known = query("-u")
        third_party = query("-3")
        disabled = query("-d")

        apps = [
            {
                "name": name,
                "system": name not in third_party,
                "installed": name in installed,
                "disabled": name in disabled,
            }
            for name in sorted(known, key=str.lower)
        ]
        return {"apps": apps, "device": serial}

    def _apk_result_ok(self, result: dict) -> bool:
        # adb sometimes reports failures on stdout while exiting 0.
        combined = f"{result.get('stdout', '')}{result.get('stderr', '')}"
        return bool(result.get("success")) and "Failure" not in combined

    def uninstall_app(self, payload: dict) -> dict:
        package = self._validate_package(payload.get("package"))
        serial = self._require_device()
        result = self.adb.uninstall(serial, package)
        if not self._apk_result_ok(result):
            detail = (result["stderr"] or result["stdout"] or "uninstall failed").strip()
            raise DashboardError(f"Uninstall failed: {detail[:300]}", 500)
        self.log("INFO", "APPS", f"Uninstalled {package}")
        return {"ok": True, "package": package}

    def reinstall_app(self, payload: dict) -> dict:
        package = self._validate_package(payload.get("package"))
        serial = self._require_device()
        result = self.adb.reinstall(serial, package)
        if not self._apk_result_ok(result):
            detail = (result["stderr"] or result["stdout"] or "reinstall failed").strip()
            raise DashboardError(f"Reinstall failed: {detail[:300]}", 500)
        self.log("INFO", "APPS", f"Restored {package}")
        return {"ok": True, "package": package}

    def set_app_enabled(self, payload: dict) -> dict:
        package = self._validate_package(payload.get("package"))
        enabled = payload.get("enabled")
        if not isinstance(enabled, bool):
            raise DashboardError("The enabled flag must be true or false.")
        serial = self._require_device()
        result = self.adb.set_package_enabled(serial, package, enabled)
        if not result["success"]:
            detail = (result["stderr"] or result["stdout"] or "pm failed").strip()
            raise DashboardError(f"Could not change package state: {detail[:300]}", 500)
        verb = "Enabled" if enabled else "Disabled"
        self.log("INFO", "APPS", f"{verb} {package}")
        return {"ok": True, "package": package, "enabled": enabled}

    def stage_apk(self, filename: object, stream, length: int) -> dict:
        """Stream one uploaded APK into the staging directory (never in memory)."""
        if not isinstance(filename, str) or not APK_NAME_RE.fullmatch(filename):
            raise DashboardError("APK file names must end in .apk and contain no path separators.")
        if length <= 0:
            raise DashboardError("The upload is empty.", 411)
        if length > MAX_APK_BYTES:
            raise DashboardError("That APK is larger than 2 GiB.", 413)
        path = os.path.join(self._stage_dir, filename)
        remaining = length
        try:
            with open(path, "wb") as handle:
                while remaining > 0:
                    chunk = stream.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    handle.write(chunk)
                    remaining -= len(chunk)
        except OSError as exc:
            raise DashboardError(f"Could not store the APK: {exc}", 400) from exc
        if remaining > 0:
            try:
                os.unlink(path)
            except OSError:
                pass
            raise DashboardError("The upload was truncated.", 400)
        self.log("INFO", "APPS", f"Staged {filename} ({length} bytes)")
        return {"name": filename, "size": length}

    def install_staged(self, payload: dict) -> dict:
        files = payload.get("files")
        if not isinstance(files, list) or not 1 <= len(files) <= 32:
            raise DashboardError("Select one or more staged APK files (max 32).")
        names = []
        for item in files:
            if not isinstance(item, str) or not APK_NAME_RE.fullmatch(item):
                raise DashboardError("Invalid staged file name.")
            if item not in names:
                names.append(item)
        paths = []
        for name in names:
            path = os.path.join(self._stage_dir, name)
            if not os.path.isfile(path):
                raise DashboardError(f"Staged file missing: {name}", 404)
            paths.append(path)
        serial = self._require_device()
        with self._install_lock:
            try:
                if len(paths) == 1:
                    result = self.adb.install_apk(serial, paths[0])
                else:
                    result = self.adb.install_multiple(serial, paths)
            finally:
                for path in paths:
                    try:
                        os.unlink(path)
                    except OSError:
                        pass
        if not self._apk_result_ok(result):
            detail = (result["stderr"] or result["stdout"] or "install failed").strip()
            raise DashboardError(f"Install failed: {detail[:400]}", 500)
        label = names[0] if len(names) == 1 else f"{len(names)} split APKs"
        self.log("INFO", "APPS", f"Installed {label}")
        return {"ok": True, "files": names}

    # -- device actions ----------------------------------------------------

    def take_screenshot(self) -> dict:
        serial = self._require_device()
        os.makedirs(self._screenshots_dir, exist_ok=True)
        stem = time.strftime("screenshot_%Y%m%d_%H%M%S")
        name = f"{stem}.png"
        counter = 2
        while os.path.exists(os.path.join(self._screenshots_dir, name)):
            name = f"{stem}_{counter}.png"
            counter += 1
        path = os.path.join(self._screenshots_dir, name)
        result = self.adb.screenshot(serial, path)
        if not result.get("success"):
            raise DashboardError(result.get("stderr") or "Screenshot failed.", 500)
        self.log("INFO", "DEVICE", f"Screenshot saved: {name}")
        return {"name": name, "url": f"/shots/{name}", "path": path}

    def latest_screenshot(self) -> dict:
        if not os.path.isdir(self._screenshots_dir):
            return {"none": True}
        newest = None
        for entry in os.listdir(self._screenshots_dir):
            if SHOT_NAME_RE.fullmatch(entry):
                candidate = os.path.join(self._screenshots_dir, entry)
                if newest is None or os.path.getmtime(candidate) > os.path.getmtime(newest):
                    newest = candidate
        if not newest:
            return {"none": True}
        name = os.path.basename(newest)
        return {"name": name, "url": f"/shots/{name}", "path": newest}

    def shot_file(self, name: str) -> str | None:
        """Resolve an authenticated /shots/ request to a real screenshot path."""
        if not isinstance(name, str) or not SHOT_NAME_RE.fullmatch(name):
            return None
        path = os.path.join(self._screenshots_dir, name)
        root = os.path.realpath(self._screenshots_dir)
        real = os.path.realpath(path)
        if os.path.commonpath((root, real)) != root or not os.path.isfile(real):
            return None
        return real

    def open_screenshots_folder(self) -> dict:
        os.makedirs(self._screenshots_dir, exist_ok=True)
        if not hasattr(os, "startfile"):
            raise DashboardError("Opening folders is only supported on Windows.", 500)
        try:
            os.startfile(self._screenshots_dir)  # noqa: S606 - fixed per-user folder, no user input
        except OSError as exc:
            raise DashboardError(f"Could not open the folder: {exc}", 500) from exc
        self.log("INFO", "DEVICE", "Opened screenshots folder")
        return {"ok": True, "path": self._screenshots_dir}

    def reboot_device(self, payload: dict) -> dict:
        mode = payload.get("mode", "normal")
        if mode not in REBOOT_MODES:
            raise DashboardError("Unknown reboot mode.")
        serial = self._require_device()
        result = self.adb.reboot(serial, mode)
        if not result["success"]:
            detail = (result["stderr"] or "reboot failed").strip()
            raise DashboardError(f"Reboot failed: {detail[:300]}", 500)
        suffix = "" if mode == "normal" else f" ({mode})"
        self.log("WARN", "DEVICE", f"Rebooting {serial}{suffix}")
        return {"ok": True, "mode": mode}

    # -- shell -------------------------------------------------------------

    def run_shell(self, payload: dict) -> dict:
        command = payload.get("command")
        if not isinstance(command, str) or not command.strip():
            raise DashboardError("Enter a command to run.")
        if len(command) > 8192:
            raise DashboardError("The command is too long.")
        serial = self._require_device()
        self.log("INFO", "SHELL", f"$ {command.strip()[:200]}")

        def worker() -> None:
            result = self.adb.shell(serial, command, timeout=60)
            output = (result["stdout"] or "") + (result["stderr"] or "")
            for line in output.splitlines():
                self.log("INFO" if result["success"] else "ERROR", "SHELL", line)
            if not output.strip():
                self.log("INFO", "SHELL", "(no output)")
            self.log("INFO" if result["success"] else "ERROR", "SHELL",
                     f"Exit code {result['returncode']}")

        threading.Thread(target=worker, name="DroidSlateShell", daemon=True).start()
        return {"ok": True}

    # -- logcat ------------------------------------------------------------

    def start_logcat(self) -> dict:
        serial = self._require_device()
        if self.adb.logcat_running():
            return {"running": True}
        result = self.adb.start_logcat(serial, lambda line: self.log("INFO", "LOGCAT", line))
        if not result.get("success"):
            self.log("ERROR", "LOGCAT", result.get("stderr", "Logcat failed to start."))
            raise DashboardError(result.get("stderr", "Logcat failed to start."), 500)
        self.log("INFO", "LOGCAT", f"Logcat streaming started for {serial}.")
        return {"running": True}

    def stop_logcat(self) -> dict:
        self.adb.stop_logcat()
        self.log("INFO", "LOGCAT", "Logcat streaming stopped.")
        return {"running": False}

    def logcat_status(self) -> dict:
        return {"running": self.adb.logcat_running(), "serial": self.adb.logcat_serial()}

    # -- snapshot ----------------------------------------------------------

    def snapshot(self) -> dict:
        with self._lock:
            settings = self._public_settings()
            devices = list(self._devices)
            selected = self._settings.get("selected_device", "")
            adb_path = self.adb.adb_path
            logcat = {"running": self.adb.logcat_running(), "serial": self.adb.logcat_serial()}
        return {
            "runtime": {
                "version": APP_VERSION,
                "adbPath": adb_path,
                "adbFound": bool(adb_path and os.path.isfile(adb_path)) or adb_path == "adb",
                "uptimeSeconds": int(time.monotonic() - self.started_at),
                "theme": settings["theme"],
            },
            "devices": devices,
            "selectedDevice": selected,
            "settings": settings,
            "logcat": logcat,
            "logs": self.logs(),
        }

    def close(self) -> None:
        self._stop_refresh.set()
        self.adb.stop_logcat()


class _DroidSlateHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, address, handler, *, backend: DroidSlateBackend, assets_dir: str, token: str):
        self.backend = backend
        self.assets_dir = os.path.abspath(assets_dir)
        self.token = token  # one-time bootstrap capability; never used after exchange
        self.session_token = secrets.token_urlsafe(32)
        self.bootstrap_used = False
        self.session_lock = threading.Lock()
        super().__init__(address, handler)

    def rotate_session(self) -> str:
        """Issue a fresh bootstrap/session pair before each WebView process."""
        with self.session_lock:
            self.token = secrets.token_urlsafe(32)
            self.session_token = secrets.token_urlsafe(32)
            self.bootstrap_used = False
            return self.token


class DroidSlateRequestHandler(BaseHTTPRequestHandler):
    server_version = "DroidSlate"
    sys_version = ""

    def setup(self):
        super().setup()
        # A local process must not be able to hold unbounded handler threads open with
        # partial headers or bodies. Normal dashboard requests complete in milliseconds.
        self.connection.settimeout(10)

    def log_message(self, _format, *_args):
        return

    @property
    def app(self) -> _DroidSlateHTTPServer:
        return self.server  # type: ignore[return-value]

    def _security_headers(self, *, content_type: str, length: int, cache: str = "no-store") -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", cache)
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")

    def _json(self, status: int, payload: object, *, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        if self.close_connection:
            # Rejected uploads never drain their request body; tell the client
            # to stop reusing this connection instead of parsing body as headers.
            self.send_header("Connection", "close")
        self._security_headers(content_type="application/json; charset=utf-8", length=len(body))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _error(self, status: int, message: str) -> None:
        self._json(status, {"error": message})

    def _valid_host(self) -> bool:
        expected = f"127.0.0.1:{self.app.server_port}"
        return self.headers.get("Host", "") == expected

    def _authorized(self) -> bool:
        supplied = ""
        for part in self.headers.get("Cookie", "").split(";"):
            name, separator, value = part.strip().partition("=")
            if separator and name == "DroidSlateSession":
                supplied = value
                break
        return secrets.compare_digest(supplied, self.app.session_token)

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        expected = f"http://127.0.0.1:{self.app.server_port}"
        return origin == expected

    def _fetch_metadata_allowed(self) -> bool:
        """Accept API calls only from this document's own Chromium fetch context.

        The launch capability/session cookie remains the primary control. Fetch Metadata
        independently blocks cross-site browser requests even if a future browser/CORS
        regression were to expose an authenticated request primitive.
        """
        return (
            self.headers.get("Sec-Fetch-Site") == "same-origin"
            and self.headers.get("Sec-Fetch-Mode") in ("cors", "same-origin")
            and self.headers.get("Sec-Fetch-Dest") == "empty"
        )

    def _parse_json(self) -> dict:
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise DashboardError("Content-Type must be application/json.", 415)
        length_text = self.headers.get("Content-Length")
        if not length_text or not length_text.isdigit():
            raise DashboardError("A valid Content-Length is required.", 411)
        length = int(length_text)
        if length > MAX_REQUEST_BYTES:
            raise DashboardError("The request body is too large.", 413)
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as exc:
            raise DashboardError("The request body is not valid JSON.") from exc
        if not isinstance(payload, dict):
            raise DashboardError("The request body must be an object.")
        return payload

    def _before_api(self, *, mutate: bool) -> bool:
        if not self._valid_host():
            self._error(421, "Invalid host.")
            return False
        if not self._authorized():
            self._error(401, "Unauthorized.")
            return False
        if not self._fetch_metadata_allowed():
            self._error(403, "Invalid browser request context.")
            return False
        if mutate and not self._origin_allowed():
            self._error(403, "Invalid origin.")
            return False
        return True

    def _bootstrap_session(self) -> None:
        if not self._valid_host():
            self._error(421, "Invalid host.")
            return
        if not self._fetch_metadata_allowed() or not self._origin_allowed():
            self._error(403, "Invalid browser request context.")
            return
        supplied = self.headers.get("Authorization", "")
        if not secrets.compare_digest(supplied, f"Bearer {self.app.token}"):
            self._error(401, "Unauthorized.")
            return
        try:
            self._parse_json()
        except DashboardError as exc:
            self._error(exc.status, str(exc))
            return
        with self.app.session_lock:
            if self.app.bootstrap_used:
                self._error(401, "Bootstrap capability has already been used.")
                return
            self.app.bootstrap_used = True
        self._json(200, {"ok": True}, headers={
            "Set-Cookie": (
                f"DroidSlateSession={self.app.session_token}; "
                "HttpOnly; SameSite=Strict; Path=/"
            ),
        })

    def _dispatch_api(self) -> None:
        path = urllib.parse.urlsplit(self.path).path
        if self.command == "POST" and path == "/api/v1/session":
            self._bootstrap_session()
            return
        mutate = self.command != "GET"
        if not self._before_api(mutate=mutate):
            return
        try:
            if self.command == "GET" and path == "/api/v1/snapshot":
                result = self.app.backend.snapshot()
            elif self.command == "GET" and path == "/api/v1/devices":
                result = self.app.backend.refresh_devices()
            elif self.command == "GET" and path == "/api/v1/logs":
                result = self.app.backend.logs()
            elif self.command == "GET" and path == "/api/v1/logcat":
                result = self.app.backend.logcat_status()
            elif self.command == "POST" and path == "/api/v1/devices/select":
                result = self.app.backend.select_device(self._parse_json().get("serial", ""))
            elif self.command == "POST" and path == "/api/v1/devices/info":
                result = self.app.backend.device_info(self._parse_json().get("serial", ""))
            elif self.command == "POST" and path == "/api/v1/shell/run":
                result = self.app.backend.run_shell(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/logcat/start":
                self._parse_json()
                result = self.app.backend.start_logcat()
            elif self.command == "POST" and path == "/api/v1/logcat/stop":
                self._parse_json()
                result = self.app.backend.stop_logcat()
            elif self.command == "PATCH" and path == "/api/v1/settings":
                result = self.app.backend.save_settings(self._parse_json())
            elif self.command == "GET" and path == "/api/v1/apps":
                result = self.app.backend.list_apps()
            elif self.command == "POST" and path == "/api/v1/apps/stage":
                result = self._stage_upload()
            elif self.command == "POST" and path == "/api/v1/apps/install":
                result = self.app.backend.install_staged(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/apps/uninstall":
                result = self.app.backend.uninstall_app(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/apps/reinstall":
                result = self.app.backend.reinstall_app(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/apps/enable":
                result = self.app.backend.set_app_enabled(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/screenshot":
                self._parse_json()
                result = self.app.backend.take_screenshot()
            elif self.command == "GET" and path == "/api/v1/screenshots/latest":
                result = self.app.backend.latest_screenshot()
            elif self.command == "POST" and path == "/api/v1/screenshots/open-folder":
                self._parse_json()
                result = self.app.backend.open_screenshots_folder()
            elif self.command == "POST" and path == "/api/v1/reboot":
                result = self.app.backend.reboot_device(self._parse_json())
            else:
                raise DashboardError("Endpoint not found.", 404)
            self._json(200, result)
        except DashboardError as exc:
            self._error(exc.status, str(exc))
        except Exception:
            self._error(500, "The dashboard request failed.")

    def _stage_upload(self) -> dict:
        """Receive one raw APK body and stream it into the staging directory."""
        # The body may be up to 2 GiB; never let this connection be reused with
        # unread bytes still queued (a rejected upload skips reading entirely).
        self.close_connection = True
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/octet-stream":
            raise DashboardError("Content-Type must be application/octet-stream.", 415)
        length_text = self.headers.get("Content-Length")
        if not length_text or not length_text.isdigit():
            raise DashboardError("A valid Content-Length is required.", 411)
        params = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        filename = (params.get("name") or [""])[0]
        return self.app.backend.stage_apk(filename, self.rfile, int(length_text))

    def _serve_static(self) -> None:
        if not self._valid_host():
            self._error(421, "Invalid host.")
            return
        raw_path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        relative = "index.html" if raw_path in ("", "/") else raw_path.lstrip("/")
        if "\x00" in relative or any(part in ("", ".", "..") for part in Path(relative).parts):
            self._error(404, "Not found.")
            return
        root = os.path.realpath(self.app.assets_dir)
        target = os.path.realpath(os.path.join(root, relative))
        if os.path.commonpath((root, target)) != root or not os.path.isfile(target):
            self._error(404, "Not found.")
            return
        try:
            with open(target, "rb") as handle:
                body = handle.read()
        except OSError:
            self._error(404, "Not found.")
            return
        content_type = (
            "image/svg+xml"
            if target.lower().endswith(".svg")
            else (mimetypes.guess_type(target)[0] or "application/octet-stream")
        )
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        cache = "public, max-age=31536000, immutable" if relative.startswith("assets/") else "no-store"
        self.send_response(200)
        self._security_headers(content_type=content_type, length=len(body), cache=cache)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _serve_shot(self, name: str) -> None:
        """Serve one screenshot to the authenticated same-origin document.

        Images are fetched with ``Sec-Fetch-Dest: image`` (not ``empty``), so
        this path checks Host + session cookie only — never the API's fetch
        metadata rules.
        """
        if not self._valid_host():
            self._error(421, "Invalid host.")
            return
        if not self._authorized():
            self._error(401, "Unauthorized.")
            return
        path = self.app.backend.shot_file(name)
        if not path:
            self._error(404, "Not found.")
            return
        try:
            with open(path, "rb") as handle:
                body = handle.read()
        except OSError:
            self._error(404, "Not found.")
            return
        self.send_response(200)
        self._security_headers(content_type="image/png", length=len(body), cache="private, max-age=60")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path.startswith("/api/"):
            self._dispatch_api()
        elif path.startswith("/shots/"):
            self._serve_shot(urllib.parse.unquote(path[len("/shots/"):]))
        else:
            self._serve_static()

    def do_HEAD(self):
        path = urllib.parse.urlsplit(self.path).path
        if path.startswith("/api/"):
            self._error(405, "Method not allowed.")
        elif path.startswith("/shots/"):
            self._serve_shot(urllib.parse.unquote(path[len("/shots/"):]))
        else:
            self._serve_static()

    def do_POST(self): self._dispatch_api()
    def do_PUT(self): self._dispatch_api()
    def do_PATCH(self): self._dispatch_api()
    def do_DELETE(self): self._dispatch_api()
    def do_OPTIONS(self): self._error(405, "CORS is not enabled.")


def create_dashboard_server(
    backend: DroidSlateBackend,
    assets_dir: str,
    *,
    token: str | None = None,
) -> tuple[_DroidSlateHTTPServer, str]:
    assets_dir = os.path.abspath(assets_dir)
    if not os.path.isfile(os.path.join(assets_dir, "index.html")):
        raise DashboardError("Dashboard assets are missing. Reinstall DroidSlate.", 500)
    session_token = token or secrets.token_urlsafe(32)
    server = _DroidSlateHTTPServer(
        ("127.0.0.1", 0),
        DroidSlateRequestHandler,
        backend=backend,
        assets_dir=assets_dir,
        token=session_token,
    )
    return server, session_token


__all__ = [
    "DroidSlateBackend", "DashboardError", "DroidSlateRequestHandler",
    "create_dashboard_server", "default_settings",
]
