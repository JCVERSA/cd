import ast
import hashlib
import json
from pathlib import Path
import struct
import unittest


ROOT = Path(__file__).parents[1]


class DesktopPackagingTest(unittest.TestCase):
    def test_windows_packaging_sources_exist(self):
        expected = (
            "SwiftSlate.pyw", "SwiftSlate.spec", "build_windows.ps1",
            "packaging/SwiftSlate.iss", "requirements-build.txt", "requirements-build-lock.txt",
            "dashboard_server.py", "provider_catalog.py", "ui_host.py",
            "ui_bundle/index.html", "ui/src/assets/swiftslate-logo.png",
            "packaging/SwiftSlate.ico", "packaging/tray-mark.png",
            "packaging/wizard/SwiftSlate-Wizard-Light.png",
            "packaging/wizard/SwiftSlate-Wizard-Dark.png",
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

    def test_brand_assets_and_dynamic_wizard_are_wired(self):
        logo = ROOT / "ui" / "src" / "assets" / "swiftslate-logo.png"
        self.assertEqual(
            hashlib.sha256(logo.read_bytes()).hexdigest(),
            "ba295e38089ddeeb6b897981ae637744f44b8c84a973e4e1895331ecce52d913",
        )
        self.assertEqual(struct.unpack(">II", logo.read_bytes()[16:24]), (512, 512))

        ico = (ROOT / "packaging" / "SwiftSlate.ico").read_bytes()
        reserved, image_type, count = struct.unpack("<HHH", ico[:6])
        self.assertEqual((reserved, image_type, count), (0, 1, 7))
        sizes = []
        for index in range(count):
            width, height = ico[6 + index * 16:8 + index * 16]
            sizes.append((width or 256, height or 256))
        self.assertEqual(sizes, [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

        for name in ("SwiftSlate-Wizard-Light.png", "SwiftSlate-Wizard-Dark.png"):
            panel = (ROOT / "packaging" / "wizard" / name).read_bytes()
            self.assertEqual(struct.unpack(">II", panel[16:24]), (534, 1022))

        spec = (ROOT / "SwiftSlate.spec").read_text(encoding="utf-8")
        source = (ROOT / "SwiftSlate.pyw").read_text(encoding="utf-8")
        installer = (ROOT / "packaging" / "SwiftSlate.iss").read_text(encoding="utf-8")
        self.assertIn("icon=str(root / 'packaging' / 'SwiftSlate.ico')", spec)
        self.assertIn("(str(root / 'packaging' / 'SwiftSlate.ico'), 'assets')", spec)
        self.assertIn("LoadImageW", source)
        self.assertIn("nid.hIcon = _small_app_icon", source)
        self.assertIn("SetupIconFile=SwiftSlate.ico", installer)
        self.assertIn("WizardStyle=modern dynamic windows11 includetitlebar", installer)
        self.assertIn("WizardImageFileDynamicDark=", installer)
        self.assertIn("CreateCustomPage(", installer)

    def test_frontend_uses_one_normalized_icon_system_and_the_brand_logo(self):
        package = json.loads((ROOT / "ui" / "package.json").read_text(encoding="utf-8"))
        dependencies = package["dependencies"]
        all_packages = dependencies | package["devDependencies"]
        self.assertFalse(any("lucide" in name.lower() for name in all_packages))
        self.assertFalse(any("hugeicon" in name.lower() for name in all_packages))
        for icon_module in ("glyphGeometry.ts", "glyphCatalog.ts", "SlateIcon.ts", "index.ts"):
            self.assertTrue((ROOT / "ui" / "src" / "icons" / icon_module).is_file(), icon_module)
        tsx_source = "".join(path.read_text(encoding="utf-8") for path in (ROOT / "ui" / "src").rglob("*.tsx"))
        self.assertNotIn("<svg", tsx_source)
        self.assertNotIn("<select", tsx_source)
        self.assertNotIn("<option", tsx_source)
        sidebar = (ROOT / "ui" / "src" / "components" / "Sidebar.tsx").read_text(encoding="utf-8")
        onboarding = (ROOT / "ui" / "src" / "components" / "Onboarding.tsx").read_text(encoding="utf-8")
        html = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
        self.assertIn("<BrandLogo", sidebar)
        self.assertIn("<BrandLogo", onboarding)
        self.assertIn("swiftslate-logo.png", html)
        provider_logo = (ROOT / "ui" / "src" / "components" / "ProviderLogo.tsx").read_text(encoding="utf-8")
        providers_dir = ROOT / "ui" / "src" / "assets" / "providers"
        for provider_id in (
            "gemini", "groq", "cerebras", "sambanova", "openai", "openrouter",
            "cohere", "huggingface", "mistral", "deepseek", "nvidia", "xai",
            "qwen", "ollama", "lmstudio", "custom",
        ):
            svg_path = providers_dir / f"{provider_id}.svg"
            self.assertTrue(svg_path.is_file(), f"Missing provider logo {svg_path}")
            svg_text = svg_path.read_text(encoding="utf-8")
            self.assertTrue(svg_text.lstrip().startswith("<svg"), provider_id)
            self.assertNotIn("<script", svg_text.lower(), provider_id)
            self.assertNotIn("https://", svg_text.lower(), provider_id)
            self.assertIn(f"providers/{provider_id}.svg", provider_logo)
        custom_svg = (providers_dir / "custom.svg").read_text(encoding="utf-8")
        self.assertNotIn("<rect", custom_svg.lower())
        self.assertLessEqual(custom_svg.count("<path"), 3)
        topbar = (ROOT / "ui" / "src" / "components" / "Topbar.tsx").read_text(encoding="utf-8")
        self.assertIn("Ctrl K", topbar)
        self.assertNotIn("⌘K", topbar)
        diagnostics = (ROOT / "ui" / "src" / "screens" / "Diagnostics.tsx").read_text(encoding="utf-8")
        self.assertIn("debug.log", diagnostics)
        self.assertNotIn("log-dot-red", diagnostics)

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
        self.assertIn("Inno Setup 7\\ISCC.exe", script)
        self.assertNotIn("Inno Setup 6", script)
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

    def test_close_and_minimize_hide_to_tray_and_single_click_reopens(self):
        from ui_host import _hide_to_tray

        class FakeWindow:
            destroyed = False

            def destroy(self):
                self.destroyed = True

        window = FakeWindow()
        _hide_to_tray(window)
        self.assertTrue(window.destroyed)

        source = (ROOT / "SwiftSlate.pyw").read_text(encoding="utf-8")
        host = (ROOT / "ui_host.py").read_text(encoding="utf-8")
        self.assertIn("tray_event = int(lparam) & 0xFFFF", source)
        self.assertIn("WM_LBUTTONUP, WM_LBUTTONDBLCLK, NIN_SELECT, NIN_KEYSELECT", source)
        self.assertIn("window.events.minimized += _hide_to_tray", host)
        self.assertIn("window.destroy()", host)

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
