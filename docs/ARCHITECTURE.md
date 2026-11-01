# SwiftSlate architecture

## Goals

1. Remain idle with effectively zero CPU consumption.
2. Keep the Windows download and installed footprint small.
3. Never persist typed text, selections, or model output by default.
4. Reject protected fields before reading or transforming text.
5. Keep Windows and future Linux integration behind platform boundaries.
6. Make every asynchronous replacement conditional on unchanged focus and source text.

## Current modules

```text
src/
├── lib.rs                 portable, safe Rust only
├── trigger.rs             bounded suffix detector
├── replacement.rs         stale-result replacement guards
├── selection.rs           accessibility selection limits and assembly
├── preview.rs             deterministic offline prototype transform
├── main.rs                platform entry point
├── windows_app.rs         native Win32 prototype shell
└── windows_selection.rs   dedicated UI Automation capture worker
```

The portable library forbids unsafe Rust. Win32 calls and their callback boundary are isolated in `windows_app.rs`.

## Intended production boundaries

```text
┌─────────────────────────────────────────────────────────┐
│ Native shell                                            │
│ command palette · settings · consent · review           │
├─────────────────────────────────────────────────────────┤
│ Application services                                    │
│ command dispatch · request lifecycle · cancellation     │
├─────────────────────────────────────────────────────────┤
│ Portable core                                           │
│ trigger matching · prompts · provider contracts · guard │
├────────────────────────┬────────────────────────────────┤
│ Windows adapter        │ Linux adapters                 │
│ Raw Input              │ X11                            │
│ UI Automation          │ Wayland portals/libei          │
│ SendInput              │ clipboard fallback             │
│ Credential Manager     │ Secret Service                 │
│ WinHTTP/minimal HTTP   │ minimal HTTP                   │
└────────────────────────┴────────────────────────────────┘
```

## Windows input strategy

- `RegisterHotKey` handles command shortcuts.
- Raw Input with `RIDEV_INPUTSINK` observes background keyboard events without a low-level hook.
- The inline detector stores no more characters than the longest trigger.
- Focus changes, cursor movement, unknown edits, and protected controls clear the suffix.
- SwiftSlate-generated input is tagged and excluded from trigger detection.

The current UI increments a Raw Input event counter but does not translate or store keys. Keyboard-layout-aware text translation is a separate compatibility milestone.

## Current selection capture

The Windows 0.2 prototype captures selection on a dedicated multithreaded COM worker:

1. Preserve the foreground target before showing SwiftSlate.
2. Query the focused UI Automation element.
3. Fail closed if `IsPassword` is true or unavailable.
4. Probe the focused element and a bounded number of ancestors for `TextPattern`.
5. Limit captures to 8 ranges and 32,768 UTF-16 code units.
6. Recheck foreground window, focus identity, and password status.
7. Deliver the text to the UI only if every check still passes.

The window thread stops waiting after 1.5 seconds. Late worker responses are ignored. Unsupported controls may use the existing clipboard as a clearly labelled fallback; protected controls never do.

## Selection and replacement strategy

The production path will be:

```text
hotkey
  → inspect focused UI Automation element
  → reject IsPassword or inaccessible controls
  → capture target identity and selected text
  → submit an explicit provider request
  → show review UI
  → recheck target identity and source text
  → ValuePattern when semantically safe
  → guarded clipboard + SendInput fallback
```

A `SelectionSnapshot` prototype already rejects results after focus or source changes.

## Dependency policy

- Prefer the standard library and operating-system APIs.
- Every runtime dependency requires a size, security, maintenance, and licensing justification.
- Platform-only dependencies remain target-specific.
- No browser engine, async runtime, database, or scripting runtime is part of the initial architecture.

## Unresolved decisions

- Native Win32 for all Windows UI versus a small cross-platform toolkit later.
- WinHTTP versus a minimal cross-platform HTTP client.
- UI Automation crate wrapper versus direct COM bindings.
- Exact Wayland capability tiers.

These are intentionally deferred until measured prototypes provide evidence.
