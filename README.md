# SwiftSlate

SwiftSlate 1.0 is a lightweight, system-wide AI writing assistant for Windows and Linux. It keeps capture, provider access, and review explicit: text is never sent merely because it was selected, and provider output is never pasted automatically.

## Platforms

### Windows

The Windows application is a native Win32 executable with no browser, WebView, Electron, GUI runtime, or async runtime.

- Global `Ctrl+Alt+Space` shortcut.
- Protected selection capture through UI Automation on a dedicated COM worker.
- Fail-closed password checks, focus revalidation, and bounded capture.
- Existing-clipboard fallback only for unsupported, non-protected controls.
- Native provider settings, session consent, asynchronous WinHTTP requests, review, and explicit copy.
- Endpoint/model in `HKCU\Software\SwiftSlate`.
- Host/port-scoped API keys in Windows Credential Manager.

### Linux

Linux ships as a small command-line application designed to work with desktop shortcut managers and shell pipelines. This is deliberate: Wayland does not provide a universal system-wide selected-text or global-hotkey portal.

- OpenAI-compatible provider requests with native TLS and bounded responses.
- Endpoint/model in `$XDG_CONFIG_HOME/swiftslate/provider.json` or `~/.config/swiftslate/provider.json`.
- Host/port-scoped API keys in Secret Service through `secret-tool`; keys never enter arguments, environment variables, or config files.
- X11 PRIMARY selection through `xclip` or `xsel`.
- Wayland primary selection through `wl-paste` when the compositor supports it.
- Required `--consent` flag for every CLI process that transmits text.
- Output goes to stdout for review and is never pasted automatically.

`improve` through stdin works on every Linux session, including compositors that intentionally block global selection capture.

## Security properties

- Remote endpoints require HTTPS.
- Plain HTTP is allowed only for exact loopback hosts (`localhost`, `127.0.0.1`, and `::1`); local mode bypasses proxies and canonicalizes `localhost` to `127.0.0.1` for transport.
- Embedded endpoint credentials, fragments, malformed authorities, invalid ports, controls, and whitespace are rejected.
- HTTP redirects are disabled to prevent bearer-token forwarding.
- Network operations have a 45-second total budget and bounded per-operation timeouts.
- Response headers are limited to 32 KiB, response bodies to 256 KiB, and output to 32,768 UTF-16 code units.
- Request text, response text, keystrokes, and API keys are not logged or persisted.
- Provider errors are sanitized and bounded before display.
- Automatic source-text replacement is intentionally disabled. Windows requires **Copy result**; Linux prints reviewable output.

See [`docs/SECURITY.md`](docs/SECURITY.md) for the complete threat model and residual risks.

## Windows usage

1. Download and extract `swiftslate-windows-x64.zip` from the latest successful CI run.
2. Run `swiftslate.exe`.
3. Enter an OpenAI-compatible chat-completions endpoint, model, and API key, then choose **Save**.
4. Select text in another application and press `Ctrl+Alt+Space`.
5. Verify **Original text**, choose **Improve with AI**, and accept the endpoint/model disclosure.
6. Review the response and explicitly choose **Copy result**.
7. Use **Local preview** for an offline deterministic transform.

The key field clears after Credential Manager accepts it. **Remove key** deletes the credential for the current host and port.

## Linux usage

Runtime packages vary by distribution. Install Secret Service's command-line client (`secret-tool`, commonly in `libsecret-tools`). Selection commands additionally need `wl-clipboard` on Wayland or `xclip`/`xsel` on X11.

```bash
# Save nonsecret settings.
swiftslate configure \
  --endpoint https://api.openai.com/v1/chat/completions \
  --model gpt-4o-mini

# Save a key through a pipe; for example, from an existing password manager.
pass show services/openai | swiftslate set-key --stdin

# Improve stdin. --consent is mandatory and scoped to this invocation.
printf '%s' 'Text to improve.' | swiftslate improve --consent

# Capture the desktop primary selection without sending it.
swiftslate capture-selection

# Capture and improve; output remains on stdout for review.
swiftslate improve-selection --consent

# Inspect configuration and capability status without printing the key.
swiftslate doctor

# Delete the host-scoped key.
swiftslate remove-key
```

For a global Linux shortcut, bind `swiftslate capture-selection` or a terminal command invoking `swiftslate improve-selection --consent` in the desktop environment's own shortcut settings. SwiftSlate does not bypass compositor security policy.

## Provider compatibility

SwiftSlate sends a JSON `POST` compatible with OpenAI's chat-completions shape:

- configured `model`;
- one fixed system editing instruction;
- one user message containing only the reviewed input;
- `stream: false`.

It reads `choices[0].message.content` and sends `Authorization: Bearer <API key>`.

## Development and automated validation

```bash
cargo fmt --check
cargo test --locked --all-targets
cargo clippy --locked --all-targets -- -D warnings
cargo build --locked --release
```

CI performs Linux and Windows tests, warnings-denied Clippy, formatting, release builds, loopback transport tests, package measurement, hashing, and artifact upload. This repository intentionally avoids intermediate public builds; the downloadable artifacts are produced from the consolidated 1.0 branch state.

Additional design documents:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PROTOTYPE.md`](docs/PROTOTYPE.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)

## License

MIT
