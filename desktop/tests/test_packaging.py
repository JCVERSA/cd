import ast
from pathlib import Path
import unittest


ROOT = Path(__file__).parents[1]


class DesktopPackagingTest(unittest.TestCase):
    def test_windows_packaging_sources_exist(self):
        expected = (
            "SwiftSlate.pyw", "SwiftSlate.spec", "build_windows.ps1",
            "packaging/SwiftSlate.iss", "requirements-build.txt", "requirements-build-lock.txt",
            "dashboard_server.py", "provider_catalog.py", "ui_host.py",
            "ui_bundle/index.html",
        )
        for name in expected:
            self.assertTrue((ROOT / name).is_file(), name)

    def test_installer_has_stable_product_names_and_per_user_install(self):
        script = (ROOT / "packaging" / "SwiftSlate.iss").read_text(encoding="utf-8")
        self.assertIn("SwiftSlate-Setup-x64", script)
        self.assertIn("SwiftSlate.exe", script)
        self.assertIn("PrivilegesRequired=lowest", script)
        self.assertIn("{localappdata}\\Programs\\SwiftSlate", script)
        self.assertIn("MicrosoftEdgeWebview2Setup.exe", script)
        self.assertIn("{sys}\\taskkill.exe", script)
        self.assertNotIn("{cmd}", script)
        self.assertIn("RegDeleteValue(HKCU", script)
        self.assertNotIn("ValueType: none", script)

    def test_bundle_is_one_directory_and_contains_no_node_or_electron_runtime(self):
        spec = (ROOT / "SwiftSlate.spec").read_text(encoding="utf-8")
        requirements = (ROOT / "requirements-build.txt").read_text(encoding="utf-8").lower()
        package = (ROOT / "ui" / "package.json").read_text(encoding="utf-8").lower()
        self.assertIn("coll = collect", spec.lower())
        self.assertIn("pywebview", requirements)
        self.assertNotIn("electron", requirements)
        self.assertNotIn("electron", package)

    def test_windows_python_build_is_hash_locked(self):
        lock = (ROOT / "requirements-build-lock.txt").read_text(encoding="utf-8")
        script = (ROOT / "build_windows.ps1").read_text(encoding="utf-8")
        self.assertGreaterEqual(lock.count("--hash=sha256:"), 15)
        self.assertIn("--require-hashes", script)
        self.assertIn("requirements-build-lock.txt", script)
        workflow = (ROOT.parent / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
        self.assertIn("--require-hashes -r requirements-build-lock.txt", workflow)
        self.assertIn("innosetup-7.1.1-x64.exe", workflow)
        self.assertIn("8a5a6711c3766a6e5fb74f280ba0e3551e719ce94538d901fdbd1f8f9920b3f0", workflow)
        self.assertIn("Get-FileHash -Algorithm SHA256", workflow)

    def test_github_actions_are_pinned_to_commits(self):
        workflow = (ROOT.parent / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
        expected = {
            "actions/checkout": "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09",
            "actions/setup-python": "ece7cb06caefa5fff74198d8649806c4678c61a1",
            "actions/setup-node": "a0853c24544627f65ddf259abe73b1d18a591444",
            "actions/upload-artifact": "cf430e030ddbb5b0abf93d22962f4752f3646cd9",
        }
        action_lines = [line.strip() for line in workflow.splitlines() if "uses:" in line]
        self.assertTrue(action_lines)
        for line in action_lines:
            action, reference = line.split("uses:", 1)[1].strip().split("@", 1)
            reference = reference.split()[0]
            self.assertRegex(reference, r"^[0-9a-f]{40}$", line)
            self.assertEqual(reference, expected[action], line)

    def test_engine_uses_shell_free_commands_and_kernel_singleton(self):
        source = (ROOT / "SwiftSlate.pyw").read_text(encoding="utf-8")
        module = ast.parse(source)
        shell_calls = [
            node for node in ast.walk(module)
            if isinstance(node, ast.Call)
            and any(
                keyword.arg == "shell"
                and isinstance(keyword.value, ast.Constant)
                and keyword.value.value is True
                for keyword in node.keywords
            )
        ]
        self.assertEqual(shell_calls, [])
        self.assertIn("CommandLineToArgvW", source)
        self.assertIn("CreateMutexW", source)
        self.assertNotIn("msvcrt.locking", source)
        self.assertIn("_processing_lock.acquire(blocking=False)", source)

    def test_windows_default_prefix_is_a_period(self):
        source = (ROOT / "SwiftSlate.pyw").read_text(encoding="utf-8")
        module = ast.parse(source)
        defaults = {
            target.id: ast.literal_eval(node.value)
            for node in module.body
            if isinstance(node, ast.Assign)
            for target in node.targets
            if isinstance(target, ast.Name) and target.id in {"prefix"}
        }
        self.assertEqual(defaults.get("prefix"), ".")


if __name__ == "__main__":
    unittest.main()
