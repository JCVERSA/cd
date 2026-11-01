# Security and privacy baseline

SwiftSlate interacts with text from arbitrary applications. The default must therefore be less collection, less persistence, and explicit user control.

## Prototype guarantees

- No network client is linked into the executable.
- No API keys are accepted or stored.
- No text history or analytics are written.
- No telemetry is present.
- Raw Input records only an in-memory event count in the native shell.
- UI Automation selection capture runs on a dedicated COM worker.
- Password status is checked before and after capture; an unavailable status fails closed.
- Foreground window and focused-element identity are revalidated before text is accepted.
- Capture is limited to 8 ranges and 32,768 UTF-16 code units.
- The shell times out after 1.5 seconds and ignores late accessibility responses.
- Protected fields never use the clipboard fallback.
- The portable trigger detector retains at most the longest trigger.
- Synthetic SwiftSlate input is ignored by trigger detection.
- The review result is never pasted automatically.

## Production requirements

### Protected controls

Before reading text, the Windows adapter must query UI Automation and reject:

- `IsPassword == true`
- inaccessible or ambiguous secure controls
- unsupported elevated targets
- lock screen and secure desktop contexts

Entering a protected control clears all trigger state.

### Request disclosure

Before the first provider request, SwiftSlate must clearly identify:

- the selected provider and endpoint host
- what text will be transmitted
- whether surrounding context is included
- that provider retention policies apply

There is no silent provider fallback.

### Secret storage

API keys must use Windows Credential Manager and Linux Secret Service. They must not appear in JSON configuration, command-line arguments, logs, crash reports, or environment diagnostics.

### Endpoint policy

Custom endpoints require HTTPS except for an explicit loopback-only local-provider mode. Redirects must not forward authorization headers to another origin.

### Replacement safety

A result can only be applied after explicit user acceptance and after revalidating:

1. foreground process and window
2. focused control identity
3. selected/source text
4. target integrity level
5. released physical modifier keys

Any mismatch cancels replacement and leaves the reviewed result available for manual copy.

## Reporting

Do not include sensitive text or API keys in a public issue. Until a private security channel is published, report only that a security issue exists and request a private contact route from the maintainers.
