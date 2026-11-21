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
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import platform as platform_module
from datetime import datetime, timezone

from adb_manager import ADBManager, find_adb, parse_packages
from bundle_inspect import BundleError, extract_entries, inspect_bundle, plan_install
from degoogle import (
    ALL_SET,
    BUCKETS,
    empty_state,
    load_state,
    save_state,
    simple_candidates,
)
from win32_dialogs import dialogs_supported, pick_files, pick_save_path

MAX_REQUEST_BYTES = 64 * 1024
MAX_APK_BYTES = 2 * 1024 * 1024 * 1024  # 2 GiB streamed to disk, never buffered
MAX_LOG_RECORDS = 500
DEVICE_REFRESH_INTERVAL = 5.0
VALID_THEMES = {"dark", "light"}
APP_VERSION = "1.0.0"
PACKAGE_NAME_RE = re.compile(r"[A-Za-z0-9._]{1,255}\Z")
APK_NAME_RE = re.compile(r"[^/\\:*?\"<>|\x00-\x1f]{1,200}\.apk\Z", re.IGNORECASE)
BUNDLE_NAME_RE = re.compile(
    r"[^/\\:*?\"<>|\x00-\x1f]{1,200}\.(apk|apks|xapk|apkm|zip)\Z", re.IGNORECASE
)
SHOT_NAME_RE = re.compile(r"screenshot_\d{8}_\d{6}(_\d+)?\.png\Z")
REBOOT_MODES = ("normal", "recovery", "bootloader")
DROP_NAME_RE = re.compile(r"[^/\\:*?\"<>|\x00-\x1f]{1,200}\Z")
PLATFORM_TOOLS_INDEX_URL = "https://dl.google.com/android/repository/repository2-3.xml"
PLATFORM_TOOLS_PAGE_URL = "https://developer.android.com/tools/releases/platform-tools"


def _fetch_platform_tools_index() -> str:
    """Download Google's repository index (small XML) for version lookups."""
    request = urllib.request.Request(
        PLATFORM_TOOLS_INDEX_URL, headers={"User-Agent": "DroidSlate/1.0"}
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.read(4_000_000).decode("utf-8", "replace")


def parse_platform_tools_version(xml_text: str) -> str | None:
    """Extract the platform-tools revision from the repository XML.

    Defensive: any layout change yields ``None`` ( surfaced as "could not
    check" in the UI) instead of a crash or a wrong version.
    """
    block = re.search(
        r'<remotePackage path="platform-tools"[^>]*>(.*?)</remotePackage>',
        xml_text,
        re.DOTALL,
    )
    if not block:
        return None
    revision = re.search(r"<revision>(.*?)</revision>", block.group(1), re.DOTALL)
    if not revision:
        return None
    body = revision.group(1)
    major = re.search(r"<major>(\d+)</major>", body)
    if not major:
        return None
    minor = re.search(r"<minor>(\d+)</minor>", body)
    micro = re.search(r"<micro>(\d+)</micro>", body)
    return ".".join(
        [
            major.group(1),
            minor.group(1) if minor else "0",
            micro.group(1) if micro else "0",
        ]
    )


def _version_key(value: str) -> tuple[int, ...]:
    parts = []
    for piece in value.split("."):
        parts.append(int(piece) if piece.isdigit() else 0)
    return tuple(parts)


_IPV4_RE = re.compile(
    r"^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}"
    r"(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$"
)


class DashboardError(RuntimeError):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.status = int(status)


def default_settings() -> dict:
    return {
        "adb_path": "",
        "theme": "dark",
        "selected_device": "",
        "wifi_history": [],
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
        self._degoogle_path = os.path.join(self.data_dir, "degoogle_state.json")
        self._degoogle_lock = threading.Lock()
        self._degoogle_job: dict = {
            "running": False, "phase": "", "done": 0, "total": 0, "current": "",
            "lastRun": None, "lastUndo": None,
        }
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

    def stage_apk(self, filename: object, stream, length: int, *, name_re=None) -> dict:
        """Stream one uploaded file into the staging directory (never in memory)."""
        pattern = name_re or APK_NAME_RE
        if not isinstance(filename, str) or not pattern.fullmatch(filename):
            raise DashboardError(
                "File name must be a plain .apk name."
                if pattern is APK_NAME_RE else
                "File name must be a plain .apk/.apks/.xapk/.apkm/.zip name."
            )
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

    # -- installer ---------------------------------------------------------

    def _bundle_path(self, value: object) -> tuple[str, str]:
        """Validate a staged bundle name and return ``(name, realpath)``."""
        if not isinstance(value, str) or not BUNDLE_NAME_RE.fullmatch(value):
            raise DashboardError("Invalid bundle file name.")
        path = os.path.realpath(os.path.join(self._stage_dir, value))
        if os.path.dirname(path) != os.path.realpath(self._stage_dir):
            raise DashboardError("Invalid bundle file name.")
        if not os.path.isfile(path):
            raise DashboardError("Staged bundle not found.", 404)
        return value, path

    def inspect_staged_bundle(self, payload: dict) -> dict:
        """Describe a staged bundle; adds device split plan when connected."""
        name, path = self._bundle_path(payload.get("filename"))
        try:
            info = inspect_bundle(path, name)
        except BundleError as exc:
            raise DashboardError(str(exc), 400) from exc
        profile = None
        plan = None
        try:
            self._require_device()
            serial = self._settings.get("selected_device")
            profile = self.adb.device_install_profile(serial)
            names = [name] if info["single"] else [a["name"] for a in info["apks"]]
            plan = plan_install(names, profile)
        except DashboardError:
            pass  # no device: contents preview still works
        except BundleError as exc:
            plan = {"selected": [], "notes": [str(exc)]}
        return {**info, "device": profile, "plan": plan}

    def install_staged_bundle(self, payload: dict) -> dict:
        """Extract the matching split set and install it, then push OBB."""
        name, path = self._bundle_path(payload.get("filename"))
        options = payload.get("options")
        if options is None:
            options = {}
        if not isinstance(options, dict):
            raise DashboardError("Invalid install options.")
        reinstall = options.get("reinstall", True)
        downgrade = options.get("downgrade", False)
        grant = options.get("grant", False)
        push_obb = options.get("obb", True)
        for flag_name, flag in (("reinstall", reinstall), ("downgrade", downgrade),
                                ("grant", grant), ("obb", push_obb)):
            if not isinstance(flag, bool):
                raise DashboardError(f"The {flag_name} option must be true or false.")
        serial = self._require_device()
        try:
            info = inspect_bundle(path, name)
        except BundleError as exc:
            raise DashboardError(str(exc), 400) from exc

        extract_dir: str | None = None
        pushed: list[str] = []
        obb_failed: list[str] = []
        notes: list[str] = []
        obb_paths: list[str] = []
        package = (info.get("meta") or {}).get("package")
        try:
            if info["single"]:
                apk_paths = [path]
                selected = [name]
            else:
                profile = self.adb.device_install_profile(serial)
                try:
                    plan = plan_install([a["name"] for a in info["apks"]], profile)
                except BundleError as exc:
                    raise DashboardError(str(exc), 400) from exc
                selected = plan["selected"]
                notes.extend(plan["notes"])
                extract_dir = os.path.join(self._stage_dir, name + ".extract")
                shutil.rmtree(extract_dir, ignore_errors=True)
                try:
                    apk_paths = extract_entries(path, selected, extract_dir)
                except BundleError as exc:
                    raise DashboardError(str(exc), 400) from exc

                obb_entries = info.get("obb") or []
                if obb_entries and push_obb and package:
                    try:
                        obb_paths = extract_entries(
                            path, [o["name"] for o in obb_entries], extract_dir,
                        )
                    except BundleError as exc:
                        notes.append(f"OBB skipped: {exc}")
                        obb_paths = []
                else:
                    obb_paths = []
                    if obb_entries and not push_obb:
                        notes.append("OBB data not pushed (disabled).")
                    elif obb_entries and not package:
                        notes.append("OBB data skipped: package name unknown.")

            with self._install_lock:
                try:
                    if len(apk_paths) == 1:
                        result = self.adb.install_apk(
                            serial, apk_paths[0], reinstall=reinstall,
                            downgrade=downgrade, grant=grant,
                        )
                    else:
                        result = self.adb.install_multiple(
                            serial, apk_paths, reinstall=reinstall,
                            downgrade=downgrade, grant=grant,
                        )
                    if not self._apk_result_ok(result):
                        detail = (result.get("stderr") or result.get("stdout")
                                  or "install failed").strip()
                        raise DashboardError(f"Install failed: {detail[:400]}", 500)
                    for obb_path in obb_paths:
                        target = f"/sdcard/Android/obb/{package}/{os.path.basename(obb_path)}"
                        push_result = self.adb.push(serial, obb_path, target, timeout=1800)
                        if push_result.get("success"):
                            pushed.append(target)
                        else:
                            obb_failed.append(target)
                finally:
                    if extract_dir:
                        shutil.rmtree(extract_dir, ignore_errors=True)
        finally:
            if extract_dir:
                shutil.rmtree(extract_dir, ignore_errors=True)

        combined = f"{result.get('stdout', '')}{result.get('stderr', '')}".strip()
        self.log("INFO", "APPS", f"Installed bundle {name} ({len(apk_paths)} apk(s))")
        return {
            "ok": True, "filename": name, "format": info["format"],
            "installed": len(apk_paths), "selected": selected,
            "obbPushed": pushed, "obbFailed": obb_failed,
            "notes": notes, "output": combined[-400:],
        }

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

    # -- files -------------------------------------------------------------

    @staticmethod
    def _require_text(value: object, *, max_len: int, label: str) -> str:
        if not isinstance(value, str) or not value or len(value) > max_len or "\x00" in value:
            raise DashboardError(f"Invalid {label}.")
        return value

    @staticmethod
    def _require_device_path(value: object, *, label: str = "device path") -> str:
        path = DroidSlateBackend._require_text(value, max_len=4096, label=label)
        if not path.startswith("/"):
            raise DashboardError("Device paths must be absolute.")
        return path

    def list_local_dir(self, path_arg: object) -> dict:
        path = self._require_text(path_arg or os.path.expanduser("~"), max_len=32768, label="folder path")
        if not os.path.isdir(path):
            raise DashboardError("That folder does not exist.", 404)
        entries: list[dict] = []
        try:
            with os.scandir(path) as iterator:
                for entry in iterator:
                    try:
                        is_link = entry.is_symlink()
                        is_dir = entry.is_dir()
                        stat = entry.stat()
                        size = 0 if is_dir else stat.st_size
                        modified = time.strftime("%Y-%m-%d %H:%M", time.localtime(stat.st_mtime))
                    except OSError:
                        continue  # vanished or broken symlink
                    entries.append({
                        "name": entry.name,
                        "size": size,
                        "modified": modified,
                        "is_dir": is_dir,
                        "is_link": is_link,
                        "permissions": "",
                    })
        except PermissionError as exc:
            raise DashboardError("Access denied to that folder.", 403) from exc
        except OSError as exc:
            raise DashboardError(f"Could not list that folder: {exc}", 400) from exc
        entries.sort(key=lambda item: (not item["is_dir"], item["name"].lower()))
        absolute = os.path.abspath(path)
        parent = os.path.dirname(absolute)
        drives = None
        if sys.platform == "win32":
            drives = [f"{letter}:\\" for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                      if os.path.isdir(f"{letter}:\\")]
        return {
            "path": absolute,
            "parent": parent if parent != absolute else None,
            "entries": entries,
            "drives": drives,
        }

    def list_device_dir(self, path_arg: object) -> dict:
        serial = self._require_device()
        path = self._require_device_path(path_arg or "/sdcard")
        result = self.adb.list_device_dir(serial, path)
        if not result["success"]:
            raise DashboardError(result["stderr"] or "Could not list that folder.", 400)
        if path == "/":
            parent = None
        else:
            parent = path.rsplit("/", 1)[0] or "/"
        return {"path": path, "parent": parent, "entries": result["entries"]}

    def push_file(self, payload: dict) -> dict:
        serial = self._require_device()
        local = self._require_text(payload.get("localPath"), max_len=32768, label="file path")
        device = self._require_device_path(payload.get("devicePath"), label="destination")
        if not os.path.isfile(local):
            raise DashboardError("That file no longer exists.", 404)
        result = self.adb.push(serial, local, device, timeout=600)
        if not result["success"]:
            detail = (result["stderr"] or result["stdout"] or "push failed").strip()
            raise DashboardError(f"Push failed: {detail[:400]}", 500)
        self.log("INFO", "FILES", f"Pushed {os.path.basename(local)} → {device}")
        return {"ok": True, "to": device}

    def pull_file(self, payload: dict) -> dict:
        serial = self._require_device()
        device = self._require_device_path(payload.get("devicePath"), label="source")
        local = self._require_text(payload.get("localPath"), max_len=32768, label="file path")
        if not os.path.isabs(local):
            raise DashboardError("The local destination must be an absolute path.")
        parent = os.path.dirname(os.path.abspath(local))
        if not os.path.isdir(parent):
            raise DashboardError("The destination folder does not exist.", 404)
        result = self.adb.pull(serial, device, local, timeout=600)
        if not result["success"]:
            detail = (result["stderr"] or result["stdout"] or "pull failed").strip()
            raise DashboardError(f"Pull failed: {detail[:400]}", 500)
        self.log("INFO", "FILES", f"Pulled {device} → {local}")
        return {"ok": True, "path": local}

    def push_pick(self, payload: dict) -> dict:
        """Open the native file picker and push the selection to the device."""
        serial = self._require_device()
        device_dir = self._require_device_path(payload.get("deviceDir"), label="device folder")
        if not dialogs_supported():
            raise DashboardError("Native file dialogs require Windows.", 501)
        picked = pick_files(title="Select files to push to the device")
        if not picked:
            return {"cancelled": True}
        results = []
        for path in picked:
            if not os.path.isfile(path):
                results.append({"file": path, "ok": False, "error": "Not a regular file."})
                continue
            name = os.path.basename(path.replace("\\", "/"))
            target = f"{device_dir.rstrip('/')}/{name}"
            result = self.adb.push(serial, path, target, timeout=600)
            ok = bool(result["success"])
            results.append({
                "file": path,
                "ok": ok,
                "error": "" if ok else (result["stderr"] or result["stdout"] or "push failed")[:300],
            })
            self.log("INFO" if ok else "ERROR", "FILES",
                     f"Pushed {name} → {target}" if ok else f"Push failed: {name}")
        pushed = sum(1 for item in results if item["ok"])
        return {"results": results, "pushed": pushed, "failed": len(results) - pushed}

    def save_as(self, payload: dict) -> dict:
        """Pull one device file through the native save-as dialog."""
        serial = self._require_device()
        device = self._require_device_path(payload.get("devicePath"), label="source")
        if not dialogs_supported():
            raise DashboardError("Native file dialogs require Windows.", 501)
        suggested = device.rsplit("/", 1)[-1] or "file"
        target = pick_save_path(suggested=suggested)
        if not target:
            return {"cancelled": True}
        parent = os.path.dirname(os.path.abspath(target))
        if not os.path.isdir(parent):
            raise DashboardError("The destination folder does not exist.", 404)
        result = self.adb.pull(serial, device, target, timeout=600)
        if not result["success"]:
            detail = (result["stderr"] or result["stdout"] or "pull failed").strip()
            raise DashboardError(f"Pull failed: {detail[:400]}", 500)
        self.log("INFO", "FILES", f"Saved {device} → {target}")
        return {"ok": True, "path": target}

    def device_mkdir(self, payload: dict) -> dict:
        serial = self._require_device()
        path = self._require_device_path(payload.get("path"), label="folder path")
        result = self.adb.device_mkdir(serial, path)
        if not result["success"]:
            detail = (result["stderr"] or result["stdout"] or "mkdir failed").strip()
            raise DashboardError(f"Could not create the folder: {detail[:300]}", 500)
        self.log("INFO", "FILES", f"Created {path}")
        return {"ok": True, "path": path}

    def device_rename(self, payload: dict) -> dict:
        serial = self._require_device()
        source = self._require_device_path(payload.get("from"), label="source path")
        target = self._require_device_path(payload.get("to"), label="target path")
        result = self.adb.device_rename(serial, source, target)
        if not result["success"]:
            detail = (result["stderr"] or result["stdout"] or "rename failed").strip()
            raise DashboardError(f"Could not rename: {detail[:300]}", 500)
        self.log("INFO", "FILES", f"Renamed {source} → {target}")
        return {"ok": True, "path": target}

    def file_drop(self, filename: object, stream, length: int) -> dict:
        """Stage + push one externally dropped file to ``/sdcard/Download/``."""
        if not isinstance(filename, str) or not DROP_NAME_RE.fullmatch(filename):
            raise DashboardError("File name contains unsupported characters.")
        serial = self._require_device()
        staged = self.stage_apk(filename, stream, length, name_re=DROP_NAME_RE)
        source = os.path.join(self._stage_dir, staged["name"])
        remote = f"/sdcard/Download/{staged['name']}"
        try:
            result = self.adb.push(serial, source, remote, timeout=1800)
        finally:
            try:
                os.unlink(source)
            except OSError:
                pass
        if not result["success"]:
            detail = (result.get("stderr") or result.get("stdout") or "push failed").strip()
            raise DashboardError(f"Push failed: {detail[:300]}", 500)
        self.log("INFO", "FILES", f"Dropped {filename} → {remote}")
        return {"ok": True, "path": remote, "size": length}

    def device_delete(self, payload: dict) -> dict:
        serial = self._require_device()
        path = self._require_device_path(payload.get("path"), label="path")
        # Refuse the filesystem root and top-level trees (/sdcard, /data, …):
        # one mis-click there wipes gigabytes; deeper targets are normal use.
        depth = len([part for part in path.split("/") if part])
        if depth < 2:
            raise DashboardError(
                "Refusing to delete a top-level device path. Navigate inside it first.",
                400,
            )
        result = self.adb.device_delete(serial, path)
        if not result["success"]:
            detail = (result["stderr"] or result["stdout"] or "delete failed").strip()
            raise DashboardError(f"Could not delete: {detail[:300]}", 500)
        self.log("WARN", "FILES", f"Deleted {path}")
        return {"ok": True, "path": path}

    # -- degoogle ----------------------------------------------------------

    def degoogle_status(self) -> dict:
        serial = self.selected_device()
        installed: dict[str, list[str]] | None = None
        if serial:
            result = self.adb.run(["shell", "pm", "list", "packages"], serial=serial)
            if result["success"]:
                present = set(parse_packages(result["stdout"]))
                installed = {
                    name: [pkg for pkg in packages if pkg in present]
                    for name, packages in BUCKETS.items()
                }
        state = load_state(self._degoogle_path)
        with self._degoogle_lock:
            job = dict(self._degoogle_job)
        return {
            "device": serial,
            "installed": installed,
            "state": state.get(serial, empty_state()) if serial else empty_state(),
            "job": job,
        }

    def degoogle_run(self, payload: dict) -> dict:
        mode = payload.get("mode")
        action = payload.get("action", "disable")
        if action not in ("disable", "uninstall"):
            raise DashboardError("Action must be 'disable' or 'uninstall'.")
        serial = self._require_device()

        if mode == "simple":
            include_risky = bool(payload.get("includeRisky"))
            candidates = simple_candidates(include_risky)  # never unsafe
        elif mode == "custom":
            packages = payload.get("packages")
            if not isinstance(packages, list) or not 1 <= len(packages) <= 300:
                raise DashboardError("Select one or more packages (max 300).")
            candidates = []
            for item in packages:
                if not isinstance(item, str) or item not in ALL_SET:
                    raise DashboardError("That package is not part of the DeGoogle catalog.")
                if item not in candidates:
                    candidates.append(item)
        else:
            raise DashboardError("Mode must be 'simple' or 'custom'.")

        scan = self.adb.run(["shell", "pm", "list", "packages"], serial=serial)
        if not scan["success"]:
            detail = (scan["stderr"] or scan["stdout"] or "scan failed").strip()
            raise DashboardError(f"Could not scan packages: {detail[:300]}", 500)
        present = set(parse_packages(scan["stdout"]))
        todo = [pkg for pkg in candidates if pkg in present]

        with self._degoogle_lock:
            if self._degoogle_job["running"]:
                raise DashboardError("A DeGoogle job is already running.", 409)
            if not todo:
                return {"started": False, "total": 0, "message": "Nothing to remove."}
            self._degoogle_job.update({
                "running": True, "phase": "run", "done": 0,
                "total": len(todo), "current": todo[0],
                "lastRun": None,
            })
        threading.Thread(
            target=self._degoogle_run_worker,
            args=(serial, action, todo),
            name="DroidSlateDeGoogle",
            daemon=True,
        ).start()
        return {"started": True, "total": len(todo), "action": action}

    def _degoogle_run_worker(self, serial: str, action: str, packages: list[str]) -> None:
        state = load_state(self._degoogle_path)
        entry = state.setdefault(serial, empty_state())
        disabled: list[str] = []
        uninstalled: list[str] = []
        failed: list[dict] = []
        try:
            for index, package in enumerate(packages, start=1):
                with self._degoogle_lock:
                    self._degoogle_job.update({"done": index - 1, "current": package})
                if action == "disable":
                    result = self.adb.set_package_enabled(serial, package, enabled=False)
                    ok = bool(result["success"])
                    error = "" if ok else (result["stderr"] or result["stdout"] or "disable failed")
                    if ok and package not in entry["disabled"]:
                        entry["disabled"].append(package)
                else:
                    result = self.adb.uninstall(serial, package, for_user=True)
                    ok = self._apk_result_ok(result)
                    error = "" if ok else (result["stderr"] or result["stdout"] or "uninstall failed")
                    if ok and package not in entry["uninstalled"]:
                        entry["uninstalled"].append(package)
                if ok:
                    if action == "disable":
                        disabled.append(package)
                    else:
                        uninstalled.append(package)
                    entry["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
                    save_state(self._degoogle_path, state)  # persist each success
                    self.log("INFO", "DEGOOGLE", f"{action}: {package}")
                else:
                    failed.append({"package": package, "error": str(error)[:300]})
                    self.log("ERROR", "DEGOOGLE", f"Failed {action} {package}: {str(error)[:200]}")
            summary = {
                "action": action,
                "disabled": disabled,
                "uninstalled": uninstalled,
                "failed": failed,
                "finished": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            with self._degoogle_lock:
                self._degoogle_job.update({
                    "running": False, "phase": "", "current": "",
                    "done": len(packages), "lastRun": summary,
                })
        except Exception as exc:  # keep the job from wedging on unexpected errors
            with self._degoogle_lock:
                self._degoogle_job.update({
                    "running": False, "phase": "", "current": "",
                    "lastRun": {"action": action, "disabled": [], "uninstalled": [],
                                "failed": [{"package": "", "error": str(exc)[:300]}],
                                "finished": time.strftime("%Y-%m-%d %H:%M:%S")},
                })

    def degoogle_undo(self, payload: dict) -> dict:
        serial = self._require_device()
        state = load_state(self._degoogle_path)
        entry = state.get(serial, empty_state())

        def pick(key: str) -> list[str]:
            requested = payload.get(key)
            if requested is None:
                return list(entry[key])
            if not isinstance(requested, list) or len(requested) > 500:
                raise DashboardError("Invalid restore selection.")
            chosen = []
            for item in requested:
                if not isinstance(item, str) or item not in entry[key]:
                    raise DashboardError("Only previously removed packages can be restored.")
                if item not in chosen:
                    chosen.append(item)
            return chosen

        disabled = pick("disabled")
        uninstalled = pick("uninstalled")
        if not disabled and not uninstalled:
            raise DashboardError("Nothing to restore for this device.")

        with self._degoogle_lock:
            if self._degoogle_job["running"]:
                raise DashboardError("A DeGoogle job is already running.", 409)
            self._degoogle_job.update({
                "running": True, "phase": "undo", "done": 0,
                "total": len(disabled) + len(uninstalled),
                "current": (disabled + uninstalled)[0],
                "lastUndo": None,
            })
        threading.Thread(
            target=self._degoogle_undo_worker,
            args=(serial, state, disabled, uninstalled),
            name="DroidSlateDeGoogleUndo",
            daemon=True,
        ).start()
        return {"started": True, "total": len(disabled) + len(uninstalled)}

    def _degoogle_undo_worker(
        self, serial: str, state: dict, disabled: list[str], uninstalled: list[str]
    ) -> None:
        restored: list[str] = []
        failed: list[dict] = []
        total = len(disabled) + len(uninstalled)
        done = 0
        try:
            entry = state.get(serial, empty_state())
            for package in disabled:
                with self._degoogle_lock:
                    self._degoogle_job.update({"done": done, "current": package})
                result = self.adb.set_package_enabled(serial, package, enabled=True)
                if result["success"]:
                    restored.append(package)
                    if package in entry["disabled"]:
                        entry["disabled"].remove(package)
                    self.log("INFO", "DEGOOGLE", f"Restored (enabled): {package}")
                else:
                    error = (result["stderr"] or result["stdout"] or "enable failed")
                    failed.append({"package": package, "error": str(error)[:300]})
                    self.log("ERROR", "DEGOOGLE", f"Enable failed {package}: {str(error)[:200]}")
                done += 1
            for package in uninstalled:
                with self._degoogle_lock:
                    self._degoogle_job.update({"done": done, "current": package})
                result = self.adb.reinstall(serial, package)
                ok = self._apk_result_ok(result)
                if not ok:
                    # Some OEMs leave the package disabled after user uninstall.
                    fallback = self.adb.set_package_enabled(serial, package, enabled=True)
                    ok = bool(fallback["success"])
                if ok:
                    restored.append(package)
                    if package in entry["uninstalled"]:
                        entry["uninstalled"].remove(package)
                    self.log("INFO", "DEGOOGLE", f"Restored (reinstalled): {package}")
                else:
                    error = (result["stderr"] or result["stdout"] or "reinstall failed")
                    failed.append({"package": package, "error": str(error)[:300]})
                    self.log("ERROR", "DEGOOGLE", f"Reinstall failed {package}: {str(error)[:200]}")
                done += 1
            entry["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
            if not entry["disabled"] and not entry["uninstalled"]:
                state.pop(serial, None)
            save_state(self._degoogle_path, state)
            summary = {
                "restored": restored,
                "failed": failed,
                "finished": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            with self._degoogle_lock:
                self._degoogle_job.update({
                    "running": False, "phase": "", "current": "",
                    "done": total, "lastUndo": summary,
                })
        except Exception as exc:
            with self._degoogle_lock:
                self._degoogle_job.update({
                    "running": False, "phase": "", "current": "",
                    "lastUndo": {"restored": [], "failed": [{"package": "", "error": str(exc)[:300]}],
                                 "finished": time.strftime("%Y-%m-%d %H:%M:%S")},
                })

    # -- wireless (WiFi) ---------------------------------------------------

    @staticmethod
    def _require_ip(value: object) -> str:
        if not isinstance(value, str) or len(value) > 45:
            raise DashboardError("Enter a valid IPv4 address (e.g. 192.168.1.25).")
        candidate = value.strip()
        if not _IPV4_RE.match(candidate):
            raise DashboardError("Enter a valid IPv4 address (e.g. 192.168.1.25).")
        return candidate

    @staticmethod
    def _wifi_port(value: object) -> int:
        if value in (None, ""):
            return 5555
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise DashboardError("The port must be a number between 1 and 65535.")
        try:
            port = int(value)
        except (TypeError, ValueError):
            raise DashboardError("The port must be a number between 1 and 65535.") from None
        if not 1 <= port <= 65535:
            raise DashboardError("The port must be a number between 1 and 65535.")
        return port

    def wifi_get_ip(self, payload: dict | None = None) -> dict:
        """Read the selected device's Wi-Fi IPv4 (USB-selected device required)."""
        serial = self._require_device()
        ip = self.adb.get_wifi_ip(serial)
        if not ip:
            raise DashboardError(
                "No Wi-Fi IP found. Turn on Wi-Fi on the phone (same network "
                "as this computer) and try again.", 404,
            )
        return {"ip": ip, "serial": serial}

    def wifi_enable_tcp(self, payload: dict | None = None) -> dict:
        """Switch adbd to TCP/IP mode (classic ``adb tcpip 5555`` flow)."""
        serial = self._require_device()
        port = self._wifi_port((payload or {}).get("port"))
        result = self.adb.enable_tcpip(serial, port)
        if not result.get("success"):
            detail = (result.get("stderr") or result.get("stdout") or "").strip()
            raise DashboardError(
                f"Could not enable TCP/IP: {detail[:300] or 'adb tcpip failed.'}", 500,
            )
        return {"port": port, "serial": serial}

    def wifi_connect(self, payload: dict) -> dict:
        """``adb connect ip:port`` — host-level, no selected device needed."""
        ip = self._require_ip(payload.get("ip"))
        port = self._wifi_port(payload.get("port"))
        result = self.adb.adb_connect(ip, port)
        if not result["success"]:
            raise DashboardError(
                f"Connection to {result['target']} failed: {result['output'][:300]}", 500,
            )
        self._remember_wifi_ip(ip)
        return {"target": result["target"], "output": result["output"]}

    def _remember_wifi_ip(self, ip: str) -> None:
        """Record a successfully connected IP for one-click reconnects."""
        with self._lock:
            history = [entry for entry in self._settings.get("wifi_history", []) if entry != ip]
            history.insert(0, ip)
            self._settings["wifi_history"] = history[:8]
            self._save_settings()

    def wifi_disconnect(self, payload: dict) -> dict:
        ip = self._require_ip(payload.get("ip"))
        port = self._wifi_port(payload.get("port"))
        result = self.adb.adb_disconnect(ip, port)
        if not result["success"]:
            raise DashboardError(
                f"Could not disconnect {result['target']}: {result['output'][:300]}", 500,
            )
        return {"target": result["target"], "output": result["output"]}

    def wifi_mdns(self, payload: dict | None = None) -> dict:
        """Discover adb mDNS services for the Android 11+ pairing flow."""
        return {"services": self.adb.mdns_services()}

    @staticmethod
    def _pair_target(value: object) -> str:
        if not isinstance(value, str) or not value.strip():
            raise DashboardError("Select a discovered mDNS service first.")
        target = value.strip()
        match = re.fullmatch(r"(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})", target)
        if not match or not _IPV4_RE.match(match.group(1)):
            raise DashboardError("The pairing target must look like 192.168.1.25:42123.")
        if not 1 <= int(match.group(2)) <= 65535:
            raise DashboardError("The pairing target must look like 192.168.1.25:42123.")
        return target

    @staticmethod
    def _pair_code(value: object) -> str:
        if not isinstance(value, str) or not re.fullmatch(r"\d{6}", value.strip()):
            raise DashboardError("Enter the 6-digit pairing code shown on the phone.")
        return value.strip()

    def wifi_pair(self, payload: dict) -> dict:
        """``adb pair ip:port code`` — Android 11+ Wireless debugging."""
        target = self._pair_target((payload or {}).get("target"))
        code = self._pair_code((payload or {}).get("code"))
        result = self.adb.adb_pair(target, code)
        if not result["success"]:
            raise DashboardError(
                f"Pairing with {target} failed: {result['output'][:300]}", 500,
            )
        return {"target": target, "output": result["output"]}

    def adb_restart(self, payload: dict | None = None) -> dict:
        """Kill + restart the adb server (clears stale transport state)."""
        self.adb.kill_server()
        result = self.adb.start_server()
        if not result.get("success"):
            detail = (result.get("stderr") or result.get("stdout") or "").strip()
            raise DashboardError(
                f"Could not restart adb: {detail[:300] or 'adb start-server failed.'}", 500,
            )
        return {"ok": True}

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

    # -- updates & diagnostics ---------------------------------------------

    def updates_adb(self, payload: dict | None = None) -> dict:
        """Compare the bundled adb against Google's platform-tools index."""
        local = self.adb.platform_tools_version()
        latest: str | None = None
        error = ""
        try:
            latest = parse_platform_tools_version(_fetch_platform_tools_index())
        except Exception as exc:  # network problems degrade gracefully
            error = str(exc)[:200] or "network error"
        if latest is None and not error:
            error = "could not read the platform-tools index"
        available = bool(
            local and latest and _version_key(latest) > _version_key(local)
        )
        return {
            "localVersion": local,
            "latestVersion": latest,
            "updateAvailable": available,
            "error": error,
            "url": PLATFORM_TOOLS_PAGE_URL,
        }

    def diagnostics_report(self, payload: dict | None = None) -> dict:
        """Support snapshot: app/ADB/device state + recent logs, no secrets."""
        with self._lock:
            settings = dict(self._settings)
            devices = list(self._devices)
        recent = []
        for record in self.logs()[-50:]:
            message = str(record.get("message", ""))
            if len(message) > 300:
                message = message[:300] + "…"
            recent.append({**record, "message": message})
        report = {
            "app": "DroidSlate",
            "version": APP_VERSION,
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "platform": platform_module.platform(),
            "python": platform_module.python_version(),
            "adbPath": self.adb.adb_path,
            "adbFound": bool(self.adb.adb_path)
            and (os.path.isfile(self.adb.adb_path) or self.adb.adb_path == "adb"),
            "adbPlatformTools": self.adb.platform_tools_version(),
            "selectedDevice": settings.get("selected_device", ""),
            "devices": devices,
            "theme": settings.get("theme", "dark"),
            "wifiHistorySize": len(settings.get("wifi_history", [])),
            "logcat": {
                "running": self.adb.logcat_running(),
                "serial": self.adb.logcat_serial(),
            },
            "recentLogs": recent,
        }
        return {"report": report}

    def diagnostics_save(self, payload: dict) -> dict:
        """Write a generated report through the native save-as dialog."""
        report = (payload or {}).get("report")
        if not isinstance(report, dict) or not report:
            raise DashboardError("Generate the report first.")
        if not dialogs_supported():
            raise DashboardError("Native file dialogs require Windows.", 501)
        target = pick_save_path(suggested="droidslate-report.json")
        if not target:
            return {"cancelled": True}
        try:
            with open(target, "w", encoding="utf-8") as handle:
                json.dump(report, handle, indent=2, ensure_ascii=False, default=str)
        except OSError as exc:
            raise DashboardError(f"Could not write the report: {exc}", 500) from exc
        self.log("INFO", "DIAG", f"Saved report → {target}")
        return {"ok": True, "path": target}

    # -- snapshot ----------------------------------------------------------

    def snapshot(self) -> dict:
        with self._lock:
            settings = self._public_settings()
            devices = list(self._devices)
            selected = self._settings.get("selected_device", "")
            wifi_history = list(self._settings.get("wifi_history", []))
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
            "wifiHistory": wifi_history,
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
            elif self.command == "POST" and path == "/api/v1/installer/stage":
                result = self._stage_upload(name_re=BUNDLE_NAME_RE)
            elif self.command == "POST" and path == "/api/v1/installer/inspect":
                result = self.app.backend.inspect_staged_bundle(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/installer/install":
                result = self.app.backend.install_staged_bundle(self._parse_json())
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
            elif self.command == "GET" and path == "/api/v1/files/local":
                query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                result = self.app.backend.list_local_dir((query.get("path") or [""])[0])
            elif self.command == "GET" and path == "/api/v1/files/device":
                query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                result = self.app.backend.list_device_dir((query.get("path") or [""])[0])
            elif self.command == "POST" and path == "/api/v1/files/push":
                result = self.app.backend.push_file(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/files/pull":
                result = self.app.backend.pull_file(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/files/push-pick":
                result = self.app.backend.push_pick(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/files/save-as":
                result = self.app.backend.save_as(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/files/device-mkdir":
                result = self.app.backend.device_mkdir(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/files/device-rename":
                result = self.app.backend.device_rename(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/files/device-delete":
                result = self.app.backend.device_delete(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/files/drop":
                result = self._drop_upload()
            elif self.command == "POST" and path == "/api/v1/updates/adb":
                result = self.app.backend.updates_adb(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/diagnostics/report":
                result = self.app.backend.diagnostics_report(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/diagnostics/save":
                result = self.app.backend.diagnostics_save(self._parse_json())
            elif self.command == "GET" and path == "/api/v1/degoogle":
                result = self.app.backend.degoogle_status()
            elif self.command == "POST" and path == "/api/v1/degoogle/run":
                result = self.app.backend.degoogle_run(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/degoogle/undo":
                result = self.app.backend.degoogle_undo(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/wifi/get-ip":
                result = self.app.backend.wifi_get_ip(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/wifi/enable-tcp":
                result = self.app.backend.wifi_enable_tcp(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/wifi/connect":
                result = self.app.backend.wifi_connect(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/wifi/disconnect":
                result = self.app.backend.wifi_disconnect(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/wifi/mdns":
                result = self.app.backend.wifi_mdns(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/wifi/pair":
                result = self.app.backend.wifi_pair(self._parse_json())
            elif self.command == "POST" and path == "/api/v1/adb/restart":
                result = self.app.backend.adb_restart(self._parse_json())
            else:
                raise DashboardError("Endpoint not found.", 404)
            self._json(200, result)
        except DashboardError as exc:
            self._error(exc.status, str(exc))
        except Exception:
            self._error(500, "The dashboard request failed.")

    def _stage_upload(self, *, name_re=None) -> dict:
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
        return self.app.backend.stage_apk(filename, self.rfile, int(length_text),
                                          name_re=name_re)

    def _drop_upload(self) -> dict:
        """Receive one raw dropped-file body and push it to the device."""
        self.close_connection = True
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if content_type != "application/octet-stream":
            raise DashboardError("Content-Type must be application/octet-stream.", 415)
        length_text = self.headers.get("Content-Length")
        if not length_text or not length_text.isdigit():
            raise DashboardError("A valid Content-Length is required.", 411)
        params = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        filename = (params.get("name") or [""])[0]
        return self.app.backend.file_drop(filename, self.rfile, int(length_text))

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
