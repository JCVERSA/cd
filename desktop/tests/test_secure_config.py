import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import secure_config


class SecureConfigTests(unittest.TestCase):
    def test_provider_keys_are_protected_and_round_trip_in_memory(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            config = {
                "provider": "openai",
                "api_keys": ["legacy-secret"],
                "providers": {"openai": {"model": "gpt-test", "api_key": "provider-secret"}},
            }
            encoded = {"legacy-secret": "blob-legacy", "provider-secret": "blob-provider"}
            decoded = {value: key for key, value in encoded.items()}
            with patch.object(secure_config, "protect", side_effect=lambda value: encoded[value]):
                secure_config.write_config(path, config)

            on_disk = json.loads(path.read_text(encoding="utf-8"))
            self.assertNotIn("api_keys", on_disk)
            self.assertNotIn("api_key", on_disk["providers"]["openai"])
            self.assertEqual(on_disk["api_keys_protected"], ["blob-legacy"])
            self.assertEqual(on_disk["providers"]["openai"]["api_key_protected"], "blob-provider")

            with patch.object(secure_config, "unprotect", side_effect=lambda value: decoded[value]):
                loaded = secure_config.read_config(path)
            self.assertEqual(loaded["api_keys"], ["legacy-secret"])
            self.assertEqual(loaded["providers"]["openai"]["api_key"], "provider-secret")

    def test_legacy_plaintext_keys_are_marked_and_never_rewritten_plaintext(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text('{"api_keys":["legacy-secret"]}', encoding="utf-8")
            loaded = secure_config.read_config(path)
            self.assertTrue(loaded["_legacy_plaintext_keys"])
            with patch.object(secure_config, "protect", return_value="protected-blob"):
                secure_config.write_config(path, loaded)
            on_disk = json.loads(path.read_text(encoding="utf-8"))
            self.assertNotIn("api_keys", on_disk)
            self.assertNotIn("_legacy_plaintext_keys", on_disk)
            self.assertEqual(on_disk["api_keys_protected"], ["protected-blob"])

    def test_mixed_legacy_and_protected_keys_are_marked_for_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(
                '{"api_keys":["stale-plaintext"],"api_keys_protected":["protected-blob"]}',
                encoding="utf-8",
            )
            with patch.object(secure_config, "unprotect", return_value="protected-secret"):
                loaded = secure_config.read_config(path)
            self.assertTrue(loaded["_legacy_plaintext_keys"])
            self.assertEqual(loaded["api_keys"], ["protected-secret"])
            with patch.object(secure_config, "protect", return_value="replacement-blob"):
                secure_config.write_config(path, loaded)
            on_disk = json.loads(path.read_text(encoding="utf-8"))
            self.assertNotIn("api_keys", on_disk)
            self.assertEqual(on_disk["api_keys_protected"], ["replacement-blob"])

    def test_legacy_provider_plaintext_is_marked_and_protected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(
                '{"providers":{"openai":{"api_key":"provider-secret"}}}',
                encoding="utf-8",
            )
            loaded = secure_config.read_config(path)
            self.assertTrue(loaded["_legacy_plaintext_keys"])
            with patch.object(secure_config, "protect", return_value="provider-blob"):
                secure_config.write_config(path, loaded)
            on_disk = json.loads(path.read_text(encoding="utf-8"))
            self.assertNotIn("api_key", on_disk["providers"]["openai"])
            self.assertEqual(on_disk["providers"]["openai"]["api_key_protected"], "provider-blob")

    def test_failed_protected_key_does_not_fall_back_to_mixed_plaintext(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(
                '{"providers":{"openai":{"api_key":"stale-secret","api_key_protected":"bad-blob"}}}',
                encoding="utf-8",
            )
            with patch.object(
                secure_config,
                "unprotect",
                side_effect=secure_config.SecureConfigError("wrong user"),
            ):
                loaded = secure_config.read_config(path)
            self.assertTrue(loaded["_legacy_plaintext_keys"])
            self.assertNotIn("api_key", loaded["providers"]["openai"])

    def test_omitted_provider_plaintext_preserves_existing_blob(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            secure_config.write_config(path, {
                "api_keys_protected": [],
                "providers": {"gemini": {"api_key_protected": "existing-blob", "model": "gemini-test"}},
            })
            on_disk = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(on_disk["providers"]["gemini"]["api_key_protected"], "existing-blob")


if __name__ == "__main__":
    unittest.main()
