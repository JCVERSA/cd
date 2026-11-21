"""scrcpy process management for DroidSlate's Mirror tab.

Responsibilities:
  * locate the scrcpy binary (bundled ``scrcpy-bin/`` → PATH),
  * translate a validated JSON config into scrcpy CLI arguments
    (flag names verified against scrcpy v5.0.1 ``app/src/cli.c``),
  * start/stop one scrcpy process per device serial,
  * stream each session's output into a bounded log for the UI.

scrcpy is a separate process with its own window: it keeps running
independently of this backend, so "stop" terminates it explicitly.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import deque

from adb_manager import find_adb, _bundled_roots


class ScrcpyError(RuntimeError):
    """A mirror operation failed; ``status`` maps onto the HTTP status."""

    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


SCRC_VERSION_RE = re.compile(r"scrcpy\s+(\d+\.\d+(?:\.\d+)?)", re.IGNORECASE)

VALID_VIDEO_CODECS = ("h264", "h265")
VALID_AUDIO_CODECS = ("opus", "aac", "flac", "raw")
VALID_ROTATIONS = ("0", "1", "2", "3")

DEFAULT_BITRATE_MBPS = 8
DEFAULT_AUDIO_CODEC = "opus"
DEFAULT_VIDEO_CODEC = "h264"

# scrcpy flags bound to sane ranges so a bad payload can never spawn
# a runaway process (validation happens before anything is executed).
_BITRATE_RANGE = (1, 1024)      # Mbps
_MAX_SIZE_RANGE = (0, 8192)     # px; 0 = native resolution
_FPS_RANGE = (0, 240)           # 0 = unlimited


def _as_int(value, name: str, low: int, high: int, default: int) -> int:
    if value is None or value == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ScrcpyError(f"{name} must be a number.", 400) from None
    if number < low or number > high:
        raise ScrcpyError(f"{name} must be between {low} and {high}.", 400)
    return number


def _as_bool(value) -> bool:
    return bool(value)


def normalize_config(raw) -> dict:
    """Validate the JSON config coming from the UI and fill defaults.

    Keys are the camelCase names the frontend sends. Raises
    :class:`ScrcpyError` with status 400 on anything unexpected.
    """
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ScrcpyError("The mirror config must be an object.", 400)

    codec = str(raw.get("codec") or DEFAULT_VIDEO_CODEC).lower()
    if codec not in VALID_VIDEO_CODECS:
        raise ScrcpyError("Unknown video codec.", 400)

    audio_codec = str(raw.get("audioCodec") or DEFAULT_AUDIO_CODEC).lower()
    if audio_codec not in VALID_AUDIO_CODECS:
        raise ScrcpyError("Unknown audio codec.", 400)

    rotation = str(raw.get("rotation") if raw.get("rotation") is not None else "0")
    if rotation not in VALID_ROTATIONS:
        raise ScrcpyError("Unknown rotation.", 400)

    record_path = raw.get("recordPath")
    if record_path is not None and not isinstance(record_path, str):
        raise ScrcpyError("The record folder must be text.", 400)

    return {
        "codec": codec,
        "audio": _as_bool(raw.get("audio", True)),
        "audioCodec": audio_codec,
        "bitrate": _as_int(raw.get("bitrate"), "Bitrate", *_BITRATE_RANGE, DEFAULT_BITRATE_MBPS),
        "maxSize": _as_int(raw.get("maxSize"), "Max size", *_MAX_SIZE_RANGE, 0),
        "fps": _as_int(raw.get("fps"), "FPS", *_FPS_RANGE, 0),
        "rotation": rotation,
        "alwaysOnTop": _as_bool(raw.get("alwaysOnTop")),
        "fullscreen": _as_bool(raw.get("fullscreen")),
        "borderless": _as_bool(raw.get("borderless")),
        "stayAwake": _as_bool(raw.get("stayAwake")),
        "turnScreenOff": _as_bool(raw.get("turnScreenOff")),
        "keepActive": _as_bool(raw.get("keepActive")),
        "record": _as_bool(raw.get("record")),
        "recordPath": (record_path or "").strip(),
    }


def default_record_dir() -> str:
    """Where recordings go when the user picks no explicit folder."""
    videos = os.path.join(os.path.expanduser("~"), "Videos")
    if sys.platform == "win32":
        videos = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")), "Videos")
    return videos if os.path.isdir(videos) else os.getcwd()


def build_args(serial: str, cfg: dict) -> list[str]:
    """Translate a normalized config into scrcpy CLI arguments.

    Flag names verified against scrcpy v5.0.1 (``app/src/cli.c``):
    ``--video-codec``, ``--video-bit-rate``, ``--audio-codec``,
    ``--max-size``, ``--max-fps``, ``--orientation``,
    ``--always-on-top``, ``--fullscreen``, ``--window-borderless``,
    ``--stay-awake``, ``--turn-screen-off``, ``--no-power-on``,
    ``--keep-active``, ``--record``, ``--no-audio``.
    """
    args: list[str] = ["-s", serial]
    args.append(f"--video-codec={cfg['codec']}")
    args.append("--video-bit-rate")
    args.append(f"{cfg['bitrate']}M")

    if not cfg["audio"]:
        args.append("--no-audio")
    elif cfg["audioCodec"] != DEFAULT_AUDIO_CODEC:
        # opus is scrcpy's default; only spell it out when differing.
        args.append(f"--audio-codec={cfg['audioCodec']}")

    if cfg["maxSize"] > 0:
        args.extend(["--max-size", str(cfg["maxSize"])])
    if cfg["fps"] > 0:
        args.extend(["--max-fps", str(cfg["fps"])])
    if cfg["rotation"] != "0":
        args.extend(["--orientation", cfg["rotation"]])

    if cfg["alwaysOnTop"]:
        args.append("--always-on-top")
    if cfg["fullscreen"]:
        args.append("--fullscreen")
    if cfg["borderless"]:
        args.append("--window-borderless")
    if cfg["stayAwake"]:
        args.append("--stay-awake")
    if cfg["turnScreenOff"]:
        args.append("--turn-screen-off")
        args.append("--no-power-on")
    if cfg["keepActive"]:
        args.append("--keep-active")

    if cfg["record"]:
        directory = cfg["recordPath"] or default_record_dir()
        serial_tag = serial.replace(":", "-").replace(".", "-")
        filename = time.strftime(f"scrcpy_{serial_tag}_%Y%m%d_%H%M%S.mkv")
        args.append(f"--record={os.path.join(directory, filename)}")

    return args


def find_scrcpy(explicit: str | None = None) -> str | None:
    """Resolve the scrcpy binary.

    Order: explicit setting (file or directory) → bundled ``scrcpy-bin/``
    next to the app (or in PyInstaller's ``_internal/`` folder) → PATH.
    Returns ``None`` when nothing is found so the UI can explain how to
    get the bundled engine back (reinstall).
    """
    candidates: list[str] = []
    if explicit:
        if os.path.isfile(explicit):
            return explicit
        if os.path.isdir(explicit):
            candidates.extend([
                os.path.join(explicit, "scrcpy.exe"),
                os.path.join(explicit, "scrcpy"),
            ])
        else:
            return explicit  # configured location, reported as-is

    exe = "scrcpy.exe" if sys.platform == "win32" else "scrcpy"
    for root in _bundled_roots():
        candidates.extend([
            os.path.join(root, "scrcpy-bin", exe),
            os.path.join(root, "scrcpy", exe),
            os.path.join(root, exe),
        ])

    on_path = shutil.which("scrcpy") or shutil.which("scrcpy.exe")
    if on_path:
        candidates.append(on_path)

    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def _creation_flags() -> int:
    return subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


class ScrcpyManager:
    """One scrcpy process per device serial, with bounded session logs."""

    def __init__(self, *, scrcpy_path: str | None = None, log_limit: int = 500) -> None:
        # Public so the backend can apply the scrcpyPath setting live.
        self.explicit_path = scrcpy_path
        self._log_limit = log_limit
        self._lock = threading.Lock()
        self._procs: dict[str, subprocess.Popen] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._logs: dict[str, deque] = {}

    # -- discovery --------------------------------------------------------

    def version(self) -> dict:
        """Locate scrcpy and read ``scrcpy --version`` (no device needed)."""
        path = find_scrcpy(self.explicit_path)
        if not path or not os.path.isfile(path):
            # ``path`` may be a configured-but-missing location: report it so
            # the Settings screen can show "not found" next to the input.
            return {"found": False, "path": path, "version": None}
        version_text = None
        try:
            result = subprocess.run(
                [path, "--version"],
                capture_output=True,
                text=True,
                timeout=15,
                creationflags=_creation_flags(),
            )
            match = SCRC_VERSION_RE.search((result.stdout or "") + (result.stderr or ""))
            if match:
                version_text = match.group(1)
        except (OSError, subprocess.SubprocessError):
            version_text = None
        return {"found": True, "path": path, "version": version_text}

    # -- process lifecycle ------------------------------------------------

    def _log(self, serial: str) -> deque:
        with self._lock:
            return self._logs.setdefault(serial, deque(maxlen=self._log_limit))

    def start(self, serial: str, raw_config: dict | None) -> dict:
        """Spawn scrcpy for ``serial`` with a validated config."""
        cfg = normalize_config(raw_config)
        path = find_scrcpy(self.explicit_path)
        if path and not os.path.isfile(path):
            path = None  # configured location missing → treated as not found
        if not path:
            raise ScrcpyError(
                "scrcpy was not found. Reinstall DroidSlate to restore the bundled mirror engine.",
                404,
            )

        args = [path] + build_args(serial, cfg)
        log = self._log(serial)
        with self._lock:
            existing = self._procs.get(serial)
            if existing is not None and existing.poll() is None:
                raise ScrcpyError("A mirror session is already running for this device.", 409)

            env = os.environ.copy()
            # Our bundled adb must win over any other copy: a single adb
            # server avoids "adb daemon version mismatch" fights.
            adb = find_adb()
            adb_dir = os.path.dirname(os.path.abspath(adb)) if os.path.isfile(adb) else ""
            if adb_dir:
                env["PATH"] = adb_dir + os.pathsep + env.get("PATH", "")

            try:
                process = subprocess.Popen(
                    args,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.DEVNULL,
                    cwd=os.path.dirname(os.path.abspath(path)) or None,
                    env=env,
                    creationflags=_creation_flags(),
                )
            except OSError as exc:
                raise ScrcpyError(f"Could not start scrcpy: {exc}", 500) from exc

            self._procs[serial] = process

        log.append("$ " + " ".join(args))
        thread = threading.Thread(
            target=self._pump, args=(serial, process, log),
            name=f"DroidSlateScrcpy-{serial}", daemon=True,
        )
        with self._lock:
            self._threads[serial] = thread
        thread.start()
        return {"ok": True, "pid": process.pid, "serial": serial}

    @staticmethod
    def _pump(serial: str, process: subprocess.Popen, log: deque) -> None:
        """Forward scrcpy's output into the session log until it exits."""
        try:
            for raw in iter(process.stdout.readline, b""):
                line = raw.decode("utf-8", "replace").rstrip("\r\n")
                if line:
                    log.append(line)
        except (OSError, ValueError):
            pass
        finally:
            if process.stdout is not None:
                try:
                    process.stdout.close()
                except OSError:
                    pass
            code = process.poll()
            log.append(f"[scrcpy exited with code {code}]" if code is not None
                       else "[scrcpy stopped]")

    def stop(self, serial: str) -> dict:
        """Terminate the session for ``serial`` (idempotent)."""
        with self._lock:
            process = self._procs.pop(serial, None)
        with self._lock:
            thread = self._threads.pop(serial, None)
        if process is None or process.poll() is not None:
            if thread is not None:
                thread.join(timeout=2)
            return {"ok": True, "serial": serial, "running": False}
        process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass
        if thread is not None:
            # Let the log pump drain and close the pipe before we return.
            thread.join(timeout=2)
        self._log(serial).append("[mirror stopped]")
        return {"ok": True, "serial": serial, "running": False}

    def status(self) -> dict:
        """``{serial: {pid, running}}`` for every known session."""
        with self._lock:
            items = list(self._procs.items())
        return {
            serial: {"pid": process.pid, "running": process.poll() is None}
            for serial, process in items
        }

    def logs(self, serial: str, limit: int = 200) -> list[str]:
        with self._lock:
            log = self._logs.get(serial)
            lines = list(log) if log else []
        if limit > 0:
            lines = lines[-limit:]
        return lines

    def shutdown(self) -> None:
        """Stop every session (backend close / app exit)."""
        with self._lock:
            serials = list(self._procs)
        for serial in serials:
            self.stop(serial)
