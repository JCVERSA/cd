"""Bundle inspection for the DroidSlate Installer tab (pure stdlib).

Handles the ZIP-based app bundle formats used around the Android
ecosystem: plain ``.apk``, bundletool/SAI ``.apks``, APKPure ``.xapk``,
APKMirror ``.apkm``, and generic multi-``.apk`` ``.zip`` archives.

Responsibilities:

* detect the format from the file name,
* read the ZIP central directory with **zip-slip and zip-bomb guards**,
* parse the JSON descriptors (``manifest.json`` / ``info.json``) when
  present — no binary AXML parsing, no third-party dependencies,
* choose the split set matching a device profile (ABI / density /
  locale rules mirroring bundletool's device spec),
* extract only the selected entries safely.

Nothing here touches adb or the network, so every rule is unit-testable
without a device.
"""

from __future__ import annotations

import json
import os
import re
import zipfile

__all__ = [
    "BundleError",
    "SUPPORTED_EXTS",
    "detect_format",
    "inspect_bundle",
    "plan_install",
    "extract_entries",
]


class BundleError(RuntimeError):
    """Unsupported, corrupt, or unsafe bundle (message is user-facing)."""


SUPPORTED_EXTS = (".apk", ".apks", ".xapk", ".apkm", ".zip")

MAX_ENTRIES = 1024
MAX_TOTAL_UNCOMPRESSED = 16 * 1024 ** 3  # 16 GiB — big OBB games fit
MAX_META_BYTES = 1024 * 1024             # JSON descriptors are tiny
MAX_NAME_LEN = 512

# ABI split names use underscores inside the file name.
_ABI_VALUES = {"arm64_v8a", "armeabi_v7a", "armeabi", "x86", "x86_64", "riscv64"}
_DENSITY_BUCKETS = {
    "ldpi": 120, "mdpi": 160, "hdpi": 240, "tvdpi": 213,
    "xhdpi": 320, "xxhdpi": 480, "xxxhdpi": 640,
}
# bundletool base-<value>.apk and split_config.<value>.apk stems.
_ABI_STEMS = {value.replace("-", "_") for value in _ABI_VALUES}
_LOCALE_RE = re.compile(r"^[a-z]{2,3}(?:-r[A-Z]{2,4})?$")
_BUNDLETOOL_LOCALE_RE = re.compile(r"^b\+[a-zA-Z]{2,8}(?:\+[a-zA-Z0-9-]+)+$")
_DENSITY_RE = re.compile(r"^(\d+)dpi$")
_BASE_NAMES = {
    "base.apk", "base-master.apk", "standalone.apk", "standalone-master.apk",
}
_ICON_NAMES = ("icon.png", "icon.jpg", "icon.webp")


def detect_format(filename: str) -> str:
    """Return ``apk|apks|xapk|apkm|zip`` from the extension (case-insensitive)."""
    if not isinstance(filename, str):
        raise BundleError("Invalid file name.")
    lower = filename.lower()
    for ext in SUPPORTED_EXTS:
        if lower.endswith(ext):
            return ext[1:]
    raise BundleError(
        "Unsupported file type. Use .apk, .apks, .xapk, .apkm, or .zip."
    )


def _safe_entry_name(name: str) -> str:
    """Validate a ZIP entry name (zip-slip guard); returns the cleaned name."""
    if not isinstance(name, str) or not name or len(name) > MAX_NAME_LEN:
        raise BundleError("The archive contains an invalid entry name.")
    normalized = name.replace("\\", "/")
    if normalized.startswith("/") or re.match(r"^[A-Za-z]:", normalized):
        raise BundleError(f"Unsafe absolute path in archive: {name[:120]}")
    parts = [part for part in normalized.split("/") if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        raise BundleError(f"Unsafe path in archive: {name[:120]}")
    return "/".join(parts)


def _open_guarded(path: str) -> tuple[zipfile.ZipFile, list[zipfile.ZipInfo]]:
    try:
        handle = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError, ValueError) as exc:
        raise BundleError("This file is not a readable ZIP/APK bundle.") from exc
    try:
        infos = handle.infolist()
    except Exception as exc:  # pragma: no cover - corrupted central directory
        handle.close()
        raise BundleError("The archive directory is damaged.") from exc
    if len(infos) > MAX_ENTRIES:
        handle.close()
        raise BundleError(f"Archive has too many entries (limit {MAX_ENTRIES}).")
    total = 0
    for info in infos:
        if info.flag_bits & 0x1:
            handle.close()
            raise BundleError("Encrypted archives are not supported.")
        _safe_entry_name(info.filename)
        total += info.file_size
    if total > MAX_TOTAL_UNCOMPRESSED:
        handle.close()
        raise BundleError("Archive is too large once decompressed.")
    return handle, infos


def _read_json_entry(handle: zipfile.ZipFile, infos: list[zipfile.ZipInfo],
                     entry_name: str) -> dict | None:
    for info in infos:
        if info.filename.replace("\\", "/").rstrip("/") == entry_name:
            if info.file_size > MAX_META_BYTES:
                return None
            try:
                with handle.open(info) as raw:
                    payload = json.load(raw)
                return payload if isinstance(payload, dict) else None
            except (OSError, ValueError, RuntimeError, zipfile.BadZipFile):
                return None
    return None


def _normalize_meta(descriptor: dict, keys: dict) -> dict | None:
    """Map a vendor descriptor onto our neutral metadata shape."""
    package = descriptor.get(keys.get("package", "package"))
    if not isinstance(package, str) or not package:
        return None
    label = descriptor.get(keys.get("label", "label"))
    version = descriptor.get(keys.get("version", "version"))
    version_code = descriptor.get(keys.get("version_code", "version_code"))
    min_sdk = descriptor.get(keys.get("min_sdk", "min_sdk"))
    return {
        "package": package,
        "label": label if isinstance(label, str) and label else None,
        "version": str(version) if version not in (None, "") else None,
        "versionCode": str(version_code) if version_code not in (None, "") else None,
        "minSdk": str(min_sdk) if min_sdk not in (None, "") else None,
    }


_XAPK_KEYS = {
    "package": "package_name", "label": "name", "version": "version_name",
    "version_code": "version_code", "min_sdk": "min_sdk_version",
}
_APKM_KEYS = {
    "package": "pname", "label": "app_name", "version": "release_version",
    "version_code": "versioncode", "min_sdk": "min_api",
}


def _descriptor_meta(handle, infos) -> dict | None:
    for entry_name, keys in (("manifest.json", _XAPK_KEYS), ("info.json", _APKM_KEYS)):
        descriptor = _read_json_entry(handle, infos, entry_name)
        if descriptor:
            meta = _normalize_meta(descriptor, keys)
            if meta:
                return meta
    return None


def inspect_bundle(path: str, filename: str) -> dict:
    """Inspect a staged bundle; returns a JSON-safe description.

    For a plain ``.apk`` the staged file itself is the payload (``single``).
    For archives: every APK/OBB entry, JSON metadata, and icon presence.
    """
    fmt = detect_format(filename)
    try:
        size = os.path.getsize(path)
    except OSError as exc:
        raise BundleError("Staged file is missing.") from exc

    if fmt == "apk":
        handle, infos = _open_guarded(path)
        try:
            names = {info.filename.replace("\\", "/") for info in infos}
            if "AndroidManifest.xml" not in names:
                raise BundleError("This .apk has no AndroidManifest.xml — not a valid APK.")
        finally:
            handle.close()
        return {
            "format": "apk", "filename": filename, "size": size,
            "single": True, "meta": None, "apks": [], "obb": [], "icon": False,
        }

    handle, infos = _open_guarded(path)
    try:
        apks: list[dict] = []
        obb: list[dict] = []
        icon = False
        for info in infos:
            clean = _safe_entry_name(info.filename)
            if clean.endswith("/"):
                continue
            base = clean.rsplit("/", 1)[-1].lower()
            if base in _ICON_NAMES:
                icon = True
            if base.endswith(".apk"):
                apks.append({"name": clean, "size": info.file_size})
            elif base.endswith(".obb"):
                obb.append({"name": clean, "size": info.file_size})
        if not apks:
            raise BundleError("The archive contains no .apk files.")
        meta = _descriptor_meta(handle, infos)
    finally:
        handle.close()

    return {
        "format": fmt, "filename": filename, "size": size,
        "single": False, "meta": meta, "apks": apks, "obb": obb, "icon": icon,
    }


def _split_stem(apk_name: str) -> str:
    base = apk_name.rsplit("/", 1)[-1]
    return base[:-4] if base.lower().endswith(".apk") else base


def _classify_split(stem: str) -> tuple[str, str] | None:
    """Classify a split stem → ('abi'|'density'|'locale', value) or None.

    Recognises ``split_config.<v>``, bundletool ``base-<v>``, and
    dynamic-feature ``<module>.config.<v>`` / ``split_<module>.config.<v>``.
    """
    value: str | None = None
    if stem.startswith("split_config."):
        value = stem[len("split_config."):]
    elif stem.startswith("base-"):
        value = stem[len("base-"):]
    else:
        match = re.search(r"(?:^|\.)config\.([A-Za-z0-9_-]+)$", stem)
        if match:
            value = match.group(1)
    if value is None:
        return None
    lowered = value.lower().replace("-", "_")
    # ABI first: "arm64_v8a" would otherwise look locale-ish.
    if lowered in _ABI_STEMS:
        return ("abi", lowered)
    density = _DENSITY_BUCKETS.get(lowered)
    if density is not None:
        return ("density", lowered)
    dpi_match = _DENSITY_RE.match(lowered)
    if dpi_match:
        return ("density", lowered)
    # zh_rCN / pt_rBR written with an underscore, plain "en", bundletool
    # "b+sr+Latn" locale groups.
    candidate = value.replace("_", "-")
    if _LOCALE_RE.match(candidate) or _BUNDLETOOL_LOCALE_RE.match(value):
        return ("locale", value)
    return None


def _density_value(stem_value: str) -> int:
    lowered = stem_value.lower()
    if lowered in _DENSITY_BUCKETS:
        return _DENSITY_BUCKETS[lowered]
    match = _DENSITY_RE.match(lowered)
    return int(match.group(1)) if match else 0


def _locale_variants(locale: str) -> set[str]:
    """``fr-FR`` → {fr, fr-rFR, fr_FR}; ``en`` → {en}."""
    locale = locale.replace("_", "-")
    parts = locale.split("-")
    variants = {parts[0].lower()}
    if len(parts) >= 2 and parts[1]:
        variants.add(f"{parts[0].lower()}-r{parts[1].upper()}")
        variants.add(f"{parts[0].lower()}_{parts[1].upper()}")
        variants.add(locale.lower())
    return variants


def plan_install(apk_names: list[str], profile: dict | None) -> dict:
    """Pick the entries to install for ``profile`` (bundletool-style rules).

    Returns ``{"selected": [...], "notes": [...]}``.  With ``profile=None``
    the caller should not install; the full list is returned for display.
    """
    if not apk_names:
        raise BundleError("No APK files to install.")
    notes: list[str] = []

    if len(apk_names) == 1:
        return {"selected": list(apk_names), "notes": ["Single APK."]}

    if profile is None:
        return {
            "selected": list(apk_names),
            "notes": ["Connect a device to compute the matching split set."],
        }

    abis_ordered = [str(a).lower().replace("-", "_") for a in profile.get("abis") or []]
    abis = set(abis_ordered)
    density = int(profile.get("density") or 0)
    locales: set[str] = set()
    for locale in profile.get("locales") or []:
        locales |= _locale_variants(str(locale))

    # bundletool standalones are self-contained per-configuration APKs.
    standalones = [n for n in apk_names if "/standalone" in n or n.startswith("standalone")]
    if standalones:
        for name in standalones:
            stem = _split_stem(name).lower()
            if any(abi in stem for abi in abis):
                notes.append("Using a device-specific standalone APK.")
                return {"selected": [name], "notes": notes}

    bases = [n for n in apk_names
             if _split_stem(n).lower() in _BASE_NAMES
             or n.rsplit("/", 1)[-1].lower() in _BASE_NAMES]
    if not bases:
        # No well-known base name: prefer a non-config entry (SAI-style
        # "splits/base.apk" is already matched above), else first entry.
        non_config = [n for n in apk_names if _classify_split(_split_stem(n)) is None]
        bases = [(non_config or apk_names)[0]]
    base = bases[0]
    selected: list[str] = [base]

    # Exactly one ABI split set, like bundletool: the device's primary ABI
    # (abilist order) that the bundle actually provides.
    chosen_abi = next(
        (abi for abi in abis_ordered
         if any(_classify_split(_split_stem(n)) == ("abi", abi) for n in apk_names)),
        None,
    )

    density_choices: list[tuple[int, str]] = []
    bundle_has_abi = False
    abi_selected = False
    for name in apk_names:
        if name == base:
            continue
        kind = _classify_split(_split_stem(name))
        if kind is None:
            selected.append(name)  # feature-module base / unknown: keep it
            continue
        dimension, value = kind
        if dimension == "abi":
            bundle_has_abi = True
            if chosen_abi is not None and value == chosen_abi:
                selected.append(name)
                abi_selected = True
        elif dimension == "density":
            density_choices.append((_density_value(value), name))
        elif dimension == "locale":
            selected.append(name)

    if density_choices:
        if density <= 0:
            selected.extend(name for _, name in density_choices)
            notes.append(f"Included all {len(density_choices)} density splits "
                         "(device density unknown).")
        else:
            # Exactly one density split: the bucket closest to the device
            # (ties resolved toward the higher-quality asset set).
            chosen = min(
                ((v, n) for v, n in density_choices if v > 0),
                key=lambda pair: (abs(pair[0] - density), -pair[0]),
            )
            selected.append(chosen[1])
            notes.append(f"Density split: {chosen[1].rsplit('/', 1)[-1]} "
                         f"(device {density} dpi).")

    if bundle_has_abi and not abi_selected and abis:
        raise BundleError(
            "No split in this bundle matches the device CPU "
            f"({', '.join(sorted(abis))})."
        )

    # De-duplicate, base first, then archive order.
    chosen = set(selected)
    ordered = [base] + [n for n in apk_names if n in chosen and n != base]
    locale_count = sum(1 for n in ordered
                       if (lambda k: k and k[0] == "locale")(_classify_split(_split_stem(n))))
    if locale_count:
        notes.append(f"Included {locale_count} language split(s).")
    notes.append(f"{len(ordered)} of {len(apk_names)} APK(s) selected for this device.")
    return {"selected": ordered, "notes": notes}


def extract_entries(zip_path: str, entry_names: list[str], dest_dir: str) -> list[str]:
    """Extract only ``entry_names`` (already validated) into ``dest_dir``.

    Returns the extracted absolute paths.  Re-validates every name at
    extraction time (defence in depth against zip-slip).
    """
    os.makedirs(dest_dir, exist_ok=True)
    handle, _ = _open_guarded(zip_path)
    extracted: list[str] = []
    try:
        infos = {info.filename.replace("\\", "/"): info for info in handle.infolist()}
        for wanted in entry_names:
            clean = _safe_entry_name(wanted)
            info = infos.get(clean) or infos.get(clean + "/")
            if info is None or info.is_dir():
                raise BundleError(f"Missing archive entry: {clean[:120]}")
            target = os.path.realpath(os.path.join(dest_dir, *clean.split("/")))
            dest_root = os.path.realpath(dest_dir)
            if target != dest_root and not target.startswith(dest_root + os.sep):
                raise BundleError(f"Unsafe extraction path: {clean[:120]}")
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with handle.open(info) as source, open(target, "wb") as sink:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    sink.write(chunk)
            extracted.append(target)
    finally:
        handle.close()
    return extracted
