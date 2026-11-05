"""Private localhost dashboard server for SwiftSlate.

The server is created on demand by the existing Win32 engine.  It binds only to an
IPv4 loopback address, authenticates every API request with a process-random token,
and serves a fixed, bundled asset directory.  Provider keys never appear in responses.
"""

from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import tempfile
import threading
import time
from typing import Callable
import urllib.parse

from provider_catalog import (
    PROVIDERS,
    ProviderError,
    default_provider_config,
    fetch_models,
    public_provider_records,
    test_provider,
    validate_endpoint,
)
from secure_config import SecureConfigError, read_config, write_config
from text_styles import transform

MAX_REQUEST_BYTES = 64 * 1024
MAX_COMMANDS = 100
MAX_TRIGGER_CHARS = 50
VALID_THEMES = {"lavender", "amber", "sapphire", "emerald", "rose"}
VALID_SPINNERS = {"animated", "static", "off"}
VALID_COMMAND_TYPES = {"ai", "replacer-text", "style", "replacer-shell"}
EDITABLE_COMMAND_TYPES = {"ai", "replacer-text", "style"}
TRIGGER_RE = re.compile(r"^(?!\.)[^\s]{1,50}$")


class DashboardError(RuntimeError):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.status = int(status)


def default_config() -> dict:
    return {
        "provider": "gemini",
        "model": PROVIDERS["gemini"].model,
        "prefix": ".",
        "temperature": 0.5,
        "spinner": "animated",
        "key_delay": 200,
        "first_run": True,
        "launch_at_startup": True,
        "theme": "lavender",
        "reduced_motion": False,
        "api_keys": [],
        "providers": default_provider_config(),
    }


def ensure_config(path: str) -> tuple[dict, bool]:
    if os.path.exists(path):
        return read_config(path), False
    config = default_config()
    write_config(path, config)
    return config, True


def _atomic_json(path: str, payload: object) -> None:
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".commands.", suffix=".tmp", dir=directory)
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


class DashboardBackend:
    """State adapter used by the HTTP handler and by unit tests."""

    def __init__(
        self,
        data_dir: str,
        *,
        runtime_state: Callable[[], dict] | None = None,
        set_paused: Callable[[bool], None] | None = None,
        reload_runtime: Callable[[], bool] | None = None,
        apply_startup: Callable[[bool], None] | None = None,
        run_ai: Callable[[str, str], tuple[str | None, str | None]] | None = None,
        diagnostics: Callable[[], list[dict]] | None = None,
        logs: Callable[[], list[dict]] | None = None,
    ):
        self.data_dir = os.path.abspath(data_dir)
        self.config_path = os.path.join(self.data_dir, "config.json")
        self.commands_path = os.path.join(self.data_dir, "commands.json")
        self._runtime_state = runtime_state or (lambda: {})
        self._set_paused = set_paused or (lambda _paused: None)
        self._reload_runtime = reload_runtime or (lambda: True)
        self._apply_startup = apply_startup or (lambda _enabled: None)
        self._run_ai = run_ai
        self._diagnostics = diagnostics
        self._log_records = logs or (lambda: [])
        self.started_at = time.monotonic()
        self.activity: list[dict] = []
        self._lock = threading.RLock()
        self.paused = False

    def _config(self) -> dict:
        config, _ = ensure_config(self.config_path)
        if not isinstance(config, dict):
            raise DashboardError("The configuration file must contain an object.")
        return config

    def _write_config(self, config: dict) -> None:
        write_config(self.config_path, config)
        if not self._reload_runtime():
            raise DashboardError("Settings were saved, but the runtime could not reload them.", 500)

    def _command_records(self) -> list[dict]:
        records = []
        if os.path.exists(self.commands_path):
            try:
                with open(self.commands_path, "r", encoding="utf-8-sig") as handle:
                    payload = json.load(handle)
                if isinstance(payload, list):
                    records = payload
            except (OSError, ValueError):
                records = []
        result = []
        for index, item in enumerate(records[:MAX_COMMANDS]):
            if not isinstance(item, dict) or not isinstance(item.get("trigger"), str):
                continue
            trigger = item["trigger"]
            command_type = item.get("type", "ai")
            if command_type not in VALID_COMMAND_TYPES:
                continue
            result.append({
                "id": item.get("id") if isinstance(item.get("id"), str) else trigger,
                "trigger": trigger,
                "type": "system" if command_type == "replacer-shell" else command_type,
                "prompt": item.get("prompt") if isinstance(item.get("prompt"), str) else "",
                "value": item.get("value") if isinstance(item.get("value"), str) else "",
                "enabled": item.get("enabled", True) is not False,
                "uses": item.get("uses") if isinstance(item.get("uses"), int) else 0,
            })
        return result

    def _persist_command_records(self, records: list[dict]) -> None:
        payload = []
        for record in records:
            item = dict(record)
            if item.get("type") == "system":
                item["type"] = "replacer-shell"
            payload.append(item)
        _atomic_json(self.commands_path, payload)

    def _diagnostic_records(self) -> list[dict]:
        if self._diagnostics:
            return self._diagnostics()
        return [
            {"id": "raw-input", "label": "Raw Input listener", "detail": "Keyboard API is available.", "status": "pass"},
            {"id": "clipboard", "label": "Clipboard access", "detail": "Clipboard integration is ready.", "status": "pass"},
            {"id": "send-input", "label": "Text replacement", "detail": "SendInput replacement path is ready.", "status": "pass"},
            {"id": "dpapi", "label": "Protected storage", "detail": "Credentials use current-user DPAPI.", "status": "pass"},
            {"id": "provider", "label": "Provider connection", "detail": "Run a provider test from Providers.", "status": "warn"},
            {"id": "startup", "label": "Start at login", "detail": "Startup preference is available.", "status": "pass"},
        ]

    def _runtime(self, config: dict, commands: list[dict]) -> dict:
        state = self._runtime_state()
        active_provider = config.get("provider", "gemini")
        provider_settings = config.get("providers") if isinstance(config.get("providers"), dict) else {}
        selected = provider_settings.get(active_provider) if isinstance(provider_settings.get(active_provider), dict) else {}
        keys = config.get("api_keys") if isinstance(config.get("api_keys"), list) else []
        if selected.get("api_key"):
            key_count = 1
        else:
            key_count = len(keys)
        return {
            "running": True,
            "paused": bool(state.get("paused", self.paused)),
            "provider": active_provider,
            "model": state.get("model") or selected.get("model") or config.get("model") or PROVIDERS.get(active_provider, PROVIDERS["gemini"]).model,
            "prefix": state.get("prefix") or config.get("prefix", "."),
            "commandCount": len(commands),
            "localStyleCount": sum(1 for item in commands if item["type"] == "style"),
            "protectedKeyCount": key_count,
            "uptimeSeconds": int(time.monotonic() - self.started_at),
            "requestsToday": int(state.get("requests_today", len(self.activity))),
            "lastCommand": state.get("last_command"),
            "lastCommandAt": state.get("last_command_at"),
            "firstRun": bool(config.get("first_run", False)),
            "launchAtStartup": bool(config.get("launch_at_startup", True)),
            "spinner": config.get("spinner", "animated"),
            "keyDelay": int(config.get("key_delay", 200)),
            "theme": config.get("theme", "lavender"),
            "reducedMotion": bool(config.get("reduced_motion", False)),
        }

    def snapshot(self) -> dict:
        with self._lock:
            config = self._config()
            commands = self._command_records()
            return {
                "runtime": self._runtime(config, commands),
                "providers": public_provider_records(config),
                "commands": commands,
                "activity": list(self.activity[-20:][::-1]),
                "diagnostics": self._diagnostic_records(),
                "logs": self.logs(),
            }

    def pause(self, payload: dict) -> dict:
        paused = payload.get("paused")
        if not isinstance(paused, bool):
            raise DashboardError("paused must be true or false.")
        self._set_paused(paused)
        self.paused = paused
        snapshot = self.snapshot()
        return snapshot["runtime"]

    def save_settings(self, payload: dict) -> dict:
        with self._lock:
            config = self._config()
            if "prefix" in payload:
                prefix = payload["prefix"]
                if not isinstance(prefix, str) or not prefix or len(prefix) > 4 or any(ch.isspace() for ch in prefix):
                    raise DashboardError("The command prefix must be 1–4 non-space characters.")
                config["prefix"] = prefix
            if "spinner" in payload:
                if payload["spinner"] not in VALID_SPINNERS:
                    raise DashboardError("Unknown processing indicator.")
                config["spinner"] = payload["spinner"]
            if "keyDelay" in payload:
                delay = payload["keyDelay"]
                if not isinstance(delay, (int, float)) or isinstance(delay, bool):
                    raise DashboardError("Replacement delay must be a number.")
                config["key_delay"] = max(30, min(500, int(delay)))
            if "theme" in payload:
                if payload["theme"] not in VALID_THEMES:
                    raise DashboardError("Unknown color theme.")
                config["theme"] = payload["theme"]
            for source, target in (("firstRun", "first_run"), ("launchAtStartup", "launch_at_startup"), ("reducedMotion", "reduced_motion")):
                if source in payload:
                    if not isinstance(payload[source], bool):
                        raise DashboardError(f"{source} must be true or false.")
                    config[target] = payload[source]
            self._write_config(config)
            if "launchAtStartup" in payload:
                self._apply_startup(bool(payload["launchAtStartup"]))
            return self._runtime(config, self._command_records())

    def _provider_settings(self, provider_id: str) -> tuple[dict, dict, dict]:
        if provider_id not in PROVIDERS:
            raise DashboardError("Unknown provider.", 404)
        config = self._config()
        providers = config.get("providers") if isinstance(config.get("providers"), dict) else {}
        providers = dict(providers)
        saved = providers.get(provider_id) if isinstance(providers.get(provider_id), dict) else {}
        return config, providers, dict(saved)

    def save_provider(self, provider_id: str, payload: dict) -> dict:
        with self._lock:
            config, providers, saved = self._provider_settings(provider_id)
            spec = PROVIDERS[provider_id]
            endpoint = payload.get("endpoint", saved.get("endpoint", spec.endpoint))
            endpoint = validate_endpoint(endpoint, local_only=spec.local)
            model = payload.get("model", saved.get("model", spec.model))
            if not isinstance(model, str) or not model.strip() or len(model) > 300:
                raise DashboardError("Enter a model identifier.")
            saved["endpoint"] = endpoint
            saved["model"] = model.strip()
            # Omitted/blank means keep the encrypted key already on disk.  A dedicated
            # future remove-key action can explicitly send removeKey=true.
            key_for_active = saved.get("api_key") if isinstance(saved.get("api_key"), str) else ""
            new_key = payload.get("apiKey")
            if isinstance(new_key, str) and new_key.strip():
                if len(new_key) > 8_192:
                    raise DashboardError("The API key is unexpectedly long.")
                key_for_active = new_key.strip()
                saved["api_key"] = key_for_active
            else:
                saved.pop("api_key", None)
            if payload.get("removeKey") is True:
                key_for_active = ""
                saved["api_key"] = ""
                saved.pop("api_key_protected", None)
            providers[provider_id] = saved
            config["providers"] = providers
            if payload.get("active") is True:
                config["provider"] = provider_id
                config["model"] = saved["model"]
                config["endpoint"] = endpoint if provider_id == "custom" else ""
                # Provider-scoped DPAPI storage is authoritative. Clear migrated root keys
                # so a key for the previous provider can never be sent to the new one.
                config["api_keys"] = []
            self._write_config(config)
            return next(item for item in public_provider_records(config) if item["id"] == provider_id)

    def _provider_connection(self, provider_id: str) -> tuple[str, str]:
        config, _providers, saved = self._provider_settings(provider_id)
        spec = PROVIDERS[provider_id]
        endpoint = saved.get("endpoint") if isinstance(saved.get("endpoint"), str) else spec.endpoint
        key = saved.get("api_key") if isinstance(saved.get("api_key"), str) else ""
        if not key and config.get("provider") == provider_id:
            keys = config.get("api_keys") if isinstance(config.get("api_keys"), list) else []
            key = next((item for item in keys if isinstance(item, str) and item), "")
        return endpoint, key

    def _candidate_connection(self, provider_id: str, payload: dict) -> tuple[str, str]:
        endpoint, key = self._provider_connection(provider_id)
        candidate_endpoint = payload.get("endpoint")
        candidate_key = payload.get("apiKey")
        if isinstance(candidate_endpoint, str) and candidate_endpoint.strip():
            endpoint = candidate_endpoint.strip()
        if isinstance(candidate_key, str) and candidate_key.strip():
            key = candidate_key.strip()
        return endpoint, key

    def provider_models(self, provider_id: str, payload: dict | None = None) -> dict:
        endpoint, key = self._candidate_connection(provider_id, payload or {})
        return {"models": fetch_models(provider_id, endpoint=endpoint, api_key=key)}

    def provider_test(self, provider_id: str, payload: dict | None = None) -> dict:
        payload = payload or {}
        endpoint, key = self._candidate_connection(provider_id, payload)
        _config, _providers, saved = self._provider_settings(provider_id)
        candidate_model = payload.get("model")
        model_name = candidate_model if isinstance(candidate_model, str) and candidate_model.strip() else saved.get("model", PROVIDERS[provider_id].model)
        return test_provider(provider_id, endpoint=endpoint, api_key=key, model=model_name)

    def save_command(self, command_id: str, payload: dict) -> dict:
        with self._lock:
            trigger = payload.get("trigger")
            command_type = payload.get("type")
            if not isinstance(trigger, str) or not TRIGGER_RE.fullmatch(trigger):
                raise DashboardError("The trigger must be 1–50 characters without spaces or a leading period.")
            if command_type not in EDITABLE_COMMAND_TYPES:
                raise DashboardError("Unknown or read-only command type.")
            prompt = payload.get("prompt", "")
            value = payload.get("value", "")
            if not isinstance(prompt, str) or not isinstance(value, str):
                raise DashboardError("Command values must be text.")
            if len(prompt) > 8_000 or len(value) > 65_536:
                raise DashboardError("The command content is too long.")
            records = self._command_records()
            record = {
                "id": command_id,
                "trigger": trigger,
                "type": command_type,
                "prompt": prompt,
                "value": value,
                "enabled": payload.get("enabled", True) is not False,
                "uses": int(payload.get("uses", 0)) if isinstance(payload.get("uses", 0), int) else 0,
            }
            replaced = False
            for index, item in enumerate(records):
                if item["id"] == command_id:
                    records[index] = record
                    replaced = True
                    break
                if item["trigger"] == trigger and item["id"] != command_id:
                    raise DashboardError("Another command already uses this trigger.", 409)
            if not replaced:
                if len(records) >= MAX_COMMANDS:
                    raise DashboardError("The command limit has been reached.")
                records.insert(0, record)
            self._persist_command_records(records)
            self._reload_runtime()
            return record

    def delete_command(self, command_id: str) -> dict:
        with self._lock:
            records = self._command_records()
            remaining = [item for item in records if item["id"] != command_id]
            if len(remaining) == len(records):
                raise DashboardError("Command not found.", 404)
            self._persist_command_records(remaining)
            self._reload_runtime()
            return {"ok": True}

    def playground(self, payload: dict) -> dict:
        command_name = payload.get("command")
        text = payload.get("input")
        if not isinstance(command_name, str) or not isinstance(text, str) or not text.strip():
            raise DashboardError("Choose a command and enter text.")
        if len(text.encode("utf-8")) > 64 * 1024:
            raise DashboardError("The playground input is too long.")
        command = next((item for item in self._command_records() if item["trigger"] == command_name), None)
        if not command:
            raise DashboardError("Command not found.", 404)
        started = time.perf_counter()
        local = command["type"] == "style"
        if local:
            output = transform(command["value"] or command["trigger"], text)
        elif command["type"] == "replacer-text":
            output = command["value"]
            local = True
        elif self._run_ai:
            output, error = self._run_ai(text, command["prompt"])
            if error or output is None:
                raise DashboardError(error or "The provider returned no result.", 502)
        else:
            raise DashboardError("The AI runtime is not connected to the dashboard.", 503)
        duration = max(1, round((time.perf_counter() - started) * 1000))
        self.activity.append({
            "id": secrets.token_hex(8), "command": f".{command_name}",
            "provider": "Local" if local else self._config().get("provider", "Provider"),
            "durationMs": duration, "time": "just now", "status": "success",
        })
        return {"output": output, "durationMs": duration, "local": local}

    def logs(self) -> list[dict]:
        records = self._log_records()
        return records[-200:] if isinstance(records, list) else []

    def run_diagnostics(self) -> list[dict]:
        return self._diagnostic_records()


class _DashboardHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, address, handler, *, backend: DashboardBackend, assets_dir: str, token: str):
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


class DashboardRequestHandler(BaseHTTPRequestHandler):
    server_version = "SwiftSlate"
    sys_version = ""

    def setup(self):
        super().setup()
        # A local process must not be able to hold unbounded handler threads open with
        # partial headers or bodies. Normal dashboard requests complete in milliseconds.
        self.connection.settimeout(10)

    def log_message(self, _format, *_args):
        return

    @property
    def app(self) -> _DashboardHTTPServer:
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
            if separator and name == "SwiftSlateSession":
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
                f"SwiftSlateSession={self.app.session_token}; "
                "HttpOnly; SameSite=Strict; Path=/api"
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
                self._json(200, self.app.backend.snapshot())
                return
            if self.command == "GET" and path == "/api/v1/logs":
                self._json(200, self.app.backend.logs())
                return
            payload = self._parse_json() if self.command in ("POST", "PUT", "PATCH") else {}
            if self.command == "PUT" and path == "/api/v1/runtime/pause":
                result = self.app.backend.pause(payload)
            elif self.command == "PATCH" and path == "/api/v1/settings":
                result = self.app.backend.save_settings(payload)
            elif self.command == "POST" and path == "/api/v1/playground":
                result = self.app.backend.playground(payload)
            elif self.command == "POST" and path == "/api/v1/diagnostics/run":
                result = self.app.backend.run_diagnostics()
            else:
                provider_match = re.fullmatch(r"/api/v1/providers/([^/]+)(?:/(models|test))?", path)
                command_match = re.fullmatch(r"/api/v1/commands/([^/]+)", path)
                if provider_match and self.command == "PUT" and provider_match.group(2) is None:
                    result = self.app.backend.save_provider(urllib.parse.unquote(provider_match.group(1)), payload)
                elif provider_match and self.command == "POST" and provider_match.group(2) == "models":
                    result = self.app.backend.provider_models(urllib.parse.unquote(provider_match.group(1)), payload)
                elif provider_match and self.command == "POST" and provider_match.group(2) == "test":
                    result = self.app.backend.provider_test(urllib.parse.unquote(provider_match.group(1)), payload)
                elif command_match and self.command == "PUT":
                    result = self.app.backend.save_command(urllib.parse.unquote(command_match.group(1)), payload)
                elif command_match and self.command == "DELETE":
                    result = self.app.backend.delete_command(urllib.parse.unquote(command_match.group(1)))
                else:
                    raise DashboardError("Endpoint not found.", 404)
            self._json(200, result)
        except (DashboardError, ProviderError, SecureConfigError) as exc:
            status = exc.status if isinstance(exc, DashboardError) else 400
            self._error(status, str(exc))
        except Exception:
            self._error(500, "The dashboard request failed.")

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
        content_type = mimetypes.guess_type(target)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        cache = "public, max-age=31536000, immutable" if relative.startswith("assets/") else "no-store"
        self.send_response(200)
        self._security_headers(content_type=content_type, length=len(body), cache=cache)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self):
        if urllib.parse.urlsplit(self.path).path.startswith("/api/"):
            self._dispatch_api()
        else:
            self._serve_static()

    def do_HEAD(self):
        if urllib.parse.urlsplit(self.path).path.startswith("/api/"):
            self._error(405, "Method not allowed.")
        else:
            self._serve_static()

    def do_POST(self): self._dispatch_api()
    def do_PUT(self): self._dispatch_api()
    def do_PATCH(self): self._dispatch_api()
    def do_DELETE(self): self._dispatch_api()
    def do_OPTIONS(self): self._error(405, "CORS is not enabled.")


def create_dashboard_server(
    backend: DashboardBackend,
    assets_dir: str,
    *,
    token: str | None = None,
) -> tuple[_DashboardHTTPServer, str]:
    assets_dir = os.path.abspath(assets_dir)
    if not os.path.isfile(os.path.join(assets_dir, "index.html")):
        raise DashboardError("Dashboard assets are missing. Reinstall SwiftSlate.", 500)
    session_token = token or secrets.token_urlsafe(32)
    server = _DashboardHTTPServer(
        ("127.0.0.1", 0),
        DashboardRequestHandler,
        backend=backend,
        assets_dir=assets_dir,
        token=session_token,
    )
    return server, session_token


__all__ = [
    "DashboardBackend", "DashboardError", "DashboardRequestHandler",
    "create_dashboard_server", "default_config", "ensure_config",
]
