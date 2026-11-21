# DroidSlate

A lightweight Android Debug Bridge (ADB) desktop tool for Windows — devices,
shell, logcat, and settings in a small tray-resident app.

DroidSlate recreates the feature set of
[Nxzume/GUI-for-Android-Debug-Bridge-ADB-UI](https://github.com/Nxzume/GUI-for-Android-Debug-Bridge-ADB-UI)
on the SwiftSlate architecture: a Python backend, an authenticated
`127.0.0.1` dashboard server, a pywebview (`edgechromium`) host, and a
React 19 + TypeScript + Vite interface.

## Features (Phase 1)

- **Devices** — automatic discovery (`adb devices -l`), connection status,
  model/manufacturer enrichment, one-click selection, full device info.
- **Shell** — run any `adb shell` command with streaming output and
  command history (↑/↓). A leading `adb shell` is stripped automatically.
- **Logcat** — live `logcat` streaming with text filtering and follow mode.
- **Settings** — custom ADB location (bundled `adb.exe` by default) and
  dark/light theme.

Later phases add apps management, screenshots/reboot, the two-pane file
explorer, and DeGoogle.

## Architecture

```
DroidSlate.pyw        Win32 tray engine: singleton, icon, message loop,
                      on-demand dashboard server + WebView2 child process
dashboard_server.py   Loopback-only HTTP API: capability bootstrap →
                      HttpOnly session cookie, strict CSP, static UI serving
ui_host.py            Isolated pywebview (edgechromium) window; no js_api
adb_manager.py        ADB subprocess layer (argument lists only, CREATE_NO_WINDOW)
ui/                   React 19 + TypeScript source (Vite)
ui_bundle/            Production bundle served by the dashboard server
packaging/            Inno Setup installer, icon, version info
tests/                Python unittest suite
```

Security model (inherited from SwiftSlate): the server binds to
`127.0.0.1:0` (ephemeral port), every API request must carry a
`SameSite=Strict` HttpOnly session cookie obtained by a one-time
capability exchange, request context is validated via `Host`, `Origin`
and `Sec-Fetch-*` headers, and the UI never spawns processes itself.

## Development

```bash
# Python tests
cd droidslate && python -m unittest discover -s tests -v

# Interface
cd droidslate/ui
npm ci
npm run typecheck && npm test && npm run build   # bundle → ../ui_bundle
npm run dev                                      # preview against a live backend
```

## Build (Windows)

```powershell
# 1. Optional: bundle adb (CI downloads platform-tools automatically)
#    Place adb.exe, AdbWinApi.dll, AdbWinUsbApi.dll in droidslate\adb-bin\

# 2. Interface
cd droidslate\ui && npm ci && npm run build

# 3. Packaged app (one-directory)
cd droidslate
python -m pip install --require-hashes -r requirements-build-lock.txt
python -m PyInstaller --clean --noconfirm --distpath build --workpath .pyinstaller DroidSlate.spec
.\build\DroidSlate\DroidSlate.exe --self-test

# 4. Installer (requires Inno Setup 7.1.1)
iscc packaging\DroidSlate.iss   # → release\DroidSlate-Setup-x64.exe
```

GitHub Actions (`.github/workflows/ci.yml`) runs the full matrix: Python +
interface tests on Ubuntu, and on Windows the packaged self-test, a
signature-verified platform-tools download, the installer build, and a
silent install/self-test/uninstall cycle.
