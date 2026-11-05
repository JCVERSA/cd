# SwiftSlate for Windows

SwiftSlate is a lightweight system-wide writing assistant for Windows 10/11 x64. Type an inline command such as `.fix` at the end of text in another application and SwiftSlate replaces that text in place.

The background runtime remains the original Python/Win32 engine: Raw Input for keyboard detection, clipboard and `SendInput` replacement, local commands and styles, DPAPI credential protection, hot reload, and a tray icon. The settings interface is a bundled React application hosted on demand in Microsoft Edge WebView2. Closing or minimizing Settings removes it from the taskbar and destroys the WebView process while the small background engine stays running. A single click on the tray icon opens it again.

## Install

Use **`SwiftSlate-Setup-x64.exe`**. It installs **`SwiftSlate.exe`** per user under `%LOCALAPPDATA%\Programs\SwiftSlate`, creates normal Start menu/uninstall entries, and supports in-place upgrades without administrator access.

The installer contains the Python runtime and interface assets. It does **not** install Node.js or Electron. If Microsoft Edge WebView2 is missing, Setup runs Microsoft's Evergreen bootstrapper conditionally.

On first launch SwiftSlate creates its configuration under `%LOCALAPPDATA%\SwiftSlate`, starts the tray engine, and opens guided setup. A missing configuration no longer causes a silent exit. Uninstall preserves that user-data directory for reinstall continuity; delete it manually when a complete settings and credential-blob purge is required.

## Interface

Double-click the tray icon or choose **Open SwiftSlate** to access:

- runtime status, recent activity, pause/resume, and first-run onboarding;
- OpenAI, Gemini, Groq, OpenRouter, Mistral, DeepSeek, NVIDIA NIM, Ollama, LM Studio, and custom OpenAI-compatible endpoints;
- protected provider keys, live model discovery, and provider connection tests;
- command creation, editing, enable/disable, and deletion;
- offline style previews and a provider-backed playground;
- startup, command prefix, replacement timing, animation, and theme settings;
- runtime diagnostics and local logs.

Provider keys are encrypted with current-user Windows DPAPI. Decrypted values remain in the Python process and are never returned to the interface.

## Commands

AI commands included by default:

- `.fix`, `.improve`, `.shorten`, `.expand`
- `.formal`, `.casual`, `.emoji`, `.human`, `.reply`
- `.translate:XX`

Offline local styles:

| Command | Result |
| --- | --- |
| `.bold` | Unicode bold characters |
| `.italic` | Unicode italic characters |
| `.mono` | Unicode monospace characters |
| `.bubble` | Circled characters |
| `.gothic` | Fraktur characters |
| `.smallcaps` | Small-cap characters |
| `.normal` | Convert supported styles back to ordinary text |

Local styles never use the network. Accents, emoji, Arabic, CJK, Thai, and unsupported characters are preserved rather than removed. The tray's **Style selected text** submenu can apply these transformations to an existing selection.

## Privacy and security

- No analytics, telemetry, or automatic diagnostic uploads.
- Text reaches the selected provider only when an AI command is invoked.
- Temporary clipboard content is marked to avoid clipboard history/cloud sync where Windows supports it.
- The dashboard binds to `127.0.0.1` on a random port, exchanges a one-time URL-fragment capability for an API-scoped `HttpOnly` session cookie, and rotates that session on every settings launch.
- API requests require the exact loopback host and same-origin Fetch Metadata; mutations also require the exact loopback origin, and no CORS access is allowed.
- Requests are size/time bounded and schema-validated, and static assets use a restrictive Content Security Policy.
- Remote custom endpoints require HTTPS; plain HTTP is accepted only on loopback.
- The pywebview host receives no privileged JavaScript bridge.

See [AUDIT-2026-11-05.md](AUDIT-2026-11-05.md) for the full security, privacy, packaging, accessibility, and residual-risk review.

## Build from source

Requirements on Windows x64:

- Python 3.13
- Node.js 22
- Inno Setup 7.1.1 or newer (required for the branded dynamic light/dark wizard; CI is pinned to 7.1.1)

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1
```

The build script:

1. runs Python tests;
2. installs and validates the React interface;
3. builds static assets into `ui_bundle`;
4. installs the Windows Python build graph from a SHA-256-locked requirements file;
5. creates a PyInstaller one-directory application;
6. runs the packaged `SwiftSlate.exe --self-test` smoke test;
7. validates Microsoft's signature on the WebView2 bootstrapper;
8. emits `release\SwiftSlate-Setup-x64.exe` and its SHA-256 file.

The GitHub Actions Windows job additionally installs the generated package into a clean temporary directory, runs the installed self-test, uninstalls it, and uploads the installer artifact.

## Development

Run Python tests from `desktop`:

```powershell
python -m unittest discover -s tests -v
```

Run the interface locally:

```powershell
cd ui
npm ci
npm run dev
```

Validate all interface checks:

```powershell
npm run typecheck
npm test
npm audit --audit-level=moderate
npm run build
```

Important files:

- `SwiftSlate.pyw` — Win32 engine, tray behavior, provider execution, and dashboard lifecycle
- `dashboard_server.py` — authenticated local API and configuration/command operations
- `provider_catalog.py` — provider metadata, endpoint validation, model discovery, and tests
- `secure_config.py` — current-user DPAPI storage
- `ui/` — React/Vite/TypeScript source
- `ui_bundle/` — production interface assets bundled with the app
- `ui_host.py` — on-demand Edge WebView2 host
- `SwiftSlate.spec` — PyInstaller one-directory build
- `ui/src/assets/swiftslate-logo.png` — canonical full-colour desktop brand source
- `packaging/SwiftSlate.ico` and `packaging/wizard/` — multi-resolution Windows icon and dynamic installer art
- `packaging/SwiftSlate.iss` — branded per-user Inno Setup installer
- `tests/` — Python and security regression tests
