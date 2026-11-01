# SwiftSlate

SwiftSlate is a lightweight system-wide writing assistant. The active implementation is the Python/Win32 Windows application under [`desktop/`](desktop/).

Type inline commands such as `.fix`, `.shorten`, or `.bold` at the end of text in another Windows application. SwiftSlate detects them through Raw Input and replaces the text in place using its clipboard/`SendInput` pipeline.

## Windows application

The Windows build includes:

- the existing low-overhead Win32 tray and inline-command engine;
- a Nebula-inspired settings dashboard hosted on demand with Edge WebView2;
- provider/model/key management for OpenAI, Gemini, Groq, OpenRouter, Mistral, DeepSeek, NVIDIA NIM, Ollama, LM Studio, and custom endpoints;
- command CRUD, local style previews, playground, startup settings, and diagnostics;
- first-run onboarding and safe defaults when no configuration exists;
- current-user DPAPI protection for provider keys;
- PyInstaller one-directory packaging and a normal per-user Inno Setup installer.

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

GitHub Actions runs the cross-platform test suite and builds, installs, smoke-tests, uninstalls, hashes, and uploads the Windows installer. Linux application work follows the Windows-first delivery.

## License

MIT
