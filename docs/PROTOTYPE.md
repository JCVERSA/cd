# Windows 0.2 prototype definition

## Purpose

The 0.2 prototype validates protected Windows selection capture while API keys, network traffic, synthetic copy, and automatic text replacement remain disabled.

## Included acceptance checks

| Check | Implementation |
|---|---|
| Native lightweight UI | Direct Win32 controls |
| Global shortcut | `RegisterHotKey`, `Ctrl+Alt+Space` |
| Background input mechanism | Raw Input with `RIDEV_INPUTSINK` |
| Automatic selection capture | UI Automation `TextPattern` |
| Password rejection | Fail-closed `IsPassword` checks before and after capture |
| Accessibility-provider isolation | Dedicated multithreaded COM worker |
| UI responsiveness | 1.5-second shell timeout; late results ignored |
| Capture limits | 8 ranges and 32,768 UTF-16 code units |
| Focus race protection | Foreground window and focused element revalidated |
| Unsupported-control behavior | Clearly labelled existing-clipboard fallback |
| Bounded trigger memory | Longest-trigger-sized `VecDeque<char>` |
| Protected-mode behavior | Detector clears and suspends in sensitive mode |
| Feedback-loop prevention | SwiftSlate-origin events are ignored |
| Safe asynchronous replacement model | Target and selected text must still match |
| Review flow | Original and result are shown separately |
| Offline behavior | Deterministic local preview; no HTTP dependency |
| Automated validation | Linux core tests and Windows build/tests/clippy |
| Artifact evidence | CI records EXE/ZIP size and SHA-256 |

## Manual Windows test plan

### Startup and shell

- [ ] Application starts without installing a runtime.
- [ ] Window uses normal Windows keyboard navigation.
- [ ] Closing the title bar exits the process.
- [ ] Hiding the window leaves the process idle.

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

### Protected fields

- [ ] A browser password field is rejected.
- [ ] A native Windows password edit is rejected.
- [ ] Existing clipboard text is not loaded after protected-field rejection.
- [ ] Moving focus during capture cancels the result.
- [ ] A stalled provider times out without freezing SwiftSlate.

### Raw Input

- [ ] Status initially reports registration success.
- [ ] Event count increases after typing while SwiftSlate is hidden.
- [ ] No typed characters appear in logs or files.
- [ ] Idle CPU remains effectively zero.

### Review workflow

- [ ] Captured text appears without an automatic network request.
- [ ] Empty selection is handled safely.
- [ ] Oversized selection is rejected.
- [ ] Local preview clearly says no network request occurred.
- [ ] Copy result places only the reviewed result on the clipboard.

### Resource measurements

Record on an ordinary Windows 10 or Windows 11 machine:

- [ ] Cold startup time
- [ ] Idle working set after 60 seconds
- [ ] Idle CPU over 60 seconds
- [ ] Release EXE size
- [ ] Compressed ZIP size

## Exit criteria

The phase is accepted when CI is green and manual Windows testing confirms that selection works in representative native, browser, Office, and Electron applications while password fields and focus races fail closed.

The next security gate introduces provider configuration, Credential Manager storage, and an explicit request-consent screen. Automatic replacement remains disabled until target revalidation is tested interactively.
