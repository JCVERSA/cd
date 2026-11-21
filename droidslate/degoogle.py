"""DeGoogle package catalogs and per-device state (from the original Nxzume ADB GUI).

Buckets are deduplicated and disjoint: a package belongs to exactly one
bucket, so the Custom mode never offers the same package twice.  ``unsafe``
packages are excluded from the Simple mode entirely and only ever processed
when the user explicitly selects them in Custom mode.
"""

from __future__ import annotations

import json
import os
import tempfile

SAFE_PACKAGES: list[str] = list(dict.fromkeys([
    # A. Google Apps
    "com.google.android.youtube",
    "com.google.android.apps.youtube.music",
    "com.google.android.videos",
    "com.google.android.music",
    "com.google.android.apps.books",
    "com.google.android.apps.podcasts",
    "com.google.android.apps.tachyon",           # Duo / Meet
    "com.google.android.apps.chromecast.app",    # Google Home
    "com.google.android.apps.maps",
    "com.google.android.apps.docs",              # Google Drive
    "com.google.android.gm",                     # Gmail
    "com.google.android.calendar",
    "com.google.android.contacts",
    # B. Google Assistant / Search / AI
    "com.google.android.googlequicksearchbox",
    "com.google.android.apps.googleassistant",
    "com.android.hotwordenrollment.okgoogle",
    "com.android.hotwordenrollment.xgoogle",
    "com.google.android.apps.scribe",            # Recorder transcription AI
    "com.google.android.as",                     # Pixel AI suggestions
    "com.google.android.apps.aiwallpapers",
    # C. Google Media Processing & AR
    "com.google.ar.core",
    "com.google.android.apps.photos",
    "com.google.android.apps.lens",
    "com.google.android.apps.photos.scanner",
    # D. Pixel Optional Features
    "com.google.android.apps.pixelmigrate",
    "com.google.android.apps.pixel.setupwizard",
    "com.google.android.apps.pixel.typeapps",
    "com.google.android.apps.pixel.extras",
    "com.google.android.onetimeinitializer",
    # E. Cloud / Backup / Sync (non-essential)
    "com.google.android.apps.restore",
    "com.google.android.backuptransport",
    "com.google.android.partnersetup",
    # F. Vehicle / Cast / Wearable
    "com.google.android.projection.gearhead",    # Android Auto
    "com.google.android.gms.car",
    "com.google.android.apps.wearables",
    # G. Logging / Analytics / Feedback
    "com.google.android.feedback",
    "com.google.mainline.telemetry",
    "com.google.android.gms.advertisingid",
    "com.google.android.gms.location.history",
]))

RISKY_PACKAGES: list[str] = list(dict.fromkeys([
    "com.google.android.gsf.login",              # Google Login Service
    "com.google.android.providers.gsf",          # Google Services Provider
    "com.google.android.syncadapters.calendar",  # Calendar sync
    "com.google.android.syncadapters.contacts",  # Contacts sync
]))

# Removing these can break the device (bootloop, no camera, no network, no
# launcher, failed OTAs).  Surfaced behind explicit warnings only.
UNSAFE_PACKAGES: list[str] = list(dict.fromkeys([
    # A. Pixel Launcher + UI
    "com.google.android.pixel.launcher",
    "com.google.android.apps.wallpaper",
    "com.google.android.systemui",
    "com.android.systemui",
    # B. Camera / Image Pipeline
    "com.google.pixel.camera.services",
    "com.google.android.camera",
    "com.google.android.camera.provider",
    "com.google.android.camera.experimental2018",
    # C. Google Play Core Components
    "com.google.android.gms",
    "com.google.android.gsf",
    "com.google.android.gms.location",
    "com.google.android.gms.policy_sidecar",
    # D. Phone, Messaging, Carrier
    "com.android.phone",
    "com.android.providers.telephony",
    "com.android.providers.telephony.overlay",
    "com.android.carrierconfig",
    "com.google.android.ims",                    # VoLTE / VoWiFi
    # E. Core Android Infrastructure
    "com.android.providers.downloads",
    "com.android.providers.downloads.ui",
    "com.android.vending",                       # Play Store
    "com.android.packageinstaller",
    # F. OTA Update Critical
    "com.google.android.gms.update",
    "com.google.android.gms.setup",
    "com.google.android.gms.unstable",
]))

ALL_PACKAGES: list[str] = list(dict.fromkeys(
    SAFE_PACKAGES + RISKY_PACKAGES + UNSAFE_PACKAGES
))

BUCKETS: dict[str, list[str]] = {
    "safe": SAFE_PACKAGES,
    "risky": RISKY_PACKAGES,
    "unsafe": UNSAFE_PACKAGES,
}

BUCKET_SETS: dict[str, frozenset[str]] = {
    name: frozenset(packages) for name, packages in BUCKETS.items()
}
ALL_SET = frozenset(ALL_PACKAGES)


def simple_candidates(include_risky: bool = False) -> list[str]:
    """Packages the Simple mode may touch — never includes ``unsafe``."""
    candidates = list(SAFE_PACKAGES)
    if include_risky:
        candidates.extend(p for p in RISKY_PACKAGES if p not in set(candidates))
    return candidates


def empty_state() -> dict:
    return {"disabled": [], "uninstalled": [], "updated": ""}


def load_state(path: str) -> dict:
    """Read ``degoogle_state.json``: ``{serial: {disabled, uninstalled, updated}}``."""
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8-sig") as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return {}
    if not isinstance(payload, dict):
        return {}
    clean: dict[str, dict] = {}
    for serial, entry in payload.items():
        if not isinstance(serial, str) or not isinstance(entry, dict):
            continue
        clean[serial] = {
            "disabled": [p for p in entry.get("disabled", []) if isinstance(p, str)][:500],
            "uninstalled": [p for p in entry.get("uninstalled", []) if isinstance(p, str)][:500],
            "updated": entry.get("updated", "") if isinstance(entry.get("updated", ""), str) else "",
        }
    return clean


def save_state(path: str, state: dict) -> None:
    """Atomically persist the DeGoogle state."""
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".degoogle.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)
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


# Display names the original tool special-cases.
FRIENDLY_NAMES: dict[str, str] = {
    "com.google.android.carlink": "Android Auto",
}


def friendly_name(package: str) -> str:
    """Human-readable label (same .capitalize() rule as the original)."""
    if package in FRIENDLY_NAMES:
        return FRIENDLY_NAMES[package]
    return " ".join(part.capitalize() for part in package.split("."))


__all__ = [
    "ALL_PACKAGES", "ALL_SET", "BUCKETS", "BUCKET_SETS",
    "FRIENDLY_NAMES", "RISKY_PACKAGES", "SAFE_PACKAGES", "UNSAFE_PACKAGES",
    "empty_state", "friendly_name", "load_state", "save_state",
    "simple_candidates",
]
