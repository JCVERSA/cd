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
