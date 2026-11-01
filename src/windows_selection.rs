//! Windows UI Automation selection capture on a dedicated COM worker thread.
//!
//! UI Automation providers execute outside SwiftSlate's control and can be
//! slow or unavailable. Keeping them off the window thread lets the shell apply
//! a short timeout without freezing its interface.

use std::ffi::c_void;
use std::sync::mpsc::{self, Receiver, Sender, SyncSender};
use std::thread;
use std::time::Duration;

use swiftslate::selection::{
    combine_selection_ranges, SelectionLimitError, MAX_SELECTION_RANGES, MAX_SELECTION_UTF16,
};
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationTextPattern, UIA_TextPatternId,
};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, PostMessageW, WM_APP};

pub const WM_SELECTION_CAPTURED: u32 = WM_APP + 17;

#[derive(Debug)]
pub enum CaptureOutcome {
    Selected(String),
    Empty,
    Protected,
    Unsupported,
    TargetChanged,
    TooLarge,
    Unavailable,
}

#[derive(Debug)]
pub struct CaptureResponse {
    pub request_id: u64,
    pub outcome: CaptureOutcome,
}

struct CaptureRequest {
    request_id: u64,
    source_window: isize,
}

enum WorkerCommand {
    Capture(CaptureRequest),
    Stop,
}

pub struct SelectionWorker {
    command_tx: Sender<WorkerCommand>,
    response_rx: Receiver<CaptureResponse>,
}

impl SelectionWorker {
    pub fn start(notification_window: HWND) -> Result<Self, String> {
        let notification_window = notification_window.0 as isize;
        let (command_tx, command_rx) = mpsc::channel();
        let (response_tx, response_rx) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);

        thread::Builder::new()
            .name("swiftslate-uia".into())
            .spawn(move || {
                worker_main(notification_window, command_rx, response_tx, ready_tx);
            })
            .map_err(|error| format!("could not create UI Automation worker: {error}"))?;

        match ready_rx.recv_timeout(Duration::from_secs(2)) {
            Ok(Ok(())) => Ok(Self {
                command_tx,
                response_rx,
            }),
            Ok(Err(error)) => Err(error),
            Err(_) => Err("UI Automation worker did not become ready".into()),
        }
    }

    pub fn request(&self, request_id: u64, source_window: HWND) -> Result<(), ()> {
        self.command_tx
            .send(WorkerCommand::Capture(CaptureRequest {
                request_id,
                source_window: source_window.0 as isize,
            }))
            .map_err(|_| ())
    }

    pub fn try_responses(&self) -> Vec<CaptureResponse> {
        self.response_rx.try_iter().collect()
    }

    pub fn stop(&self) {
        let _ = self.command_tx.send(WorkerCommand::Stop);
    }
}

fn worker_main(
    notification_window: isize,
    command_rx: Receiver<WorkerCommand>,
    response_tx: Sender<CaptureResponse>,
    ready_tx: SyncSender<Result<(), String>>,
) {
    let initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok() };
    if let Err(error) = initialized {
        let _ = ready_tx.send(Err(format!(
            "could not initialize UI Automation COM apartment: {error}"
        )));
        return;
    }

    let automation: IUIAutomation =
        match unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER) } {
            Ok(automation) => automation,
            Err(error) => {
                let _ = ready_tx.send(Err(format!(
                    "could not create UI Automation client: {error}"
                )));
                unsafe { CoUninitialize() };
                return;
            }
        };

    if ready_tx.send(Ok(())).is_err() {
        unsafe { CoUninitialize() };
        return;
    }

    while let Ok(command) = command_rx.recv() {
        let request = match command {
            WorkerCommand::Capture(request) => request,
            WorkerCommand::Stop => break,
        };
        let response = CaptureResponse {
            request_id: request.request_id,
            outcome: unsafe { capture_selection(&automation, &request) },
        };
        if response_tx.send(response).is_err() {
            break;
        }

        let notification_window = HWND(notification_window as *mut c_void);
        let _ = unsafe {
            PostMessageW(
                notification_window,
                WM_SELECTION_CAPTURED,
                WPARAM(0),
                LPARAM(0),
            )
        };
    }

    unsafe { CoUninitialize() };
}

unsafe fn capture_selection(
    automation: &IUIAutomation,
    request: &CaptureRequest,
) -> CaptureOutcome {
    let source_window = HWND(request.source_window as *mut c_void);
    if source_window.is_invalid() || GetForegroundWindow() != source_window {
        return CaptureOutcome::TargetChanged;
    }

    let focused = match automation.GetFocusedElement() {
        Ok(element) => element,
        Err(_) => return CaptureOutcome::Unavailable,
    };
    if is_protected(&focused) {
        return CaptureOutcome::Protected;
    }

    let walker = automation.ControlViewWalker().ok();
    let mut candidate = Some(focused.clone());
    for _ in 0..8 {
        let Some(element) = candidate.take() else {
            break;
        };
        if is_protected(&element) {
            return CaptureOutcome::Protected;
        }

        let pattern: windows::core::Result<IUIAutomationTextPattern> =
            element.GetCurrentPatternAs(UIA_TextPatternId);
        if let Ok(pattern) = pattern {
            let outcome = capture_ranges(&pattern);
            return verify_target(automation, &focused, &element, source_window, outcome);
        }

        candidate = walker
            .as_ref()
            .and_then(|walker| walker.GetParentElement(&element).ok());
    }

    if GetForegroundWindow() != source_window {
        CaptureOutcome::TargetChanged
    } else {
        CaptureOutcome::Unsupported
    }
}

unsafe fn capture_ranges(pattern: &IUIAutomationTextPattern) -> CaptureOutcome {
    let selection = match pattern.GetSelection() {
        Ok(selection) => selection,
        Err(_) => return CaptureOutcome::Unavailable,
    };
    let count = match selection.Length() {
        Ok(count) if count >= 0 => count as usize,
        _ => return CaptureOutcome::Unavailable,
    };
    if count > MAX_SELECTION_RANGES {
        return CaptureOutcome::TooLarge;
    }

    let mut ranges = Vec::with_capacity(count);
    for index in 0..count {
        let range = match selection.GetElement(index as i32) {
            Ok(range) => range,
            Err(_) => return CaptureOutcome::Unavailable,
        };
        let text = match range.GetText((MAX_SELECTION_UTF16 + 1) as i32) {
            Ok(text) => String::from_utf16_lossy(text.as_wide()),
            Err(_) => return CaptureOutcome::Unavailable,
        };
        ranges.push(text);
    }

    match combine_selection_ranges(&ranges) {
        Ok(Some(text)) => CaptureOutcome::Selected(text),
        Ok(None) => CaptureOutcome::Empty,
        Err(SelectionLimitError::TooManyRanges | SelectionLimitError::TooLong) => {
            CaptureOutcome::TooLarge
        }
    }
}

unsafe fn verify_target(
    automation: &IUIAutomation,
    original_focus: &IUIAutomationElement,
    pattern_element: &IUIAutomationElement,
    source_window: HWND,
    outcome: CaptureOutcome,
) -> CaptureOutcome {
    if GetForegroundWindow() != source_window {
        return CaptureOutcome::TargetChanged;
    }
    if is_protected(pattern_element) {
        return CaptureOutcome::Protected;
    }
    let current_focus = match automation.GetFocusedElement() {
        Ok(element) => element,
        Err(_) => return CaptureOutcome::TargetChanged,
    };
    if is_protected(&current_focus) {
        return CaptureOutcome::Protected;
    }
    match automation.CompareElements(original_focus, &current_focus) {
        Ok(equal) if equal.as_bool() => outcome,
        _ => CaptureOutcome::TargetChanged,
    }
}

unsafe fn is_protected(element: &IUIAutomationElement) -> bool {
    // Fail closed when a provider will not disclose the password property.
    element
        .CurrentIsPassword()
        .map(|is_password| is_password.as_bool())
        .unwrap_or(true)
}
