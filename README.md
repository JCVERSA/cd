# SwiftSlate

SwiftSlate is a lightweight system-wide writing assistant. The active implementation is the Python/Win32 Windows application under [`desktop/`](desktop/).

Type inline commands such as `.fix`, `.shorten`, or `.bold` at the end of text in another Windows application. SwiftSlate detects them through Raw Input and replaces the text in place using its clipboard/`SendInput` pipeline.

## Windows application

The Windows build includes:

- a low-overhead Win32 tray and system-wide inline-command engine (`SwiftSlate.pyw`);
- a Nebula-inspired settings dashboard hosted on demand in an isolated Edge WebView2 child process (`ui_host.py`);
- provider/model/key management with model fetching and live connection testing across 16 providers: OpenAI, Google Gemini, Groq, Cerebras, SambaNova, OpenRouter, Cohere, Hugging Face, Mistral, DeepSeek, NVIDIA NIM, xAI (Grok), Alibaba Qwen, Ollama, LM Studio, and Custom OpenAI-compatible endpoints;
- command CRUD, offline Unicode text styles, interactive Playground, startup settings, live activity telemetry, and runtime diagnostics;
- first-run onboarding and safe defaults when no configuration exists;
- current-user Windows DPAPI (`CryptProtectData`) encryption for provider keys;
- PyInstaller one-directory packaging and a per-user Inno Setup installer.

The distributed files are **`SwiftSlate-Setup-x64.exe`** and the installed **`SwiftSlate.exe`**. Python and all static interface assets are bundled. Node.js and Electron are not installed or shipped.

See [`desktop/README.md`](desktop/README.md) for installation, architecture, privacy, commands, development, and build instructions.

## Build and test

On any development machine:

```bash
cd desktop
python -m unittest discover -s tests -v
cd ui
npm ci
npm run typecheck
npm test
npm audit --audit-level=moderate
npm run build
```

On Windows x64 with Python 3.13, Node.js 22, and Inno Setup:

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\build_windows.ps1
```

GitHub Actions runs the cross-platform test suite, PowerShell script validation, and builds, installs, smoke-tests, uninstalls, hashes, and uploads the Windows x64 installer. Linux application work follows the Windows-first delivery.

## License

MIT
