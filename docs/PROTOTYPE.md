# Prototype definition

## Purpose

The first prototype is a risk-reduction build. It validates the lightweight Windows foundation before API keys, network traffic, or automatic text replacement are allowed into the application.

## Included acceptance checks

| Check | Implementation |
|---|---|
| Native lightweight UI | Direct Win32 controls |
| Global shortcut | `RegisterHotKey`, `Ctrl+Alt+Space` |
| Background input mechanism | Raw Input with `RIDEV_INPUTSINK` |
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

### Global shortcut

- [ ] `Ctrl+Alt+Space` opens/restores SwiftSlate from Notepad.
- [ ] It opens from Chrome or Edge.
- [ ] It opens from VS Code.
- [ ] A shortcut conflict is reported without crashing.

### Raw Input

- [ ] Status initially reports registration success.
- [ ] Event count increases after typing while SwiftSlate is hidden.
- [ ] No typed characters appear in logs or files.
- [ ] Idle CPU remains effectively zero.

### Review workflow

- [ ] Copying plain text and pressing the shortcut loads the clipboard.
- [ ] Empty or non-text clipboard data is handled safely.
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

The prototype is accepted when CI is green, the executable runs on Windows 10/11, the hotkey and Raw Input checks pass, and no security or resource regression blocks the next phase.

The next phase adds UI Automation inspection and selection capture. AI networking remains behind a separate security gate.
