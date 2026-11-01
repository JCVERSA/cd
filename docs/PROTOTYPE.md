# SwiftSlate 1.1 release qualification

This document defines the consolidated release gate. Intermediate phase builds are not user acceptance points; CI produces complete Windows and Linux artifacts from the same branch state.

## Automated acceptance matrix

| Requirement | Automated evidence |
|---|---|
| Portable safety core | Cross-platform unit tests |
| Endpoint validation | HTTPS/loopback, authority, port, and credential-scope tests |
| Correct JSON | Escaping, completion parsing, missing output, errors, and output bounds |
| Windows selection limits | Range/count/focus/protection core tests plus Windows compilation |
| Provider and command catalogs | Unique trigger tests and endpoint validation for every noncustom preset |
| Typed inline command safety | Bounded detector tests, synthetic-input rejection, protected UIA path, and Windows compilation |
| Windows network isolation | Dedicated-worker architecture and warnings-denied build |
| Windows HTTP behavior | Real loopback POST, redirect-refusal, and oversized-body tests |
| Linux HTTP behavior | Real loopback POST, authorization, completion, and redirect-refusal tests |
| Secret separation | Platform adapters keep keys outside nonsecret config |
| Linux config safety | Bounded parsing, strict endpoint policy, protected atomic writes |
| Consent enforcement | Windows state machine and Linux exact `--consent` argument tests |
| Stale response handling | Request-ID and exact-source checks |
| Review-only output | No replacement/injection adapter is linked |
| Code quality | Formatting and warnings-denied Clippy on Linux and Windows |
| Distribution | Optimized Windows ZIP and Linux tarball |
| Reproducible metadata | CI records binary/archive sizes and SHA-256 hashes |

## Windows behavior checklist

- Native Win32 application starts without a bundled runtime.
- `Ctrl+Alt+Space` opens the palette after selection capture.
- The provider selector visibly offers OpenAI, Google Gemini, Groq, OpenRouter, Mistral AI, DeepSeek, Ollama, LM Studio, and Custom.
- The command selector visibly offers all nine built-ins and their typed triggers.
- Physical `?fix`/other built-in suffixes in external compatible fields queue bounded whole-field capture and the matching command.
- Password, synthetic-input, trigger mismatch, target change, and focus-race checks fail closed.
- Unsupported non-protected controls clearly label clipboard fallback only for shortcut capture; inline capture never uses it.
- Provider settings persist while keys remain in Credential Manager; exact-loopback providers may omit a key.
- Remote HTTP is rejected; loopback HTTP is direct and proxy-free.
- Consent defaults to No and is tied to endpoint/model.
- The window remains responsive during DNS, connect, send, and receive.
- A source edit, timeout, new capture, or local preview invalidates a pending response.
- Result review and copy are explicit; no source application receives synthetic input.

## Linux behavior checklist

- Binary starts on a supported glibc distribution with native TLS available.
- Config is written only to the XDG/home config location with protected permissions.
- A missing or locked Secret Service produces an actionable failure and no plaintext fallback.
- `improve` refuses to send without `--consent`.
- Stdin input works without a graphical session.
- X11 PRIMARY capture uses `xclip` or `xsel` when installed.
- Wayland primary capture uses `wl-paste` when allowed and otherwise fails closed.
- Capture-only does not invoke provider transport.
- Provider output is printed for review and never pasted.

## CI release jobs

### Linux x64

1. Locked tests for all targets.
2. Warnings-denied Clippy.
3. Formatting check.
4. Optimized build.
5. `swiftslate-linux-x64.tar.gz` packaging.
6. Size and SHA-256 measurement.
7. Artifact upload.

### Windows x64

1. Locked tests for all targets, including loopback WinHTTP tests.
2. Warnings-denied Clippy.
3. Optimized native build.
4. `swiftslate-windows-x64.zip` packaging.
5. Size and SHA-256 measurement.
6. Artifact upload.

## Known platform boundaries

- Windows offers the complete graphical selection/settings/review workflow.
- Linux offers a complete secure request/config/secret CLI and best-effort primary-selection adapters. A universal Wayland global-selection GUI would require compositor capabilities that do not exist as a common standard.
- Automatic replacement remains intentionally excluded from 1.1 because it would weaken cross-application and cross-compositor safety guarantees.
- Artifacts are portable and currently unsigned.

## Release decision

A commit qualifies when both CI jobs pass every test, Clippy, formatting, optimized build, packaging, measurement, and upload step. Runtime failures in unavailable desktop services must be explicit and must never downgrade to plaintext secrets, silent clipboard access, insecure transport, or automatic replacement.
