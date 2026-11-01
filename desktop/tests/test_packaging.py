import ast
from pathlib import Path
import unittest


ROOT = Path(__file__).parents[1]


class DesktopPackagingTest(unittest.TestCase):
    def test_windows_packaging_sources_exist(self):
        expected = (
            "SwiftSlate.pyw", "SwiftSlate.spec", "build_windows.ps1",
            "packaging/SwiftSlate.iss", "requirements-build.txt",
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

    def test_bundle_is_one_directory_and_contains_no_node_or_electron_runtime(self):
        spec = (ROOT / "SwiftSlate.spec").read_text(encoding="utf-8")
        requirements = (ROOT / "requirements-build.txt").read_text(encoding="utf-8").lower()
        package = (ROOT / "ui" / "package.json").read_text(encoding="utf-8").lower()
        self.assertIn("coll = collect", spec.lower())
        self.assertIn("pywebview", requirements)
        self.assertNotIn("electron", requirements)
        self.assertNotIn("electron", package)

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
