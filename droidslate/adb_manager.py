"""ADB subprocess layer for DroidSlate.

A thin, testable wrapper around the Android Debug Bridge binary.  Every
command runs as an argument list (never through a shell), so device-side
paths, package names, and shell snippets cannot inject extra commands.

The parsing helpers (``parse_devices``, ``parse_ls``, ``parse_packages``)
are pure functions so they can be unit-tested without a device.
"""

from __future__ import annotations

import collections
import os
import re
import shutil
import subprocess
import sys
import threading
import time

# ``CREATE_NO_WINDOW`` keeps adb console windows from flashing on Windows.
_CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

DEFAULT_TIMEOUT = 30
LOGCAT_BUFFER_SIZE = 2000


def _app_dir() -> str:
    """Directory containing the running app (frozen exe or this script)."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def _bundled_roots() -> list[str]:
    """Roots that may contain a bundled ``adb-bin/`` folder.

    Frozen PyInstaller 6 one-folder builds keep data files in ``_internal``
    (``sys._MEIPASS``) while the executable sits one level up, so both the
    executable's directory and the resource directory are searched.
    """
    roots = [_app_dir()]
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", "") or ""
        if meipass and os.path.abspath(meipass) not in [os.path.abspath(r) for r in roots]:
            roots.append(meipass)
    return roots


def find_adb(explicit: str | None = None) -> str:
    """Resolve the adb binary.

    Order: explicit setting (file or directory) → bundled ``adb-bin/`` next to
    the app (or in PyInstaller's ``_internal/`` folder) → ``platform-tools/``
    next to the app → PATH → common SDK locations.  Returns ``"adb"`` as a
    last resort so failures surface as a clear "adb not found" error from the
    subprocess call.
    """
    candidates: list[str] = []
    if explicit:
        if os.path.isfile(explicit):
            return explicit
        if os.path.isdir(explicit):
            candidates.append(os.path.join(explicit, "adb.exe"))
            candidates.append(os.path.join(explicit, "adb"))
        else:
            # A configured binary path: return it as-is so error messages and the
            # settings screen show the configured location (adbFound reports absence).
            return explicit

    exe = "adb.exe" if sys.platform == "win32" else "adb"
    for root in _bundled_roots():
        candidates.extend([
            os.path.join(root, "adb-bin", exe),
            os.path.join(root, exe),
            os.path.join(root, "platform-tools", exe),
        ])

    on_path = shutil.which("adb") or shutil.which("adb.exe")
    if on_path:
        candidates.append(on_path)

    local_app_data = os.environ.get("LOCALAPPDATA", "")
    program_files = os.environ.get("ProgramFiles", "")
    candidates.extend([
        os.path.join(local_app_data, "Android", "Sdk", "platform-tools", exe),
        os.path.join(program_files, "Android", "android-sdk", "platform-tools", exe),
        os.path.join(os.path.expanduser("~"), "Downloads", "platform-tools-latest-windows", "platform-tools", exe),
    ])

    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate
    return "adb"


def parse_devices(output: str) -> list[dict]:
    """Parse ``adb devices -l`` output into device records."""
    devices: list[dict] = []
    lines = (output or "").strip().splitlines()
    for line in lines[1:]:  # skip "List of devices attached"
        line = line.strip()
        if not line:
            continue
        if "\t" in line:
            device_id, rest = line.split("\t", 1)
        elif " " in line:
            device_id, rest = line.split(" ", 1)
        else:
            devices.append({"id": line, "status": "unknown", "model": None, "product": None})
            continue
        device_id = device_id.strip()
        rest = rest.strip()
        if not device_id:
            continue
        status = rest.split()[0] if rest else "unknown"
        model = None
        product = None
        model_match = re.search(r"\bmodel:(\S+)", rest)
        if model_match:
            model = model_match.group(1).replace("_", " ")
        product_match = re.search(r"\bproduct:(\S+)", rest)
        if product_match:
            product = product_match.group(1).replace("_", " ")
        devices.append({"id": device_id, "status": status, "model": model, "product": product})
    return devices


def parse_packages(output: str) -> list[str]:
    """Parse ``pm list packages`` output (``package:<name>`` per line)."""
    packages = []
    for line in (output or "").splitlines():
        line = line.strip()
        if line.startswith("package:"):
            name = line[len("package:"):].strip()
            if name:
                packages.append(name)
    return packages


_LS_LINE_RE = re.compile(
    r"^(?P<mode>[bcdlps-][rwxstST-]{9})\s+"
    r"(?P<links>\d+)\s+"
    r"(?P<owner>\S+)\s+"
    r"(?P<group>\S+)\s+"
    r"(?P<size>\d+)\s+"
    r"(?P<date>\d{4}-\d{2}-\d{2})\s+"
    r"(?P<time>\d{2}:\d{2})\s+"
    r"(?P<name>.+)$"
)


def parse_ls(output: str) -> list[dict]:
    """Parse ``adb shell ls -la <path>`` output into entry records.

    Handles the ``total N`` header, ``.``/``..``, directories, regular files,
    symlinks (``name -> target``), and skips lines that do not match the
    ``ls -la`` shape (e.g. error messages).
    """
    entries: list[dict] = []
    for line in (output or "").splitlines():
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("total "):
            continue
        match = _LS_LINE_RE.match(line)
        if not match:
            continue
        name = match.group("name")
        if name in (".", ".."):
            continue
        mode = match.group("mode")
        is_link = mode.startswith("l")
        link_target = None
        if is_link and " -> " in name:
            name, link_target = name.split(" -> ", 1)
        entries.append({
            "name": name,
            "size": int(match.group("size")),
            "modified": f"{match.group('date')} {match.group('time')}",
            "is_dir": mode.startswith("d"),
            "is_link": is_link,
            "link_target": link_target,
            "permissions": mode,
        })
    entries.sort(key=lambda item: (not item["is_dir"], item["name"].lower()))
    return entries


class ADBManager:
    """Runs ADB commands for the currently selected device."""

    def __init__(self, adb_path: str | None = None):
        self.adb_path = adb_path or find_adb()
        self._logcat_proc: subprocess.Popen | None = None
        self._logcat_thread: threading.Thread | None = None
        self._logcat_lock = threading.Lock()
        self._logcat_serial: str | None = None

    # -- low level ---------------------------------------------------------

    def set_adb_path(self, path: str) -> bool:
        """Accept a direct adb path or a directory containing adb."""
        if os.path.isfile(path):
            self.adb_path = path
            return True
        if os.path.isdir(path):
            for name in ("adb.exe", "adb"):
                candidate = os.path.join(path, name)
                if os.path.isfile(candidate):
                    self.adb_path = candidate
                    return True
        return False

    def _command(self, args: list[str], serial: str | None = None) -> list[str]:
        command = [self.adb_path]
        if serial:
            command += ["-s", serial]
        command += list(args)
        return command

    def run(self, args: list[str], *, serial: str | None = None, timeout: int = DEFAULT_TIMEOUT) -> dict:
        """Run an adb command and return a result dict."""
        try:
            result = subprocess.run(
                self._command(args, serial),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                creationflags=_CREATE_NO_WINDOW,
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "stdout": "", "stderr": "Command timed out", "returncode": -1}
        except OSError as exc:
            return {"success": False, "stdout": "", "stderr": f"Could not run adb: {exc}", "returncode": -1}

    def run_bytes(self, args: list[str], *, serial: str | None = None, timeout: int = DEFAULT_TIMEOUT) -> dict:
        """Binary variant of :meth:`run` (used for ``screencap``)."""
        try:
            result = subprocess.run(
                self._command(args, serial),
                capture_output=True,
                timeout=timeout,
                creationflags=_CREATE_NO_WINDOW,
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr.decode("utf-8", errors="replace"),
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "stdout": b"", "stderr": "Command timed out", "returncode": -1}
        except OSError as exc:
            return {"success": False, "stdout": b"", "stderr": f"Could not run adb: {exc}", "returncode": -1}

    # -- devices -----------------------------------------------------------

    def get_devices(self) -> list[dict]:
        result = self.run(["devices", "-l"])
        if not result["success"]:
            return []
        devices = parse_devices(result["stdout"])
        for device in devices:
            if device.get("model") or device["status"] != "device":
                continue
            model = self.run(["shell", "getprop", "ro.product.model"], serial=device["id"])
            if model["success"] and model["stdout"].strip():
                device["model"] = model["stdout"].strip()
            manufacturer = self.run(["shell", "getprop", "ro.product.manufacturer"], serial=device["id"])
            if manufacturer["success"] and manufacturer["stdout"].strip():
                device["manufacturer"] = manufacturer["stdout"].strip()
        return devices

    def get_device_info(self, serial: str) -> dict:
        props = {
            "Model": "ro.product.model",
            "Manufacturer": "ro.product.manufacturer",
            "Brand": "ro.product.brand",
            "Android Version": "ro.build.version.release",
            "SDK Version": "ro.build.version.sdk",
            "Build": "ro.build.id",
            "Serial": "ro.serialno",
            "CPU": "ro.product.cpu.abi",
        }
        info: dict[str, str] = {}
        for label, prop in props.items():
            result = self.run(["shell", "getprop", prop], serial=serial)
            info[label] = result["stdout"].strip() if result["success"] and result["stdout"].strip() else "N/A"
        return info

    # -- shell -------------------------------------------------------------

    def shell(self, serial: str, command: str, *, timeout: int = DEFAULT_TIMEOUT) -> dict:
        """Run a shell command on the device (argument list, no local shell)."""
        stripped = (command or "").strip()
        # Accept (and strip) a leading "adb shell" / "adb -s <serial> shell".
        stripped = re.sub(r"^adb\s+(?:-s\s+\S+\s+)?shell\s+", "", stripped)
        if not stripped:
            return {"success": False, "stdout": "", "stderr": "Enter a command to run.", "returncode": -1}
        return self.run(["shell", stripped], serial=serial, timeout=timeout)

    # -- apps --------------------------------------------------------------

    def install_apk(self, serial: str, apk_path: str, *, timeout: int = 600) -> dict:
        return self.run(["install", "-r", apk_path], serial=serial, timeout=timeout)

    def install_multiple(self, serial: str, apk_paths: list[str], *, timeout: int = 900) -> dict:
        if not apk_paths:
            return {"success": False, "stdout": "", "stderr": "No APK files selected.", "returncode": -1}
        return self.run(["install-multiple", "-r", *apk_paths], serial=serial, timeout=timeout)

    def uninstall(self, serial: str, package: str, *, for_user: bool = False) -> dict:
        args = ["uninstall"]
        if for_user:
            args += ["--user", "0"]
        args.append(package)
        result = self.run(args, serial=serial)
        if not result["success"] and not for_user:
            # System apps often refuse a plain uninstall; retry for the user.
            fallback = self.run(["uninstall", "--user", "0", package], serial=serial)
            if fallback["success"]:
                return fallback
        return result

    def reinstall(self, serial: str, package: str) -> dict:
        return self.run(["shell", "pm", "install-existing", "--user", "0", package], serial=serial)

    def set_package_enabled(self, serial: str, package: str, enabled: bool) -> dict:
        verb = "enable" if enabled else "disable-user"
        return self.run(["shell", "pm", verb, "--user", "0", package], serial=serial)

    def list_packages(
        self,
        serial: str,
        *,
        include_uninstalled: bool = False,
        third_party_only: bool = False,
        disabled_only: bool = False,
    ) -> list[str]:
        """List packages via ``pm list packages`` with the given filters."""
        args = ["shell", "pm", "list", "packages"]
        if include_uninstalled:
            args.append("-u")
        if third_party_only:
            args.append("-3")
        if disabled_only:
            args.append("-d")
        result = self.run(args, serial=serial)
        if not result["success"]:
            return []
        return parse_packages(result["stdout"])

    def package_path(self, serial: str, package: str) -> str | None:
        result = self.run(["shell", "pm", "path", package], serial=serial)
        if not result["success"]:
            return None
        for line in result["stdout"].splitlines():
            line = line.strip()
            if line.startswith("package:"):
                return line[len("package:"):].strip()
        return None

    # -- device operations -------------------------------------------------

    def screenshot(self, serial: str, out_path: str) -> dict:
        result = self.run_bytes(["exec-out", "screencap", "-p"], serial=serial, timeout=60)
        if not result["success"]:
            return {"success": False, "stderr": result["stderr"] or "Screenshot failed."}
        if not result["stdout"]:
            return {"success": False, "stderr": "The device returned an empty screenshot."}
        try:
            os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
            with open(out_path, "wb") as handle:
                handle.write(result["stdout"])
        except OSError as exc:
            return {"success": False, "stderr": f"Could not save the screenshot: {exc}"}
        return {"success": True, "path": out_path}

    def reboot(self, serial: str, mode: str = "normal") -> dict:
        if mode not in ("normal", "recovery", "bootloader"):
            return {"success": False, "stderr": "Unknown reboot mode."}
        args = ["reboot"] if mode == "normal" else ["reboot", mode]
        return self.run(args, serial=serial, timeout=15)

    # -- files -------------------------------------------------------------

    def list_device_dir(self, serial: str, path: str) -> dict:
        result = self.run(["shell", "ls", "-la", path], serial=serial)
        if not result["success"]:
            return {"success": False, "stderr": result["stderr"].strip() or "Could not list this folder.", "entries": []}
        return {"success": True, "entries": parse_ls(result["stdout"])}

    def push(self, serial: str, local_path: str, remote_path: str, *, timeout: int = 300) -> dict:
        return self.run(["push", local_path, remote_path], serial=serial, timeout=timeout)

    def pull(self, serial: str, remote_path: str, local_path: str, *, timeout: int = 300) -> dict:
        return self.run(["pull", remote_path, local_path], serial=serial, timeout=timeout)

    def device_mkdir(self, serial: str, path: str) -> dict:
        return self.run(["shell", "mkdir", "-p", path], serial=serial)

    def device_rename(self, serial: str, old_path: str, new_path: str) -> dict:
        return self.run(["shell", "mv", old_path, new_path], serial=serial)

    def device_delete(self, serial: str, path: str) -> dict:
        return self.run(["shell", "rm", "-rf", path], serial=serial)

    # -- logcat ------------------------------------------------------------

    def start_logcat(self, serial: str, on_line) -> dict:
        """Start streaming logcat; ``on_line(text)`` is called per line."""
        self.stop_logcat()
        try:
            proc = subprocess.Popen(  # nosec B603 - argument list, no shell
                self._command(["logcat", "-v", "threadtime"], serial),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                creationflags=_CREATE_NO_WINDOW,
            )
        except OSError as exc:
            return {"success": False, "stderr": f"Could not start logcat: {exc}"}
        with self._logcat_lock:
            self._logcat_proc = proc
            self._logcat_serial = serial

        def reader() -> None:
            try:
                assert proc.stdout is not None
                for line in proc.stdout:
                    on_line(line.rstrip("\n"))
            except (OSError, ValueError):
                pass

        self._logcat_thread = threading.Thread(target=reader, name="DroidSlateLogcat", daemon=True)
        self._logcat_thread.start()
        # Give adb a moment to fail fast (e.g. unauthorized device).
        time.sleep(0.4)
        if proc.poll() is not None:
            return {"success": False, "stderr": "Logcat exited immediately. Check the device connection."}
        return {"success": True}

    def stop_logcat(self) -> None:
        with self._logcat_lock:
            proc = self._logcat_proc
            self._logcat_proc = None
            self._logcat_serial = None
        if proc is not None and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    proc.kill()
                except OSError:
                    pass

    def logcat_running(self) -> bool:
        with self._logcat_lock:
            proc = self._logcat_proc
        return proc is not None and proc.poll() is None

    def logcat_serial(self) -> str | None:
        with self._logcat_lock:
            return self._logcat_serial


__all__ = [
    "ADBManager",
    "find_adb",
    "parse_devices",
    "parse_ls",
    "parse_packages",
]
