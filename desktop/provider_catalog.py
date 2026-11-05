"""Provider metadata and bounded model discovery for SwiftSlate Desktop.

Only the Python background process ever handles provider credentials.  The UI receives
public provider records (configured/not configured), never decrypted keys.
"""

from __future__ import annotations

from dataclasses import dataclass
import ipaddress
import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

MAX_MODEL_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_MODELS = 2_000


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    name: str
    description: str
    endpoint: str
    model: str
    models_path: str
    chat_endpoint: str
    local: bool = False
    key_required: bool = True
    auth: str = "bearer"  # bearer | google | none
    portal_url: str = ""


PROVIDERS: dict[str, ProviderSpec] = {
    "gemini": ProviderSpec(
        "gemini", "Google Gemini", "Fast multimodal models with a generous developer tier.",
        "https://generativelanguage.googleapis.com", "gemini-3.5-flash-lite",
        "/v1beta/models", "https://generativelanguage.googleapis.com", auth="google",
        portal_url="https://aistudio.google.com/apikey",
    ),
    "groq": ProviderSpec(
        "groq", "Groq", "Low-latency inference for open models.",
        "https://api.groq.com", "openai/gpt-oss-120b", "/openai/v1/models",
        "https://api.groq.com/openai/v1",
        portal_url="https://console.groq.com/keys",
    ),
    "openai": ProviderSpec(
        "openai", "OpenAI", "OpenAI chat and reasoning models.",
        "https://api.openai.com/v1", "gpt-5-mini", "/models", "https://api.openai.com/v1",
        portal_url="https://platform.openai.com/api-keys",
    ),
    "openrouter": ProviderSpec(
        "openrouter", "OpenRouter", "One endpoint for hundreds of hosted models.",
        "https://openrouter.ai/api/v1", "openai/gpt-5-mini", "/models",
        "https://openrouter.ai/api/v1",
        portal_url="https://openrouter.ai/keys",
    ),
    "mistral": ProviderSpec(
        "mistral", "Mistral AI", "Efficient European open and commercial models.",
        "https://api.mistral.ai/v1", "mistral-small-latest", "/models",
        "https://api.mistral.ai/v1",
        portal_url="https://console.mistral.ai/api-keys",
    ),
    "deepseek": ProviderSpec(
        "deepseek", "DeepSeek", "Reasoning and coding models through an OpenAI-compatible API.",
        "https://api.deepseek.com", "deepseek-chat", "/models", "https://api.deepseek.com",
        portal_url="https://platform.deepseek.com/api_keys",
    ),
    "nvidia": ProviderSpec(
        "nvidia", "NVIDIA NIM", "Accelerated inference through NVIDIA API Catalog.",
        "https://integrate.api.nvidia.com/v1", "meta/llama-3.3-70b-instruct", "/models",
        "https://integrate.api.nvidia.com/v1",
        portal_url="https://build.nvidia.com/settings/api-keys",
    ),
    "ollama": ProviderSpec(
        "ollama", "Ollama", "Private local inference with models installed on this PC.",
        "http://127.0.0.1:11434", "llama3.2:latest", "/api/tags",
        "http://127.0.0.1:11434/v1", local=True, key_required=False, auth="none",
        portal_url="https://ollama.com/download",
    ),
    "lmstudio": ProviderSpec(
        "lmstudio", "LM Studio", "Use the local LM Studio OpenAI-compatible server.",
        "http://127.0.0.1:1234/v1", "local-model", "/models",
        "http://127.0.0.1:1234/v1", local=True, key_required=False, auth="none",
        portal_url="https://lmstudio.ai",
    ),
    "custom": ProviderSpec(
        "custom", "Custom endpoint", "Connect any OpenAI-compatible service.",
        "", "", "/models", "",
    ),
}


class ProviderError(RuntimeError):
    """A safe provider error suitable for showing in the local dashboard."""


class _SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        old = urllib.parse.urlsplit(req.full_url)
        new = urllib.parse.urlsplit(newurl)
        if old.scheme != new.scheme or old.hostname != new.hostname or old.port != new.port:
            return None
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_DEFAULT_OPENER = urllib.request.build_opener(_SameOriginRedirect())


def get_provider(provider_id: str) -> ProviderSpec:
    try:
        return PROVIDERS[provider_id]
    except KeyError as exc:
        raise ProviderError("Unknown provider.") from exc


def _is_loopback(host: str | None) -> bool:
    if not host:
        return False
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host.strip("[]")).is_loopback
    except ValueError:
        return False


def validate_endpoint(endpoint: str, *, local_only: bool = False) -> str:
    if not isinstance(endpoint, str) or not endpoint.strip():
        raise ProviderError("Enter a provider endpoint.")
    endpoint = endpoint.strip().rstrip("/")
    try:
        parsed = urllib.parse.urlsplit(endpoint)
        port = parsed.port
    except ValueError as exc:
        raise ProviderError("The provider endpoint is not a valid URL.") from exc
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ProviderError("The provider endpoint must be an HTTP or HTTPS URL without embedded credentials.")
    if parsed.query or parsed.fragment:
        raise ProviderError("The provider endpoint cannot contain a query string or fragment.")
    if local_only and not _is_loopback(parsed.hostname):
        raise ProviderError("This local provider must use localhost or a loopback address.")
    if parsed.scheme == "http" and not _is_loopback(parsed.hostname):
        raise ProviderError("Remote provider endpoints must use HTTPS.")
    if port is not None and not 1 <= port <= 65535:
        raise ProviderError("The provider endpoint contains an invalid port.")
    return endpoint


def join_endpoint(endpoint: str, path: str) -> str:
    endpoint = endpoint.rstrip("/")
    path = "/" + path.lstrip("/")
    # Specs with a versioned endpoint use paths relative to that version.
    if endpoint.endswith("/v1") and path.startswith("/v1/"):
        path = path[3:]
    return endpoint + path


def _bounded_json(response) -> object:
    content_length = response.headers.get("Content-Length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_MODEL_RESPONSE_BYTES:
        raise ProviderError("The provider returned an unexpectedly large model list.")
    body = response.read(MAX_MODEL_RESPONSE_BYTES + 1)
    if len(body) > MAX_MODEL_RESPONSE_BYTES:
        raise ProviderError("The provider returned an unexpectedly large model list.")
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise ProviderError("The provider returned an unreadable model list.") from exc


def _extract_model_ids(provider_id: str, payload: object) -> list[str]:
    if not isinstance(payload, dict):
        raise ProviderError("The provider returned an unexpected model list.")
    records = payload.get("models") if provider_id in ("gemini", "ollama") else payload.get("data")
    if not isinstance(records, list):
        raise ProviderError("The provider returned an unexpected model list.")
    models: list[str] = []
    for record in records[:MAX_MODELS]:
        if not isinstance(record, dict):
            continue
        value = record.get("name") if provider_id in ("gemini", "ollama") else record.get("id")
        if not isinstance(value, str) or not value.strip():
            continue
        value = value.strip()
        if provider_id == "gemini" and value.startswith("models/"):
            value = value[7:]
        if len(value) <= 300 and value not in models:
            models.append(value)
    return sorted(models, key=str.casefold)


def fetch_models(
    provider_id: str,
    *,
    endpoint: str | None = None,
    api_key: str = "",
    timeout: float = 12.0,
    opener=None,
) -> list[str]:
    spec = get_provider(provider_id)
    effective_endpoint = validate_endpoint(endpoint or spec.endpoint, local_only=spec.local)
    if spec.key_required and not api_key.strip():
        raise ProviderError("Add an API key before fetching models.")
    url = join_endpoint(effective_endpoint, spec.models_path)
    headers = {"Accept": "application/json", "User-Agent": "SwiftSlate/2.0"}
    if spec.auth == "bearer" and api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    elif spec.auth == "google" and api_key:
        headers["x-goog-api-key"] = api_key
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with (opener or _DEFAULT_OPENER).open(request, timeout=timeout) as response:
            return _extract_model_ids(provider_id, _bounded_json(response))
    except ProviderError:
        raise
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise ProviderError("The provider rejected this API key.") from exc
        if exc.code == 429:
            raise ProviderError("The provider is rate limiting requests. Try again shortly.") from exc
        raise ProviderError(f"The provider returned HTTP {exc.code}.") from exc
    except (urllib.error.URLError, TimeoutError, OSError, socket.timeout) as exc:
        if spec.local:
            raise ProviderError(f"{spec.name} is not reachable on this computer.") from exc
        raise ProviderError("The provider could not be reached.") from exc


def test_provider(
    provider_id: str,
    *,
    endpoint: str | None = None,
    api_key: str = "",
    model: str = "",
    timeout: float = 20.0,
    opener=None,
) -> dict:
    """Send a minimal generation request to verify the selected model, not user text."""
    spec = get_provider(provider_id)
    effective_endpoint = validate_endpoint(endpoint or spec.endpoint, local_only=spec.local)
    if spec.key_required and not api_key.strip():
        raise ProviderError("Add an API key before testing this provider.")
    selected_model = (model or spec.model).strip()
    if not selected_model:
        raise ProviderError("Choose a model before testing this provider.")

    headers = {"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "SwiftSlate/2.0"}
    if provider_id == "gemini":
        url = join_endpoint(effective_endpoint, f"/v1beta/models/{urllib.parse.quote(selected_model, safe='')}:generateContent")
        headers["x-goog-api-key"] = api_key
        payload = {"contents": [{"parts": [{"text": "Reply with OK."}]}], "generationConfig": {"maxOutputTokens": 8}}
    else:
        if spec.auth == "bearer" and api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        default_endpoint = spec.endpoint.rstrip("/")
        chat_base = spec.chat_endpoint if effective_endpoint.rstrip("/") == default_endpoint else effective_endpoint
        if provider_id == "ollama" and not chat_base.rstrip("/").endswith("/v1"):
            chat_base = chat_base.rstrip("/") + "/v1"
        url = join_endpoint(chat_base, "/chat/completions")
        payload = {
            "model": selected_model,
            "messages": [{"role": "user", "content": "Reply with OK."}],
            "temperature": 0,
            "max_tokens": 8,
            "stream": False,
        }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    started = time.perf_counter()
    try:
        with (opener or _DEFAULT_OPENER).open(request, timeout=timeout) as response:
            result = _bounded_json(response)
        if not isinstance(result, dict):
            raise ProviderError("The provider returned an unexpected test response.")
        if provider_id == "gemini":
            valid = isinstance(result.get("candidates"), list) and bool(result["candidates"])
        else:
            valid = isinstance(result.get("choices"), list) and bool(result["choices"])
        if not valid:
            raise ProviderError("The provider returned no content for the selected model.")
    except ProviderError:
        raise
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise ProviderError("The provider rejected this API key.") from exc
        if exc.code == 404:
            raise ProviderError("The selected model or endpoint was not found.") from exc
        if exc.code == 429:
            raise ProviderError("The provider is rate limiting requests. Try again shortly.") from exc
        raise ProviderError(f"The provider test returned HTTP {exc.code}.") from exc
    except (urllib.error.URLError, TimeoutError, OSError, socket.timeout) as exc:
        if spec.local:
            raise ProviderError(f"{spec.name} is not reachable on this computer.") from exc
        raise ProviderError("The provider could not be reached.") from exc
    return {
        "ok": True,
        "latencyMs": max(1, round((time.perf_counter() - started) * 1000)),
        "message": f"{spec.name} and {selected_model} are ready.",
    }


def public_provider_records(config: dict | None = None) -> list[dict]:
    config = config if isinstance(config, dict) else {}
    configured = config.get("providers") if isinstance(config.get("providers"), dict) else {}
    active = config.get("provider", "gemini")
    result = []
    for provider_id, spec in PROVIDERS.items():
        saved = configured.get(provider_id) if isinstance(configured.get(provider_id), dict) else {}
        endpoint = saved.get("endpoint") if isinstance(saved.get("endpoint"), str) else spec.endpoint
        model = saved.get("model") if isinstance(saved.get("model"), str) else spec.model
        key_configured = bool(saved.get("api_key") or saved.get("api_key_protected"))
        if provider_id == active and config.get("api_keys"):
            key_configured = True
        record = {
            "id": provider_id,
            "name": spec.name,
            "description": spec.description,
            "endpoint": endpoint,
            "model": model,
            "connected": provider_id == active and (not spec.key_required or key_configured),
            "local": spec.local,
            "keyConfigured": not spec.key_required or key_configured,
            "portalAvailable": bool(spec.portal_url),
        }
        result.append(record)
    return result


def default_provider_config() -> dict:
    return {
        provider_id: {"endpoint": spec.endpoint, "model": spec.model}
        for provider_id, spec in PROVIDERS.items()
    }


__all__ = [
    "PROVIDERS", "ProviderError", "ProviderSpec", "default_provider_config",
    "fetch_models", "get_provider", "join_endpoint", "public_provider_records",
    "test_provider", "validate_endpoint",
]
