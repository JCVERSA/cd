# SwiftSlate

SwiftSlate is a lightweight, system-wide writing assistant. This repository currently contains the first **Windows technical prototype**, not a production release.

## Prototype capabilities

- Native Win32 interface: no browser, WebView, Electron, or GUI runtime.
- Global `Ctrl+Alt+Space` shortcut registered through `RegisterHotKey`.
- Background keyboard-event detection through Windows Raw Input and `RIDEV_INPUTSINK`.
- Privacy-bounded detector core that retains at most the longest configured trigger.
- Review-before-copy workflow with an explicitly labelled offline transformation.
- Focus/source replacement guards for future asynchronous AI responses.
- Windows release artifact built by GitHub Actions.

## What is deliberately not implemented yet

- AI/network requests
- API-key storage
- Automatic selection capture
- Automatic text replacement
- UI Automation password-field checks
- System tray and launch-at-login
- Inline trigger translation from Windows keyboard layouts
- Linux platform adapters

Keeping these out of the first executable lets us validate native size, startup, hotkey behavior, and Raw Input before adding security-sensitive capabilities.

## Try the Windows prototype

1. Download the `swiftslate-windows-x64` artifact from the latest successful **CI** workflow.
2. Extract the ZIP and run `swiftslate.exe`.
3. Copy some plain text in any application.
4. Press `Ctrl+Alt+Space`.
5. Select **Improve (local preview)**.
6. Review the deterministic local result and optionally copy it.
7. Use **Hide** to leave SwiftSlate listening in the background. Close the title-bar window to exit.

The prototype makes no network requests and does not persist text. Raw Input increments an event counter only; it does not retain the observed keys.

## Development

The portable library has no third-party dependencies. The Windows executable has one target-specific dependency on Microsoft's `windows` crate.

```bash
cargo fmt --check
cargo test --all-targets
cargo clippy --all-targets -- -D warnings
cargo build --release
```

The current Arena workspace does not include Rust or Windows tools, so authoritative builds run on GitHub-hosted Windows and Linux runners.

## Architecture

See:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PROTOTYPE.md`](docs/PROTOTYPE.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)

## License

MIT
