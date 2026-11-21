"""Native Windows file dialogs used by the DroidSlate Files page.

The web UI cannot obtain real filesystem paths from ``<input type=file>`` or
drag & drop, so pick/save flows are opened by the local backend through the
common dialogs.  Every function returns ``None`` when the user cancels (or
when the platform has no native dialogs, e.g. during Linux CI tests).
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import os
import sys

OFN_OVERWRITEPROMPT = 0x00000002
OFN_HIDEREADONLY = 0x00000004
OFN_NOCHANGEDIR = 0x00000008
OFN_PATHMUSTEXIST = 0x00000800
OFN_FILEMUSTEXIST = 0x00001000
OFN_ALLOWMULTISELECT = 0x00000200
OFN_EXPLORER = 0x00080000

_BUFFER_CHARS = 32768  # common-dialog multi-select limit


def dialogs_supported() -> bool:
    """True when native dialogs can actually be shown on this platform."""
    return sys.platform == "win32"


class OPENFILENAMEW(ctypes.Structure):
    _fields_ = [
        ("lStructSize", wt.DWORD),
        ("hwndOwner", wt.HWND),
        ("hInstance", wt.HINSTANCE),
        ("lpstrFilter", wt.LPCWSTR),
        ("lpstrCustomFilter", wt.LPWSTR),
        ("nMaxCustFilter", wt.DWORD),
        ("nFilterIndex", wt.DWORD),
        ("lpstrFile", wt.LPWSTR),
        ("nMaxFile", wt.DWORD),
        ("lpstrFileTitle", wt.LPWSTR),
        ("nMaxFileTitle", wt.DWORD),
        ("lpstrInitialDir", wt.LPCWSTR),
        ("lpstrTitle", wt.LPCWSTR),
        ("Flags", wt.DWORD),
        ("nFileOffset", wt.USHORT),
        ("nFileExtension", wt.USHORT),
        ("lpstrDefExt", wt.LPCWSTR),
        ("lCustData", wt.DWORD),
        ("lpfnHook", ctypes.c_void_p),
        ("lpTemplateName", wt.LPCWSTR),
        ("pvReserved", ctypes.c_void_p),
        ("dwReserved", wt.DWORD),
        ("FlagsEx", wt.DWORD),
    ]


_ALL_FILTER = "All files (*.*)\x00*\x00\x00"


def _owner_hwnd():
    """Anchor the dialog to whatever window is currently in the foreground."""
    try:
        return ctypes.windll.user32.GetForegroundWindow()
    except Exception:  # nosec B110 - owner is cosmetic; None still works
        return None


def _parse_multi_select(buffer: str) -> list[str]:
    """Parse the common-dialog double-null buffer (dir + names, or one path)."""
    parts = [part for part in buffer.split("\x00") if part]
    if not parts:
        return []
    if len(parts) == 1:
        return [parts[0]]
    directory = parts[0]
    return [os.path.join(directory, name) for name in parts[1:]]


def pick_files(title: str = "Select files to push", initial_dir: str | None = None) -> list[str] | None:
    """Multi-select open dialog. ``None`` = cancelled / unavailable."""
    if sys.platform != "win32":
        return None
    buffer = ctypes.create_unicode_buffer(_BUFFER_CHARS)
    ofn = OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)
    ofn.hwndOwner = _owner_hwnd()
    ofn.lpstrFilter = _ALL_FILTER
    ofn.nFilterIndex = 1
    ofn.lpstrFile = ctypes.cast(buffer, wt.LPWSTR)
    ofn.nMaxFile = _BUFFER_CHARS
    ofn.lpstrTitle = title
    if initial_dir:
        ofn.lpstrInitialDir = initial_dir
    ofn.Flags = (
        OFN_EXPLORER | OFN_ALLOWMULTISELECT | OFN_FILEMUSTEXIST
        | OFN_PATHMUSTEXIST | OFN_HIDEREADONLY | OFN_NOCHANGEDIR
    )
    ok = ctypes.windll.comdlg32.GetOpenFileNameW(ctypes.byref(ofn))
    if not ok:
        return None
    return _parse_multi_select(buffer.value)


def pick_save_path(suggested: str = "", initial_dir: str | None = None) -> str | None:
    """Save-as dialog. ``None`` = cancelled / unavailable."""
    if sys.platform != "win32":
        return None
    suggested = os.path.basename(suggested or "")
    if len(suggested) > 200:
        suggested = suggested[:200]
    buffer = ctypes.create_unicode_buffer(_BUFFER_CHARS)
    buffer.value = suggested
    ofn = OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)
    ofn.hwndOwner = _owner_hwnd()
    ofn.lpstrFilter = _ALL_FILTER
    ofn.nFilterIndex = 1
    ofn.lpstrFile = ctypes.cast(buffer, wt.LPWSTR)
    ofn.nMaxFile = _BUFFER_CHARS
    ofn.lpstrTitle = "Save file as"
    if initial_dir:
        ofn.lpstrInitialDir = initial_dir
    ofn.Flags = OFN_EXPLORER | OFN_PATHMUSTEXIST | OFN_OVERWRITEPROMPT | OFN_NOCHANGEDIR
    ok = ctypes.windll.comdlg32.GetSaveFileNameW(ctypes.byref(ofn))
    if not ok:
        return None
    value = buffer.value
    return value or None


__all__ = ["pick_files", "pick_save_path"]
