# SwiftSlate architecture

## Goals

1. Remain idle with effectively zero CPU consumption.
2. Keep the Windows download, installed footprint, startup time, and UI overhead small.
3. Never persist typed text, selections, prompts, or model output by default.
4. Reject protected fields before reading or transforming text.
5. Keep Windows and future Linux integration behind platform boundaries.
6. Keep blocking accessibility and network work away from the window thread.
7. Show every provider result for explicit review rather than replacing source text.

## Current modules

```text
src/
├── lib.rs                 portable, safe Rust module boundary
├── trigger.rs             bounded suffix detector
├── replacement.rs         stale-result replacement guards
├── selection.rs           accessibility selection limits and assembly
├── preview.rs             deterministic offline transform
├── provider.rs            endpoint policy and OpenAI-compatible JSON
├── main.rs                platform entry point
├── windows_app.rs         native Win32 shell, settings, consent, review
├── windows_selection.rs   dedicated UI Automation capture worker
├── windows_provider.rs    dedicated bounded WinHTTP worker
├── windows_config.rs      HKCU nonsecret provider settings
└── windows_secrets.rs     Windows Credential Manager API-key adapter
```

The portable library forbids unsafe Rust. Unsafe operating-system calls stay in Windows adapter modules. No browser engine, GUI framework, async runtime, or general HTTP client is included.

## Runtime boundaries

```text
┌───────────────────────────────────────────────────────────┐
│ Native Win32 window thread                                │
│ palette · provider settings · consent · review · copy     │
├───────────────────────────────────────────────────────────┤
│ Dedicated workers                                         │
│ MTA UI Automation capture │ synchronous bounded WinHTTP   │
├───────────────────────────────────────────────────────────┤
│ Portable safe core                                        │
│ trigger · selection bounds · endpoint policy · JSON       │
├──────────────────────────┬────────────────────────────────┤
│ Windows adapters         │ Future Linux adapters          │
│ Raw Input / UIA          │ X11 / Wayland capability tiers │
│ HKCU / Credential Mgr    │ config / Secret Service        │
│ WinHTTP                  │ minimal HTTP adapter            │
└──────────────────────────┴────────────────────────────────┘
```

Worker results return through channels and private `WM_APP` messages. The window never waits synchronously for a UI Automation provider or HTTP server.

## Windows input and selection

- `RegisterHotKey` handles the global `Ctrl+Alt+Space` command.
- Raw Input with `RIDEV_INPUTSINK` proves background input visibility without a low-level hook; the shell counts key-down events but never stores key content.
- The portable inline detector stores no more characters than the longest configured trigger.
- SwiftSlate-generated input is tagged and excluded by the portable detector design.

Selection capture runs in a multithreaded COM apartment:

1. Preserve the foreground target before opening SwiftSlate.
2. Query the focused UI Automation element.
3. Fail closed if `IsPassword` is true or unavailable.
4. Probe the focused element and a bounded number of ancestors for `TextPattern`.
5. Limit captures to 8 ranges and 32,768 UTF-16 code units.
6. Recheck foreground window, focused-element identity, and password status.
7. Deliver text only if all checks still pass.

The shell stops waiting after 1.5 seconds and ignores late capture results. Unsupported controls may load the existing clipboard as a clearly labelled fallback; protected controls never do.

## Provider request path

Provider settings consist of an endpoint and model. `provider.rs` validates and parses the endpoint without a heavyweight URL or HTTP dependency:

- remote endpoints require `https://`;
- `http://` is limited to exact `localhost`, `127.0.0.1`, or `[::1]` hosts;
- fragments, embedded credentials, whitespace, malformed ports, and malformed authorities are rejected;
- the credential target is canonicalized to host and port.

The request path is:

```text
Improve with AI
  → validate endpoint/model and require a saved host-scoped key
  → request session consent for this exact endpoint/model
  → copy current Original text into a worker command
  → retrieve the key from Credential Manager on the worker
  → build OpenAI-compatible JSON in safe Rust
  → POST through WinHTTP with redirects disabled
  → enforce finite DNS/connect/send/receive and size limits
  → parse and bound the provider response
  → return through a channel and WM_APP notification
  → compare current Original text with the submitted source
  → show an unchanged-source result for review
```

WinHTTP uses 5-second resolution, 8-second connect, and 10-second send/receive timeouts plus a 45-second worker deadline checked between blocking calls. It has a 32 KiB response-header limit and a 256 KiB response-body limit. Parsed model output is capped at 32,768 UTF-16 code units. The shell stops accepting a result after 45 seconds; a late result is discarded. A timed-out worker remains marked busy until the current blocking call returns, preventing an unbounded request queue.

Redirects are disabled rather than followed so a bearer credential cannot be forwarded to another location. Request text, response text, and API keys are never logged.

## Settings and secrets

- Endpoint and model are nonsecret and stored under `HKCU\Software\SwiftSlate`.
- API keys are Generic Credentials in Windows Credential Manager.
- Credential names are scoped to canonical host and port, not endpoint path or model.
- Saving a blank API-key field preserves an existing key; **Remove key** explicitly deletes it.
- The API-key edit uses the password style and is cleared after a successful save.
- Consent is held only in memory and is tied to the exact endpoint/model string for the session.

## Review and future replacement

The current application does not replace text. It displays provider output in a read-only result control and requires **Copy result**.

A future replacement phase must still revalidate:

```text
review acceptance
  → foreground process and window
  → focused control identity
  → selected/source text
  → target integrity level
  → released physical modifiers
  → semantically safe ValuePattern or guarded clipboard + SendInput
```

Any mismatch must cancel replacement while preserving the reviewed output for manual copy.

## Dependency policy

- Prefer the standard library and operating-system APIs.
- Every runtime dependency requires size, security, maintenance, and licensing justification.
- `serde_json` is used to avoid unsafe or incorrect hand-built JSON.
- `windows` is target-specific and provides generated Win32 bindings.
- No browser engine, cross-platform GUI toolkit, async runtime, database, or scripting runtime is part of the Windows prototype.

## Linux follow-up

Linux work begins after Windows provider behavior is validated. It must define explicit X11 and Wayland capability tiers, use Secret Service for keys, retain endpoint/consent policy in the portable core, and preserve review-before-copy unless safe replacement can be proven per desktop environment.
