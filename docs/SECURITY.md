# SwiftSlate 1.2 security and privacy baseline

SwiftSlate handles text from arbitrary applications and may transmit user-reviewed text to a configured provider. Its security model is explicit action, minimal persistence, bounded processing, and refusal to bypass platform protections.

## Data handling guarantees

- No text history, prompt history, model-output history, analytics, or telemetry.
- Request text, response text, keystrokes, and API keys are not logged.
- Shortcut capture or display alone never starts a request. A verified physical inline command is an explicit activation, but still cannot send before endpoint/model session consent.
- Only one bounded built-in instruction for the visible command and the reviewed input are sent.
- Provider output is never pasted or applied automatically.
- **Fetch models** and **Test provider** are explicit user actions. They transmit no user text; they send only a bounded `GET` and the saved host-scoped credential when required.
- Fetched model catalogs are bounded, sanitized, session-only, and not persisted unless the user selects a model and chooses **Save**.
- Sensitive in-process buffers are overwritten when practical.

## Windows capture

- UI Automation runs on a dedicated multithreaded COM worker.
- `IsPassword` is checked before and after capture; unavailable protection state fails closed.
- Foreground window and focused-element identity are revalidated.
- Capture is limited to eight ranges and 32,768 UTF-16 code units.
- The shell stops waiting after 1.5 seconds and rejects late results.
- Protected fields never use the clipboard fallback.
- Raw Input is registered as a background keyboard sink, but retains only the bounded suffix needed to recognize built-in triggers. It rejects injected-origin messages, resets at foreground/control boundaries, and uses the foreground keyboard layout.
- A matched trigger is not trusted by itself: UI Automation must revalidate a non-password focused element, stable foreground/focus identity, bounded whole-field text, and the exact trailing trigger.
- Inline capture never uses clipboard fallback and never synthesizes deletion, paste, or replacement input.

## Linux capture

Linux does not claim a universal protected-field API:

- Stdin is always explicit.
- X11 capture reads only the PRIMARY selection.
- Wayland capture asks `wl-paste` only for the primary selection; it does not silently fall back to an unrelated clipboard.
- Restricted Wayland sessions fail closed and require stdin.
- SwiftSlate never synthesizes `Ctrl+C`, paste, or replacement input.
- Desktop shortcut registration remains under the compositor or desktop environment's policy.

Users should not invoke selection commands on sensitive fields. Password widgets normally refuse selection export, but Linux desktop protocols do not provide Windows-equivalent `IsPassword` metadata.

## Consent

### Windows

Before the first request to an endpoint/model pair in a process session, a modal disclosure shows the exact endpoint and model, states what is sent, explains review-only behavior, and defaults to **No**. Changing endpoint or model requires consent again.

### Linux

Every process that sends text requires the literal `--consent` argument. Immediately before transport, SwiftSlate writes the endpoint, model, and review-only disclosure to stderr. Capture-only and diagnostic commands never send text.

There is no silent provider fallback on either platform.

## Endpoint and transport policy

- Remote endpoints must use HTTPS.
- Plain HTTP is accepted only for exact `localhost`, `127.0.0.1`, or `::1` loopback hosts.
- Loopback mode bypasses proxies; `localhost` is transported as `127.0.0.1`.
- Embedded credentials, fragments, malformed authorities, invalid ports, whitespace, and controls are rejected.
- Redirect following is disabled, preventing bearer authorization from being forwarded.
- Network work has a 45-second global budget and finite per-operation timeouts.
- Response headers are limited to 32 KiB.
- Response bodies are limited to 256 KiB.
- Parsed model output is limited to 32,768 UTF-16 code units.
- Provider error text is stripped of controls and capped before display.
- TLS certificate verification uses Windows trust through WinHTTP or Linux native TLS/platform roots.

Real loopback socket tests run in CI on both platforms to verify POST behavior and redirect refusal. Windows additionally tests bounded model-catalog GET behavior and body-limit enforcement.

## Secret storage

### Windows

- API keys are Generic Credentials in Windows Credential Manager.
- Credential names are scoped to canonical provider host and port.
- Keys never enter the registry, command line, environment, or logs.
- The password-style edit clears after a successful save.
- **Remove key** explicitly deletes the current host's credential.
- Exact-loopback Ollama/LM Studio requests may omit authorization; if a loopback key is configured, it is still read from Credential Manager and sent as a bearer token.

### Linux

- API keys are stored in desktop Secret Service through `secret-tool`.
- Secret bytes travel to and from the helper through pipes.
- Keys never enter argv, environment variables, or provider configuration.
- `set-key` accepts a bounded key through stdin and rejects embedded controls.
- `remove-key` deletes the current host's Secret Service item.
- If Secret Service is absent or locked, SwiftSlate fails instead of creating a plaintext fallback.

Nonsecret Linux settings use a mode-`0700` directory and mode-`0600` JSON file. Windows nonsecret settings use `HKCU\Software\SwiftSlate`.

## Stale-result protection

Windows accepts a worker response only when its request ID is current and **Original text** exactly matches the submitted source. UI timeout, a new capture, local preview, or source editing invalidates the pending response. Linux processes one explicit input per invocation and returns output only to stdout.

## Residual risks

- Providers receive disclosed text and may retain it under their own policies.
- Code running as the same user may be able to ask the operating-system credential service for a key.
- Linux depends on the security of installed `secret-tool`, selection helpers, native TLS, and desktop services.
- Clipboard fallback and manual copy have normal operating-system clipboard exposure.
- Some applications expose incomplete or nonstandard UI Automation text. Inline commands fail closed there and remain visible in the source field.
- Raw Input sees physical keyboard events system-wide while SwiftSlate runs; the detector intentionally retains only a short in-memory suffix and does not persist or log it.
- There is no certificate pinning; platform trust stores determine certificate acceptance.
- Unsigned portable artifacts may trigger operating-system reputation warnings.
- The project cannot perform interactive compatibility checks on every application or compositor in CI; unsupported environments fail to explicit stdin/manual-copy paths.

## Reporting

Never include selected text, model output, or API keys in a public issue. Until a private security channel is published, report only that a security issue exists and request a private contact route from the maintainers.
