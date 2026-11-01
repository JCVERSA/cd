# Windows 0.3 prototype definition

## Purpose

The 0.3 prototype validates protected Windows selection capture plus an explicitly consented, credential-backed OpenAI-compatible request path. Automatic text replacement remains disabled.

## Included acceptance checks

| Check | Implementation |
|---|---|
| Native lightweight UI | Direct Win32 controls; no WebView or GUI framework |
| Global shortcut | `RegisterHotKey`, `Ctrl+Alt+Space` |
| Background input mechanism | Raw Input with `RIDEV_INPUTSINK` |
| Automatic selection capture | UI Automation `TextPattern` |
| Password rejection | Fail-closed `IsPassword` checks before and after capture |
| Accessibility-provider isolation | Dedicated multithreaded COM worker |
| Capture responsiveness | 1.5-second shell timeout; late results ignored |
| Capture limits | 8 ranges and 32,768 UTF-16 code units |
| Focus race protection | Foreground window and focused element revalidated |
| Unsupported-control behavior | Clearly labelled existing-clipboard fallback |
| Provider configuration | Endpoint/model in HKCU; strict portable validation |
| Secret storage | Host/port-scoped Generic Credential in Credential Manager |
| Transport policy | HTTPS remote; HTTP only for exact loopback hosts |
| Credential forwarding defense | WinHTTP redirects disabled |
| Network isolation | Dedicated provider worker; no window-thread network calls |
| Network limits | Finite timeouts, 32 KiB headers, 256 KiB body |
| Request disclosure | First-session consent tied to exact endpoint/model |
| Stale-response defense | Current source must exactly match submitted source |
| Provider output limit | 32,768 UTF-16 code units |
| Review flow | Original and read-only result shown separately |
| Replacement behavior | No automatic replacement; explicit copy only |
| Offline behavior | Deterministic local preview remains available |
| Automated validation | Linux core tests and Windows tests/clippy/release build |
| Artifact evidence | CI records EXE/ZIP size and SHA-256 |

## Manual Windows test plan

### Startup and shell

- [ ] Application starts without installing a runtime.
- [ ] Window uses normal Windows keyboard and tab navigation.
- [ ] Closing the title bar exits the process.
- [ ] Hiding the window leaves the process idle.
- [ ] Idle CPU remains effectively zero.

### Global shortcut and selection

For each supported application, select a short phrase and press `Ctrl+Alt+Space`:

- [ ] Notepad
- [ ] Chrome
- [ ] Edge
- [ ] Microsoft Word
- [ ] Outlook
- [ ] VS Code
- [ ] A native Win32 edit control
- [ ] An Electron application

Record whether capture used UI Automation, clipboard fallback, or failed safely.

### Protected fields and races

- [ ] A browser password field is rejected.
- [ ] A native Windows password edit is rejected.
- [ ] Existing clipboard text is not loaded after protected-field rejection.
- [ ] Moving focus during capture cancels the selection result.
- [ ] More than 8 ranges or 32,768 UTF-16 units are rejected.
- [ ] A stalled accessibility provider does not freeze the SwiftSlate window.

### Provider settings and secrets

- [ ] Saving endpoint/model persists them for the current user.
- [ ] The API-key edit clears after save.
- [ ] The registry contains endpoint/model but not the API key.
- [ ] Windows Credential Manager contains a Generic Credential scoped to host/port.
- [ ] Saving with a blank key preserves the existing credential.
- [ ] **Remove key** deletes that host's credential.
- [ ] Switching host or port does not reuse another host's key.
- [ ] Remote `http://` is rejected.
- [ ] `http://localhost`, `http://127.0.0.1`, and `http://[::1]` can be configured.
- [ ] Malformed endpoints, embedded credentials, fragments, and invalid ports are rejected.

### Consent and provider requests

- [ ] Capturing text never starts a request.
- [ ] The first **Improve with AI** action shows endpoint, model, and transmitted-data disclosure.
- [ ] **No** is the default consent choice and sends nothing.
- [ ] Consent avoids a repeat prompt only for the same endpoint/model during that process session.
- [ ] Changing endpoint or model requires new consent.
- [ ] A valid OpenAI-compatible provider returns reviewable text.
- [ ] A 3xx response is not followed.
- [ ] Non-JSON, missing-content, oversized, and non-2xx responses fail with bounded user-facing errors.
- [ ] A slow provider does not freeze or block window interaction.
- [ ] A result arriving after the 45-second UI limit is discarded.
- [ ] Editing **Original text** while a request runs causes the response to be discarded.
- [ ] Request text, response text, and API keys do not appear in application or CI logs.

### Review workflow

- [ ] Local preview clearly says no network request occurred.
- [ ] Provider output appears only in the read-only review field.
- [ ] No source application receives synthetic input.
- [ ] **Copy result** places only the reviewed result on the clipboard.
- [ ] Empty input and empty provider output are handled safely.

### Resource measurements

Record on ordinary Windows 10 and Windows 11 systems:

- [ ] Cold startup time
- [ ] Idle working set after 60 seconds
- [ ] Idle CPU over 60 seconds
- [ ] Working set during one provider request
- [ ] Release EXE size
- [ ] Compressed ZIP size

## Automated exit criteria

- All portable tests pass on Linux and Windows.
- Warnings-denied Clippy and formatting pass.
- The optimized Windows executable builds and is uploaded.
- CI records executable size, ZIP size, and SHA-256.

## Manual exit criteria

Selection capture must work in representative native, browser, Office, and Electron applications while password fields and focus races fail closed. At least one OpenAI-compatible HTTPS provider and one loopback provider must pass the settings, consent, response-bound, stale-source, and explicit-copy tests above.

Linux adapters follow Windows architecture validation. Automatic replacement remains a separate security phase.
