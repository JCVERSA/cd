# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files

root = Path(SPECPATH).resolve()
webview_data = collect_data_files('webview', includes=['lib/**'])

a = Analysis(
    ['SwiftSlate.pyw'],
    pathex=[str(root)],
    binaries=[],
    datas=[
        (str(root / 'commands.json'), '.'),
        (str(root / 'ui_bundle'), 'ui_bundle'),
    ] + webview_data,
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
    name='SwiftSlate',
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
    version=str(root / 'packaging' / 'version_info.txt'),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='SwiftSlate',
)
