# SwiftSlate

SwiftSlate is a lightweight, system-wide writing assistant. This repository currently contains the **Windows 0.2 technical prototype**, not a production release.

## Prototype capabilities

- Native Win32 interface: no browser, WebView, Electron, or GUI runtime.
- Global `Ctrl+Alt+Space` shortcut registered through `RegisterHotKey`.
- Background keyboard-event detection through Windows Raw Input and `RIDEV_INPUTSINK`.
- Automatic selection capture through Windows UI Automation `TextPattern`.
- Password and protected-field rejection through UI Automation `IsPassword`.
- Dedicated COM worker and a 1.5-second UI timeout so a slow accessibility provider cannot freeze the window.
- Focus revalidation before captured text is accepted.
- Existing-clipboard fallback when a control does not support UI Automation selection.
- Privacy-bounded detector core that retains at most the longest configured trigger.
- Review-before-copy workflow with an explicitly labelled offline transformation.
- Windows release artifact built by GitHub Actions.

## What is deliberately not implemented yet

- AI/network requests
- API-key storage
- Automatic text replacement
- Synthetic `Ctrl+C` fallback
- System tray and launch-at-login
- Inline trigger translation from Windows keyboard layouts
- Linux platform adapters

Keeping these out of the current executable lets us validate protected selection capture and compatibility before adding network or replacement risk.

## Try the Windows prototype

1. Download the `swiftslate-windows-x64` artifact from the latest successful **CI** workflow.
2. Extract the ZIP and run `swiftslate.exe`.
3. Select text in another application.
4. Press `Ctrl+Alt+Space`.
5. Confirm that SwiftSlate displays the selected text.
6. Select **Improve (local preview)**.
7. Review the deterministic local result and optionally copy it.
8. Use **Hide** to leave SwiftSlate listening in the background. Close the title-bar window to exit.

When a control does not expose a UI Automation selection, SwiftSlate loads the existing plain-text clipboard and labels it as a fallback. Password fields never use that fallback. The prototype makes no network requests and does not persist text.

## Development

The portable library has no third-party dependencies. The Windows executable has one target-specific dependency on Microsoft's `windows` crate.

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
