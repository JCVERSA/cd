# Security and privacy baseline

SwiftSlate interacts with text from arbitrary applications and can transmit selected text to a user-configured provider. The default must therefore be less collection, less persistence, explicit disclosure, and fail-closed behavior.

## Windows 0.3 guarantees

### Selection and input

- No text history, analytics, or telemetry are written.
- Raw Input records only an in-memory key-down event count in the native shell.
- UI Automation selection capture runs on a dedicated COM worker.
- Password status is checked before and after capture; an unavailable status fails closed.
- Foreground window and focused-element identity are revalidated before text is accepted.
- Capture is limited to 8 ranges and 32,768 UTF-16 code units.
- The shell times out after 1.5 seconds and ignores late accessibility responses.
- Protected fields never use the clipboard fallback.
- The portable trigger detector retains at most the longest trigger and excludes SwiftSlate-origin events.

### Provider requests

- No request occurs merely because text was captured; the user must choose **Improve with AI**.
- Before the first request for an endpoint/model pair in a session, a modal disclosure identifies the exact endpoint and model, explains what is sent, and defaults to **No**.
- Consent is held only in memory and is not transferable to a changed endpoint or model.
- Only one fixed editing instruction and the current **Original text** are included in the request.
- Request bodies, response bodies, selected text, and API keys are not logged.
- Provider output is shown only if the source text is unchanged when the response arrives.
- The shell discards results after its 45-second wait limit and ignores stale or late results.
- The review result is never pasted or applied automatically.

### Endpoint and transport policy

- Remote endpoints must use HTTPS.
- Plain HTTP is accepted only for exact loopback hosts: `localhost`, `127.0.0.1`, and `::1`; this mode bypasses proxies, and `localhost` connects through `127.0.0.1`.
- Embedded endpoint credentials, fragments, malformed authorities, invalid ports, controls, and whitespace are rejected.
- WinHTTP redirects are disabled, preventing authorization forwarding through HTTP redirection.
- DNS, connect, send, and receive calls have finite timeouts.
- Response headers are limited to 32 KiB and the downloaded body to 256 KiB.
- Parsed provider output is limited to 32,768 UTF-16 code units.
- Provider error text is stripped of controls and capped before display.

### Secrets and settings

- API keys are stored as Generic Credentials in Windows Credential Manager, scoped to canonical provider host and port.
- API keys never enter the registry, command-line arguments, environment variables, or application logs.
- Secret buffers copied by SwiftSlate are overwritten when practical after use.
- The password-style API-key control is cleared after a successful save.
- Endpoint and model are nonsecret and stored under `HKCU\Software\SwiftSlate`.
- **Remove key** explicitly deletes the credential for the current provider host.

## Residual risks and prototype limits

- A provider receives the disclosed text and may retain it under its own policy. SwiftSlate cannot enforce third-party retention.
- Windows Credential Manager protects a key at the current-user boundary; code running as that user may be able to request it.
- The worker uses bounded synchronous WinHTTP operations. The UI discards a result after 45 seconds, while the worker remains busy until the current bounded operation returns.
- Clipboard fallback reads pre-existing plain text only for unsupported, non-protected controls. The user must verify that it is the intended selection.
- The current prototype supports manual copy only. Clipboard contents then have normal operating-system clipboard exposure.
- There is no certificate pinning; HTTPS relies on Windows trust and WinHTTP validation.
- Manual compatibility and privacy testing on representative Windows applications is still required before a production claim.

## Future replacement requirements

Automatic replacement is out of scope for 0.3. Before any future implementation applies a result, it must revalidate:

1. foreground process and window;
2. focused control identity;
3. selected/source text;
4. target integrity level;
5. released physical modifier keys;
6. that the reviewed result still belongs to the accepted request.

Any mismatch must cancel replacement and leave the reviewed result available for manual copy.

## Linux requirements

The Linux phase must use Secret Service rather than plaintext key files, preserve the portable endpoint and consent policy, document X11/Wayland capability tiers, and fail closed where compositor security prevents reliable selection or replacement.

## Reporting

Do not include sensitive text or API keys in a public issue. Until a private security channel is published, report only that a security issue exists and request a private contact route from the maintainers.
