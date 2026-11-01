//! Best-effort Linux selection capture with explicit capability tiers.
//!
//! Wayland has no universal selected-text protocol. SwiftSlate uses `wl-paste`
//! when available; X11 uses the PRIMARY selection through `xclip` or `xsel`.

use std::io::Read;
use std::process::{Command, Stdio};

use swiftslate::selection::{combine_selection_ranges, SelectionLimitError, MAX_SELECTION_UTF16};

const MAX_CAPTURE_BYTES: usize = MAX_SELECTION_UTF16 * 4;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SelectionSource {
    WaylandPrimary,
    X11Primary,
}

impl SelectionSource {
    pub fn description(self) -> &'static str {
        match self {
            Self::WaylandPrimary => "Wayland primary selection",
            Self::X11Primary => "X11 primary selection",
        }
    }
}

pub struct CapturedSelection {
    pub text: String,
    pub source: SelectionSource,
}

pub fn capture_selection() -> Result<CapturedSelection, String> {
    let wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
    if wayland {
        if let Ok(Some(text)) = run_capture("wl-paste", &["--primary", "--no-newline"]) {
            return Ok(CapturedSelection {
                text,
                source: SelectionSource::WaylandPrimary,
            });
        }
    }

    if std::env::var_os("DISPLAY").is_some() {
        for (program, arguments) in [
            ("xclip", &["-o", "-selection", "primary"][..]),
            ("xsel", &["--primary", "--output"][..]),
        ] {
            if let Ok(Some(text)) = run_capture(program, arguments) {
                return Ok(CapturedSelection {
                    text,
                    source: SelectionSource::X11Primary,
                });
            }
        }
    }

    let hint = if wayland {
        "Install wl-clipboard and expose a primary selection before retrying."
    } else {
        "Install xclip or xsel and select text before retrying."
    };
    Err(format!(
        "No readable Linux selection is available. {hint} SwiftSlate never synthesizes copy input."
    ))
}

fn run_capture(program: &str, arguments: &[&str]) -> Result<Option<String>, String> {
    let mut child = Command::new(program)
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start {program}: {error}"))?;
    let mut bytes = Vec::new();
    child
        .stdout
        .take()
        .ok_or_else(|| format!("Could not read output from {program}."))?
        .take((MAX_CAPTURE_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read output from {program}: {error}"))?;
    if bytes.len() > MAX_CAPTURE_BYTES {
        let _ = child.kill();
        let _ = child.wait();
        return Err("The selected text exceeds SwiftSlate's capture limit.".into());
    }
    let status = child
        .wait()
        .map_err(|error| format!("Could not wait for {program}: {error}"))?;
    if !status.success() {
        return Ok(None);
    }
    let text = String::from_utf8(bytes)
        .map_err(|_| format!("The selection returned by {program} is not valid UTF-8."))?;
    match combine_selection_ranges([text]) {
        Ok(Some(text)) => Ok(Some(text)),
        Ok(None) => Ok(None),
        Err(SelectionLimitError::TooLong) => {
            Err("The selected text exceeds SwiftSlate's capture limit.".into())
        }
        Err(SelectionLimitError::TooManyRanges) => unreachable!("one range was provided"),
    }
}
