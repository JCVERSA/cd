# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import os
import sys

from PyInstaller.utils.hooks import collect_data_files

root = Path(SPECPATH).resolve()
webview_data = collect_data_files('webview', includes=['lib/**'])

# The CI build downloads Google platform-tools into adb-bin/ so the installer can
# ship adb.exe. Source checkouts without that folder still produce a working app:
# DroidSlate then falls back to PATH / user-configured adb locations.
adb_bin = root / 'adb-bin'
adb_data = []
if adb_bin.is_dir():
    for name in ('adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll'):
        candidate = adb_bin / name
        if candidate.is_file():
            adb_data.append((str(candidate), 'adb-bin'))

a = Analysis(
    ['DroidSlate.pyw'],
    pathex=[str(root)],
    binaries=[],
    datas=[
        (str(root / 'ui_bundle'), 'ui_bundle'),
        (str(root / 'packaging' / 'DroidSlate.ico'), 'assets'),
        (str(root / 'packaging' / 'droidslate-logo.png'), 'assets'),
    ] + adb_data + webview_data,
    hiddenimports=[
        'clr',
        'pythonnet',
        'webview.platforms.win32',
        'webview.platforms.winforms',
        'webview.platforms.edgechromium',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'pytest',
        'IPython',
        'webview.platforms.android',
        'webview.platforms.cef',
        'webview.platforms.cocoa',
        'webview.platforms.gtk',
        'webview.platforms.qt',
    ],
    noarchive=False,
    optimize=2,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='DroidSlate',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='x86_64',
    codesign_identity=None,
    entitlements_file=None,
    icon=str(root / 'packaging' / 'DroidSlate.ico'),
    version=str(root / 'packaging' / 'version_info.txt'),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='DroidSlate',
)
