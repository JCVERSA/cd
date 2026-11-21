"""Unit tests for droidslate/bundle_inspect.py (pure, no device)."""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bundle_inspect import (
    BundleError,
    detect_format,
    extract_entries,
    inspect_bundle,
    plan_install,
)

PROFILE_ARM64 = {
    "abis": ["arm64-v8a", "armeabi-v7a"],
    "density": 440,
    "sdk": 34,
    "locales": ["fr-FR", "en-US"],
}


def make_zip(path: str, entries: dict[str, bytes]) -> str:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as handle:
        for name, data in entries.items():
            handle.writestr(name, data)
    return path


class DetectFormatTests(unittest.TestCase):
    def test_supported_extensions(self):
        self.assertEqual(detect_format("a.apk"), "apk")
        self.assertEqual(detect_format("a.apks"), "apks")
        self.assertEqual(detect_format("a.xapk"), "xapk")
        self.assertEqual(detect_format("a.apkm"), "apkm")
        self.assertEqual(detect_format("a.zip"), "zip")
        self.assertEqual(detect_format("A.XAPK"), "xapk")

    def test_unsupported(self):
        for bad in ("a.aab", "a.exe", "a", "", None, 42, "a.txt"):
            with self.assertRaises(BundleError):
                detect_format(bad)


class InspectBundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def path(self, name):
        return os.path.join(self.tmp.name, name)

    def test_plain_apk_requires_manifest(self):
        good = make_zip(self.path("ok.apk"), {"AndroidManifest.xml": b"\x00", "classes.dex": b"d"})
        info = inspect_bundle(good, "ok.apk")
        self.assertEqual(info["format"], "apk")
        self.assertTrue(info["single"])
        bad = make_zip(self.path("bad.apk"), {"classes.dex": b"d"})
        with self.assertRaises(BundleError):
            inspect_bundle(bad, "bad.apk")

    def test_missing_file(self):
        with self.assertRaises(BundleError):
            inspect_bundle(self.path("ghost.xapk"), "ghost.xapk")

    def test_not_a_zip(self):
        raw = self.path("junk.apks")
        with open(raw, "wb") as handle:
            handle.write(b"this is not a zip")
        with self.assertRaises(BundleError):
            inspect_bundle(raw, "junk.apks")

    def test_xapk_with_manifest_and_obb(self):
        manifest = {
            "package_name": "com.example.game",
            "name": "Example Game",
            "version_name": "2.1.0",
            "version_code": "210",
            "min_sdk_version": "24",
        }
        entries = {
            "base.apk": b"BASE",
            "config.arm64_v8a.apk": b"ABI",
            "config.xxhdpi.apk": b"DPI",
            "config.fr.apk": b"FR",
            "manifest.json": json.dumps(manifest).encode(),
            "icon.png": b"PNG",
            "Android/obb/main.210.com.example.game.obb": b"OBB" * 100,
        }
        path = make_zip(self.path("game.xapk"), entries)
        info = inspect_bundle(path, "game.xapk")
        self.assertEqual(info["format"], "xapk")
        self.assertFalse(info["single"])
        self.assertEqual(info["meta"]["package"], "com.example.game")
        self.assertEqual(info["meta"]["label"], "Example Game")
        self.assertEqual(info["meta"]["version"], "2.1.0")
        self.assertEqual(len(info["apks"]), 4)
        self.assertEqual(len(info["obb"]), 1)
        self.assertTrue(info["icon"])

    def test_apkm_with_info_json(self):
        info_json = {
            "apkm_version": 5, "pname": "com.google.android.youtube",
            "app_name": "YouTube", "release_version": "19.0.1",
            "versioncode": "1537084864", "min_api": "26",
        }
        entries = {
            "base.apk": b"B",
            "split_config.arm64_v8a.apk": b"A",
            "split_config.en.apk": b"E",
            "info.json": json.dumps(info_json).encode(),
        }
        path = make_zip(self.path("yt.apkm"), entries)
        info = inspect_bundle(path, "yt.apkm")
        self.assertEqual(info["format"], "apkm")
        self.assertEqual(info["meta"]["package"], "com.google.android.youtube")
        self.assertEqual(info["meta"]["label"], "YouTube")
        self.assertEqual(info["meta"]["versionCode"], "1537084864")

    def test_apks_bundletool_layout(self):
        entries = {
            "toc.pb": b"TOC",
            "base-master.apk": b"M",
            "base-arm64_v8a.apk": b"A64",
            "base-armeabi_v7a.apk": b"A32",
            "base-xxhdpi.apk": b"DPI",
            "base-fr.apk": b"FR",
            "base-en.apk": b"EN",
        }
        path = make_zip(self.path("app.apks"), entries)
        info = inspect_bundle(path, "app.apks")
        self.assertEqual(info["format"], "apks")
        self.assertEqual(len(info["apks"]), 6)
        self.assertIsNone(info["meta"])

    def test_archive_without_apks_rejected(self):
        path = make_zip(self.path("empty.xapk"), {"readme.txt": b"hi"})
        with self.assertRaises(BundleError):
            inspect_bundle(path, "empty.xapk")

    def test_zip_slip_rejected_at_inspect(self):
        path = self.path("evil.xapk")
        with zipfile.ZipFile(path, "w") as handle:
            handle.writestr("base.apk", b"B")
            handle.writestr("../outside.apk", b"E")
        with self.assertRaises(BundleError):
            inspect_bundle(path, "evil.xapk")

    def test_too_many_entries_rejected(self):
        import bundle_inspect
        original = bundle_inspect.MAX_ENTRIES
        bundle_inspect.MAX_ENTRIES = 5
        try:
            entries = {f"f{i}.apk": b"x" for i in range(6)}
            path = make_zip(self.path("many.zip"), entries)
            with self.assertRaises(BundleError):
                inspect_bundle(path, "many.zip")
        finally:
            bundle_inspect.MAX_ENTRIES = original

    def test_total_size_cap_rejected(self):
        import bundle_inspect
        original = bundle_inspect.MAX_TOTAL_UNCOMPRESSED
        bundle_inspect.MAX_TOTAL_UNCOMPRESSED = 10
        try:
            path = make_zip(self.path("big.zip"), {"base.apk": b"x" * 64})
            with self.assertRaises(BundleError):
                inspect_bundle(path, "big.zip")
        finally:
            bundle_inspect.MAX_TOTAL_UNCOMPRESSED = original


class PlanInstallTests(unittest.TestCase):
    def test_single_apk(self):
        plan = plan_install(["only.apk"], PROFILE_ARM64)
        self.assertEqual(plan["selected"], ["only.apk"])

    def test_no_profile_returns_everything(self):
        plan = plan_install(["base.apk", "config.en.apk"], None)
        self.assertEqual(len(plan["selected"]), 2)
        self.assertTrue(any("Connect a device" in n for n in plan["notes"]))

    def test_bundletool_selection(self):
        names = [
            "base-master.apk", "base-arm64_v8a.apk", "base-armeabi_v7a.apk",
            "base-x86.apk", "base-xxhdpi.apk", "base-xxxhdpi.apk",
            "base-hdpi.apk", "base-fr.apk", "base-en.apk",
        ]
        plan = plan_install(names, PROFILE_ARM64)
        selected = plan["selected"]
        self.assertEqual(selected[0], "base-master.apk")
        self.assertIn("base-arm64_v8a.apk", selected)      # ABI match
        self.assertNotIn("base-x86.apk", selected)          # ABI miss
        # density 440 → closest bucket is xxhdpi (480), not hdpi/xxxhdpi
        self.assertIn("base-xxhdpi.apk", selected)
        self.assertNotIn("base-hdpi.apk", selected)
        self.assertNotIn("base-xxxhdpi.apk", selected)
        self.assertIn("base-fr.apk", selected)
        self.assertIn("base-en.apk", selected)

    def test_density_rule_largest_bucket_not_above_device(self):
        # device 480 → xxhdpi (480) fits exactly, hdpi also fits; largest ≤ = xxhdpi
        names = ["base-master.apk", "base-hdpi.apk", "base-xxhdpi.apk"]
        profile = dict(PROFILE_ARM64, density=480)
        plan = plan_install(names, profile)
        self.assertIn("base-xxhdpi.apk", plan["selected"])
        self.assertNotIn("base-hdpi.apk", plan["selected"])

    def test_density_unknown_includes_all_with_note(self):
        names = ["base-master.apk", "base-hdpi.apk", "base-xxhdpi.apk"]
        profile = dict(PROFILE_ARM64, density=0)
        plan = plan_install(names, profile)
        self.assertEqual(len(plan["selected"]), 3)
        self.assertTrue(any("density" in n for n in plan["notes"]))

    def test_no_matching_abi_raises(self):
        names = ["base-master.apk", "base-x86.apk", "base-arm64_v8a.apk"]
        profile = dict(PROFILE_ARM64, abis=["riscv64"])
        with self.assertRaises(BundleError):
            plan_install(names, profile)

    def test_xapk_split_config_style(self):
        names = [
            "base.apk", "split_config.arm64_v8a.apk", "split_config.armeabi_v7a.apk",
            "split_config.xxhdpi.apk", "split_config.en.apk", "split_config.fr.apk",
        ]
        plan = plan_install(names, PROFILE_ARM64)
        selected = plan["selected"]
        self.assertIn("split_config.arm64_v8a.apk", selected)
        # only the device's PRIMARY abi split set (abilist order)
        self.assertNotIn("split_config.armeabi_v7a.apk", selected)
        self.assertIn("split_config.xxhdpi.apk", selected)
        self.assertIn("split_config.en.apk", selected)

    def test_standalone_preferred_when_matching(self):
        names = [
            "base-master.apk", "base-arm64_v8a.apk",
            "standalones/standalone-arm64_v8a.apk",
        ]
        plan = plan_install(names, PROFILE_ARM64)
        self.assertEqual(plan["selected"], ["standalones/standalone-arm64_v8a.apk"])

    def test_feature_modules_kept(self):
        names = [
            "base-master.apk", "base-arm64_v8a.apk",
            "split_phonesky_data_loader.apk",
            "split_phonesky_data_loader.config.arm64_v8a.apk",
            "split_phonesky_data_loader.config.x86.apk",
        ]
        plan = plan_install(names, PROFILE_ARM64)
        selected = plan["selected"]
        self.assertIn("split_phonesky_data_loader.apk", selected)
        self.assertIn("split_phonesky_data_loader.config.arm64_v8a.apk", selected)
        self.assertNotIn("split_phonesky_data_loader.config.x86.apk", selected)

    def test_locale_underscore_form(self):
        names = ["base.apk", "split_config.zh_rCN.apk", "split_config.en.apk"]
        plan = plan_install(names, PROFILE_ARM64)
        self.assertIn("split_config.zh_rCN.apk", plan["selected"])

    def test_empty_rejected(self):
        with self.assertRaises(BundleError):
            plan_install([], PROFILE_ARM64)


class ExtractEntriesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_extract_only_selected(self):
        zip_path = os.path.join(self.tmp.name, "a.xapk")
        make_zip(zip_path, {"base.apk": b"B", "config.en.apk": b"E",
                            "icon.png": b"I"})
        dest = os.path.join(self.tmp.name, "out")
        paths = extract_entries(zip_path, ["base.apk", "config.en.apk"], dest)
        self.assertEqual(len(paths), 2)
        names = sorted(os.listdir(dest))
        self.assertEqual(names, ["base.apk", "config.en.apk"])
        with open(paths[0], "rb") as handle:
            self.assertEqual(handle.read(), b"B")

    def test_extract_rejects_traversal(self):
        zip_path = os.path.join(self.tmp.name, "evil.zip")
        with zipfile.ZipFile(zip_path, "w") as handle:
            handle.writestr("../escape.apk", b"X")
        dest = os.path.join(self.tmp.name, "out2")
        with self.assertRaises(BundleError):
            extract_entries(zip_path, ["../escape.apk"], dest)
        self.assertFalse(os.path.exists(os.path.join(self.tmp.name, "escape.apk")))

    def test_extract_missing_entry(self):
        zip_path = os.path.join(self.tmp.name, "b.zip")
        make_zip(zip_path, {"base.apk": b"B"})
        with self.assertRaises(BundleError):
            extract_entries(zip_path, ["ghost.apk"], os.path.join(self.tmp.name, "o"))


if __name__ == "__main__":
    unittest.main()
