# DroidSlate

A lightweight Android Debug Bridge (ADB) desktop tool for Windows — devices,
shell, logcat, file browsing, package management, and DeGoogle in a small
tray-resident app.

DroidSlate recreates the feature set of
[Nxzume/GUI-for-Android-Debug-Bridge-ADB-UI](https://github.com/Nxzume/GUI-for-Android-Debug-Bridge-ADB-UI)
on the SwiftSlate architecture: a Python backend, an authenticated
`127.0.0.1` dashboard server, a pywebview (`edgechromium`) host, and a
React 19 + TypeScript + Vite interface.

## Features

- **Devices** — automatic discovery (`adb devices -l`), connection status,
  model/manufacturer enrichment, one-click selection, full device info,
  screenshot capture (saved PNG + preview + open folder), and reboot to
  system/recovery/bootloader.
- **Apps** — full package management: install single or split APKs
  (streamed upload, never held in memory), uninstall with system-app
  fallback (`--user 0`), reinstall (`pm install-existing`), enable/disable,
  and instant search over the whole package list.
- **Files** — two-pane explorer (This PC ↔ Android device) with HTML5
  drag & drop between rows (drag a PC file onto the device pane to push,
  a device file onto the PC pane to pull), sortable Name/Size/Modified
  columns, quick paths (/sdcard, /data/local/tmp, /), Windows drive letters,
  native Win32 open/save dialogs for "Push file…" / "Save as…" (WebView2
  cannot expose real paths), and device-side new folder / rename / delete
  (top-level paths like `/` and `/sdcard` are protected).
- **DeGoogle** — Simple mode removes the safe catalog (optionally the risky
  login/sync services — never unsafe packages); Custom mode offers
  per-package checkboxes over the full catalog, unsafe ones behind an
  explicit warning. Action is `pm disable-user` or `pm uninstall --user 0`,
  runs as a single background job with progress, and every removal is
  recorded per device for one-click undo (`pm enable` /
  `pm install-existing` + enable).
- **WiFi (no cable)** — ADB over the network in three steps:
  **Get IP** (reads the phone's wlan0 address, with `ip route` fallback),
  **Enable TCP/IP** (`adb tcpip 5555` over USB), then unplug and
  **Connect** (`adb connect IP:5555`) — plus Disconnect when done.
  Strict IPv4/port validation server-side; same Wi-Fi network required.
- **Shell** — run any `adb shell` command with streaming output and
  command history (↑/↓). A leading `adb shell` is stripped automatically.
- **Logcat** — live `logcat` streaming with text filtering and follow mode.
- **Settings** — custom ADB location (bundled `adb.exe` by default) and
  dark/light theme.

Later phases add the remaining parity polish from the original tool.

## Architecture

```
DroidSlate.pyw        Win32 tray engine: singleton, icon, message loop,
                      on-demand dashboard server + WebView2 child process
dashboard_server.py   Loopback-only HTTP API: capability bootstrap →
                      HttpOnly session cookie, strict CSP, static UI serving
ui_host.py            Isolated pywebview (edgechromium) window; no js_api
adb_manager.py        ADB subprocess layer (argument lists only, CREATE_NO_WINDOW)
degoogle.py           DeGoogle catalogs (safe/risky/unsafe) + per-device undo state
win32_dialogs.py      Native open/save dialogs (WebView2 cannot expose paths)
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
