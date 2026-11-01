# SwiftSlate

SwiftSlate is a lightweight, system-wide writing assistant. This repository currently contains the **Windows 0.3 technical prototype**, not a production release.

## Prototype capabilities

- Native Win32 interface: no browser, WebView, Electron, or GUI runtime.
- Global `Ctrl+Alt+Space` shortcut registered through `RegisterHotKey`.
- Automatic selection capture through Windows UI Automation `TextPattern` on a dedicated COM worker.
- Fail-closed password checks, focus revalidation, bounded capture, and an existing-clipboard fallback only for unsupported non-protected controls.
- Configurable OpenAI-compatible chat-completions endpoint and model.
- Nonsecret provider settings in the current user's registry; host-scoped API keys in Windows Credential Manager.
- HTTPS required for remote endpoints. Plain HTTP is accepted only for exact loopback hosts (`localhost`, `127.0.0.1`, and `::1`).
- Blocking WinHTTP work isolated from the window thread, with redirects disabled and time, header, response, and output limits.
- Explicit consent before the first request to an endpoint/model pair in each session.
- Source-text revalidation before an asynchronous response is displayed.
- Review-before-copy workflow; results are never inserted into another application automatically.
- Deterministic local preview remains available without a network request.
- Windows release artifact built and measured by GitHub Actions.

## What is deliberately not implemented yet

- Automatic text replacement or synthetic `Ctrl+C`
- Text history, analytics, or telemetry
- System tray and launch-at-login
- Inline trigger translation from Windows keyboard layouts
- Linux platform adapters and Secret Service storage

Keeping automatic replacement out of this executable preserves an explicit review boundary while provider compatibility and Windows behavior are validated.

## Try the Windows prototype

1. Download the `swiftslate-windows-x64` artifact from the latest successful **CI** workflow.
2. Extract the ZIP and run `swiftslate.exe`.
3. Enter an OpenAI-compatible chat-completions endpoint, model, and API key, then choose **Save**. The key field clears after Credential Manager accepts it.
4. Select text in another application and press `Ctrl+Alt+Space`.
5. Confirm that SwiftSlate displays the intended text.
6. Choose **Improve with AI**, review the disclosure, and explicitly consent. Consent is session-only and tied to the exact endpoint/model configuration.
7. Review the result and optionally choose **Copy result**. SwiftSlate never replaces source text automatically.
8. Use **Local preview** for an offline deterministic transform, or **Hide** to leave SwiftSlate listening in the background. Close the title-bar window to exit.

When a control does not expose a UI Automation selection, SwiftSlate loads the existing plain-text clipboard and clearly labels the fallback. Password fields never use that fallback. Selected text is sent only after the AI action and consent; it is not written to logs or history.

## Provider compatibility

SwiftSlate sends a JSON `POST` compatible with OpenAI's chat-completions shape:

- `model`
- one fixed system editing instruction
- one user message containing the current **Original text**
- `stream: false`

It reads `choices[0].message.content`. A custom provider must support that request and response shape. Authorization uses `Bearer <API key>` for the endpoint host and port.

## Development

The portable core uses `serde_json` for robust request/response handling. The Windows executable additionally uses Microsoft's `windows` crate and direct operating-system APIs; there is no async runtime or general HTTP framework.

```bash
cargo fmt --check
cargo test --locked --all-targets
cargo clippy --locked --all-targets -- -D warnings
cargo build --locked --release
```

The current Arena workspace does not include Rust or Windows tools, so authoritative builds run on GitHub-hosted Windows and Linux runners.

## Architecture

See:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PROTOTYPE.md`](docs/PROTOTYPE.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)

## License

MIT
