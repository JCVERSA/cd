import io
import json
import unittest

from provider_catalog import (
    ProviderError,
    fetch_models,
    join_endpoint,
    public_provider_records,
    test_provider as probe_provider,
    validate_endpoint,
)


class _Response(io.BytesIO):
    def __init__(self, payload):
        super().__init__(json.dumps(payload).encode("utf-8"))
        self.headers = {}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


class _Opener:
    def __init__(self, payload):
        self.payload = payload
        self.request = None
        self.timeout = None

    def open(self, request, timeout):
        self.request = request
        self.timeout = timeout
        return _Response(self.payload)


class ProviderCatalogTests(unittest.TestCase):
    def test_remote_http_is_rejected_but_loopback_http_is_allowed(self):
        with self.assertRaises(ProviderError):
            validate_endpoint("http://api.example.com/v1")
        self.assertEqual(validate_endpoint("http://127.0.0.1:11434"), "http://127.0.0.1:11434")
        self.assertEqual(validate_endpoint("http://localhost:1234/v1"), "http://localhost:1234/v1")

    def test_endpoint_rejects_embedded_credentials_query_and_fragment(self):
        for endpoint in (
            "https://user:secret@example.com/v1",
            "https://example.com/v1?token=secret",
            "https://example.com/v1#fragment",
        ):
            with self.subTest(endpoint=endpoint), self.assertRaises(ProviderError):
                validate_endpoint(endpoint)

    def test_versioned_endpoints_are_joined_without_duplicate_v1(self):
        self.assertEqual(join_endpoint("https://example.com/v1", "/v1/models"), "https://example.com/v1/models")
        self.assertEqual(join_endpoint("https://example.com/v1", "/models"), "https://example.com/v1/models")

    def test_gemini_model_list_uses_header_auth_and_strips_prefix(self):
        opener = _Opener({"models": [{"name": "models/gemini-z"}, {"name": "models/gemini-a"}]})
        models = fetch_models("gemini", api_key="secret-value", opener=opener)
        self.assertEqual(models, ["gemini-a", "gemini-z"])
        self.assertEqual(opener.request.get_header("X-goog-api-key"), "secret-value")
        self.assertNotIn("secret-value", opener.request.full_url)

    def test_ollama_models_need_no_key(self):
        opener = _Opener({"models": [{"name": "llama3.2:latest"}]})
        self.assertEqual(fetch_models("ollama", opener=opener), ["llama3.2:latest"])
        self.assertIsNone(opener.request.get_header("Authorization"))

    def test_provider_test_sends_only_a_fixed_probe(self):
        opener = _Opener({"choices": [{"message": {"content": "OK"}}]})
        result = probe_provider(
            "openai", api_key="secret-value", model="gpt-test", opener=opener,
        )
        self.assertTrue(result["ok"])
        request_body = json.loads(opener.request.data)
        self.assertEqual(request_body["messages"][0]["content"], "Reply with OK.")
        self.assertEqual(request_body["model"], "gpt-test")

    def test_public_records_never_include_decrypted_keys(self):
        records = public_provider_records({
            "provider": "openai",
            "providers": {"openai": {"api_key": "top-secret", "model": "gpt-test"}},
        })
        serialized = json.dumps(records)
        self.assertNotIn("top-secret", serialized)
        openai = next(item for item in records if item["id"] == "openai")
        self.assertTrue(openai["keyConfigured"])
        self.assertTrue(openai["connected"])

    def test_public_records_expose_verified_https_portal_urls(self):
        from provider_catalog import PROVIDERS

        records = {item["id"]: item for item in public_provider_records({})}
        self.assertEqual(len(PROVIDERS), 16)
        self.assertEqual(PROVIDERS["gemini"].portal_url, "https://aistudio.google.com/apikey")
        self.assertEqual(PROVIDERS["groq"].portal_url, "https://console.groq.com/keys")
        self.assertEqual(PROVIDERS["cerebras"].portal_url, "https://cloud.cerebras.ai/")
        self.assertEqual(PROVIDERS["sambanova"].portal_url, "https://cloud.sambanova.ai/apis")
        self.assertEqual(PROVIDERS["openai"].portal_url, "https://platform.openai.com/api-keys")
        self.assertEqual(PROVIDERS["openrouter"].portal_url, "https://openrouter.ai/keys")
        self.assertEqual(PROVIDERS["cohere"].portal_url, "https://dashboard.cohere.com/api-keys")
        self.assertEqual(PROVIDERS["cohere"].endpoint, "https://api.cohere.ai/compatibility/v1")
        self.assertEqual(PROVIDERS["huggingface"].portal_url, "https://huggingface.co/settings/tokens")
        self.assertEqual(PROVIDERS["mistral"].portal_url, "https://console.mistral.ai/api-keys")
        self.assertEqual(PROVIDERS["deepseek"].portal_url, "https://platform.deepseek.com/api_keys")
        self.assertEqual(PROVIDERS["nvidia"].portal_url, "https://build.nvidia.com/settings/api-keys")
        self.assertEqual(PROVIDERS["xai"].portal_url, "https://console.x.ai")
        self.assertEqual(PROVIDERS["qwen"].portal_url, "https://bailian.console.alibabacloud.com/?apiKey=1")
        self.assertEqual(PROVIDERS["ollama"].portal_url, "https://ollama.com/download")
        self.assertEqual(PROVIDERS["lmstudio"].portal_url, "https://lmstudio.ai")
        self.assertEqual(PROVIDERS["custom"].portal_url, "")
        for provider_id, record in records.items():
            self.assertEqual(record["portalAvailable"], provider_id != "custom")
            self.assertEqual(record["freeTier"], provider_id not in ("openai", "custom"))

    def test_tier1_free_providers_use_openai_compatible_models_and_chat_paths(self):
        for provider_id in ("cerebras", "sambanova", "cohere", "huggingface", "xai", "qwen"):
            with self.subTest(provider=provider_id):
                models_opener = _Opener({"data": [{"id": "model-alpha"}]})
                self.assertEqual(
                    fetch_models(provider_id, api_key="test-key", opener=models_opener),
                    ["model-alpha"],
                )
                self.assertEqual(models_opener.request.get_header("Authorization"), "Bearer test-key")
                self.assertTrue(models_opener.request.full_url.endswith("/v1/models"))

                test_opener = _Opener({"choices": [{"message": {"content": "OK"}}]})
                probe = probe_provider(provider_id, api_key="test-key", opener=test_opener)
                self.assertTrue(probe["ok"])
                self.assertTrue(test_opener.request.full_url.endswith("/v1/chat/completions"))

    def test_validate_endpoint_blocks_disallowed_ip_literals_and_normalizes_chat_path(self):
        from provider_catalog import join_endpoint

        for bad in (
            "https://0.0.0.0:8443/v1",
            "https://[::]:8443/v1",
            "https://169.254.169.254/latest/meta-data",
            "https://[fe80::1]:8443/v1",
            "https://224.0.0.1/v1",
            "https://240.0.0.1/v1",
        ):
            with self.subTest(endpoint=bad), self.assertRaises(ProviderError):
                validate_endpoint(bad)

        self.assertEqual(
            validate_endpoint("https://192.168.1.25:8443/v1/chat/completions"),
            "https://192.168.1.25:8443/v1",
        )
        self.assertEqual(
            join_endpoint("https://proxy.example.com/v1/chat/completions", "/chat/completions"),
            "https://proxy.example.com/v1/chat/completions",
        )
        self.assertEqual(
            validate_endpoint("http://[::1]:11434/v1", local_only=True),
            "http://[::1]:11434/v1",
        )


if __name__ == "__main__":
    unittest.main()
