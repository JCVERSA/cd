# SwiftSlate 1.2 architecture

## Product invariants

1. Idle work is event-driven; there is no polling loop.
2. Typed text, selections, prompts, and model output are not persisted.
3. Protected or ambiguous capture fails closed where the platform exposes protection metadata.
4. Shortcut capture never triggers a request; a recognized physical inline command may request only after the same endpoint/model session consent.
5. Provider access requires explicit endpoint/model consent.
6. Accessibility and network blocking never occur on the Windows window thread.
7. Provider output is review-only; SwiftSlate does not synthesize replacement input.
8. Remote endpoints use HTTPS, redirects are disabled, and all inputs and responses are bounded.

## Source layout

```text
src/
├── lib.rs                  portable safe-Rust boundary
├── trigger.rs              bounded physical-input suffix detector
├── commands.rs             built-in commands, triggers, and instructions
├── providers.rs            provider chat/catalog endpoints and model presets
├── replacement.rs          stale-result guard model
├── selection.rs            shared capture limits and assembly
├── preview.rs              deterministic offline transform
├── provider.rs             endpoint policy and command-specific JSON
├── main.rs                 target entry point
├── windows_app.rs          native settings, consent, review, and copy UI
├── windows_selection.rs    dedicated MTA UI Automation worker
├── windows_provider.rs     dedicated bounded WinHTTP worker
├── windows_config.rs       HKCU nonsecret settings
├── windows_secrets.rs      Windows Credential Manager adapter
├── linux_app.rs            consented CLI and desktop integration commands
├── linux_selection.rs      X11/Wayland primary-selection adapters
├── linux_provider.rs       bounded native-TLS HTTP transport
├── linux_config.rs         XDG nonsecret settings
└── linux_secrets.rs        Secret Service adapter through secret-tool
```

The portable library forbids unsafe Rust. Unsafe calls are confined to direct Windows adapters. Linux uses safe Rust plus narrowly scoped standard desktop tools for Secret Service and primary-selection interoperability.

## Windows runtime

```text
Global hotkey + selected text
  OR physical Raw Input suffix + whole field before `?command`
  → preserve foreground window
  → MTA UI Automation worker
  → password/focus/range/trigger validation
  → native Original text review + visible command/provider selectors
  → explicit Run with AI, or verified inline-command activation
  → endpoint/model session consent
  → WinHTTP worker + optional exact-loopback / Credential Manager key
  → bounded OpenAI-compatible response parsing
  → exact source-text revalidation
  → read-only result
  → explicit Copy result
```

### Capture worker

1. Preserve the foreground target before opening SwiftSlate.
2. Query the focused UI Automation element.
3. Fail closed if `IsPassword` is true or unavailable.
4. Probe the focused element and at most eight ancestors for `TextPattern`.
5. Accept at most eight ranges and 32,768 UTF-16 code units.
6. Recheck foreground window, focus identity, and password status.
7. Deliver text only if every check still passes.

The UI stops waiting after 1.5 seconds and ignores late results. An unsupported non-protected control may load the existing clipboard as a labelled fallback only for the explicit shortcut path. Protected controls and inline commands never do.

### Inline command path

1. A Raw Input keyboard sink receives physical keyboard events while SwiftSlate is in the background.
2. The foreground window boundary resets a bounded suffix detector; synthetic-origin input is rejected.
3. `ToUnicodeEx` translates the key using the foreground thread's active keyboard layout. Backspace is modeled; navigation and control keys reset the detector.
4. A recognized built-in suffix queues UI Automation after a short key-commit delay.
5. The worker rejects password fields, requires stable foreground/focus identity, reads at most the field limit, verifies that the exact suffix is still present, and removes only the suffix from the review copy.
6. SwiftSlate opens the review window. If endpoint/model consent is not yet active, it asks before sending; otherwise the physical typed command is the explicit activation.
7. No source keystrokes are synthesized. The original external field, including its trigger, remains untouched until the user reviews and explicitly copies the result.

Only the maximum trigger-length suffix is retained by the detector; normal typed text is neither retained nor logged. Built-ins are `?improve`, `?fix`, `?shorten`, `?expand`, `?formal`, `?casual`, `?human`, `?reply`, and `?translate:fr`.

### Provider worker

- Exposes one serialized background queue for generation, live model-catalog fetches, and provider tests.
- Reads the key for the endpoint's canonical host/port from Credential Manager.
- Includes presets for OpenAI, Gemini, Groq, NVIDIA NIM, OpenRouter, Mistral, DeepSeek, Ollama, LM Studio, and Custom.
- Fetch/test actions use an explicit `GET` to the preset `/models` URL or the derived OpenAI-compatible sibling of a custom chat URL; they send no selected/user text.
- Model catalogs accept common OpenAI and local-server JSON shapes, de-duplicate entries, cap IDs at 128 characters and catalogs at 1,000 entries, and remain in process memory only until the user selects and saves one.
- Builds request JSON with `serde_json` rather than string concatenation.
- Uses WinHTTP with redirects disabled.
- Uses 5-second resolution, 8-second connect, 10-second send/receive, and a 45-second total worker deadline.
- Limits headers to 32 KiB and response bodies to 256 KiB.
- Returns through a channel and private `WM_APP` notification.
- Keeps the worker marked busy after a UI timeout until its current bounded operation returns, preventing an unbounded queue.

Windows loopback integration tests exercise POST behavior, redirect refusal, response parsing, and oversized-body rejection through real local sockets.

## Linux runtime

Linux is a composable CLI because secure desktop capabilities differ fundamentally by display server and compositor.

```text
stdin or explicit capture-selection command
  → shared 32,768 UTF-16-unit limit
  → mandatory --consent for a sending invocation
  → XDG endpoint/model config
  → host-scoped key lookup through Secret Service
  → bounded native-TLS HTTP request
  → sanitized OpenAI-compatible response
  → stdout for review
```

### Capability tiers

| Environment | Input capability |
|---|---|
| Any Linux shell | Explicit UTF-8 stdin |
| X11 | PRIMARY selection through `xclip` or `xsel` |
| Wayland with primary-selection support | `wl-paste --primary` |
| Restricted Wayland compositor | Stdin only; SwiftSlate does not bypass policy |

Desktop-wide shortcuts are configured in the desktop environment and invoke SwiftSlate commands. Selection capture is a separate, non-networking command. `improve-selection` requires the explicit `--consent` flag and prints output instead of injecting it.

### Linux storage and transport

- Endpoint/model: `$XDG_CONFIG_HOME/swiftslate/provider.json` or `~/.config/swiftslate/provider.json`, directory mode `0700`, file mode `0600`, atomic replacement.
- API key: Secret Service via `secret-tool`; secret bytes travel through pipes and never argv, environment, or config.
- HTTPS: `ureq` with native TLS and platform roots.
- Redirects: zero allowed.
- Time budget: 45 seconds globally, with 10-second read/write bounds.
- Loopback HTTP: proxies disabled and `localhost` transported as `127.0.0.1`.

Linux loopback integration tests exercise request headers, completion parsing, and redirect refusal through real local sockets.

## Shared endpoint policy

`provider.rs` rejects:

- schemes other than HTTP/HTTPS;
- remote plaintext HTTP;
- HTTP hosts other than exact loopback addresses;
- fragments or embedded credentials;
- malformed IPv6 brackets, ports, authorities, whitespace, and controls;
- overlong endpoints or model identifiers.

Credential targets are canonical host/port identities, independent of endpoint path and model. Consent includes the exact configured endpoint and model.

## Data lifetime

SwiftSlate has no text database, request history, analytics, telemetry, or content logs. Sensitive request, response, key, and authorization buffers are overwritten when practical before release. Operating-system credential services remain the only persistent secret stores.

## Why replacement remains manual

Reliable automatic replacement requires platform-specific proof of unchanged foreground process, target identity, source range, integrity level, and physical modifier state. Wayland intentionally prevents universal injection. SwiftSlate therefore treats explicit review and copy/stdout as the final safe product behavior, not an unfinished fallback.

## Dependency policy

- Standard library and operating-system APIs are preferred.
- `serde_json` prevents incorrect hand-built JSON.
- Windows uses only Microsoft's target-specific `windows` bindings.
- Linux uses `ureq` with native TLS; no async runtime or GUI framework is included.
- There is no browser engine, database, scripting runtime, or telemetry SDK.
