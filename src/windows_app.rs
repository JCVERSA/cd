//! Minimal native Win32 shell for SwiftSlate.
//!
//! Selection capture and provider networking run on dedicated workers. The
//! window thread keeps explicit review/copy semantics and never replaces text in
//! another application.

use std::cell::RefCell;
use std::ffi::c_void;
use std::mem::size_of;
use std::panic::{catch_unwind, AssertUnwindSafe};

use crate::windows_config::{load_provider_config, save_provider_config, DEFAULT_ENDPOINT};
use crate::windows_provider::{ProviderWorker, WM_PROVIDER_COMPLETE};
use crate::windows_secrets::{delete_api_key, read_api_key, save_api_key};
use crate::windows_selection::{CaptureOutcome, SelectionWorker, WM_SELECTION_CAPTURED};
use swiftslate::preview::improve_preview;
use swiftslate::provider::ProviderConfig;
use windows::core::{w, Error, PCWSTR};
use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    GetStockObject, GetSysColorBrush, COLOR_WINDOW, DEFAULT_GUI_FONT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, SetFocus, UnregisterHotKey, HOT_KEY_MODIFIERS, VK_SPACE,
};
use windows::Win32::UI::Input::{
    GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE, RAWINPUTHEADER,
    RIDEV_INPUTSINK, RIDEV_REMOVE, RID_INPUT, RIM_TYPEKEYBOARD,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetForegroundWindow,
    GetMessageW, GetWindowTextLengthW, GetWindowTextW, KillTimer, LoadCursorW, MessageBoxW,
    PostQuitMessage, RegisterClassW, SendMessageW, SetForegroundWindow, SetTimer, SetWindowTextW,
    ShowWindow, TranslateMessage, BS_DEFPUSHBUTTON, ES_AUTOHSCROLL, ES_AUTOVSCROLL, ES_MULTILINE,
    ES_PASSWORD, ES_READONLY, ES_WANTRETURN, HMENU, IDC_ARROW, IDYES, MB_DEFBUTTON2, MB_ICONERROR,
    MB_ICONWARNING, MB_OK, MB_YESNO, MSG, SW_HIDE, SW_RESTORE, SW_SHOWNORMAL, WINDOW_EX_STYLE,
    WINDOW_STYLE, WM_CLOSE, WM_COMMAND, WM_COPY, WM_CREATE, WM_DESTROY, WM_HOTKEY, WM_INPUT,
    WM_PASTE, WM_SETFONT, WM_TIMER, WNDCLASSW, WS_BORDER, WS_CAPTION, WS_CHILD, WS_EX_CLIENTEDGE,
    WS_MINIMIZEBOX, WS_OVERLAPPED, WS_SYSMENU, WS_TABSTOP, WS_VISIBLE, WS_VSCROLL,
};

const CLASS_NAME: PCWSTR = w!("SwiftSlateWindow");
const WINDOW_TITLE: PCWSTR = w!("SwiftSlate");
const HOTKEY_ID: i32 = 0x5353;
const HOTKEY_MODIFIERS: HOT_KEY_MODIFIERS = HOT_KEY_MODIFIERS(0x0001 | 0x0002 | 0x4000);

const ID_ORIGINAL: isize = 101;
const ID_RESULT: isize = 102;
const ID_ENDPOINT: isize = 103;
const ID_MODEL: isize = 104;
const ID_API_KEY: isize = 105;
const ID_AI_IMPROVE: usize = 201;
const ID_LOCAL_PREVIEW: usize = 202;
const ID_COPY: usize = 203;
const ID_HIDE: usize = 204;
const ID_SAVE_PROVIDER: usize = 205;
const ID_REMOVE_KEY: usize = 206;

// These edit-control messages are stable across supported Windows versions.
const EM_SETSEL: u32 = 0x00B1;
const EM_SETLIMITTEXT: u32 = 0x00C5;
const RI_KEY_BREAK: u16 = 0x0001;
const CAPTURE_TIMER_ID: usize = 1;
const PROVIDER_TIMER_ID: usize = 2;
const CAPTURE_TIMEOUT_MS: u32 = 1_500;
const PROVIDER_TIMEOUT_MS: u32 = 45_000;
const DEFAULT_MODEL: &str = "gpt-4o-mini";

struct UiState {
    original: HWND,
    result: HWND,
    endpoint: HWND,
    model: HWND,
    api_key: HWND,
    status: HWND,
    raw_key_down_events: u64,
    hotkey_registered: bool,
    raw_input_registered: bool,
    selection_worker: Option<SelectionWorker>,
    latest_capture_id: u64,
    capture_pending: bool,
    provider_worker: Option<ProviderWorker>,
    latest_provider_id: u64,
    provider_busy: bool,
    provider_response_expected: bool,
    provider_source: String,
    consented_provider: Option<String>,
}

thread_local! {
    static UI: RefCell<Option<UiState>> = const { RefCell::new(None) };
}

pub fn main() {
    if let Err(error) = run() {
        let message = wide(&format!("SwiftSlate could not start.\n\n{error}"));
        unsafe {
            MessageBoxW(
                None,
                PCWSTR(message.as_ptr()),
                WINDOW_TITLE,
                MB_OK | MB_ICONERROR,
            );
        }
    }
}

fn run() -> windows::core::Result<()> {
    unsafe {
        let module = GetModuleHandleW(None)?;
        let instance = HINSTANCE(module.0);
        let window_class = WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: instance,
            lpszClassName: CLASS_NAME,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            hbrBackground: GetSysColorBrush(COLOR_WINDOW),
            ..Default::default()
        };

        if RegisterClassW(&window_class) == 0 {
            return Err(Error::from_win32());
        }

        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            CLASS_NAME,
            WINDOW_TITLE,
            WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
            i32::MIN,
            i32::MIN,
            740,
            720,
            None,
            None,
            instance,
            None,
        )?;

        let _ = ShowWindow(hwnd, SW_SHOWNORMAL);
        let _ = SetForegroundWindow(hwnd);

        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
    Ok(())
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    // A panic must never unwind through an operating-system callback boundary.
    catch_unwind(AssertUnwindSafe(|| {
        window_proc_inner(hwnd, message, wparam, lparam)
    }))
    .unwrap_or_else(|_| DefWindowProcW(hwnd, message, wparam, lparam))
}

unsafe fn window_proc_inner(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match message {
        WM_CREATE => {
            if let Err(error) = initialize_window(hwnd) {
                let text = wide(&format!(
                    "The prototype UI could not be initialized.\n\n{error}"
                ));
                MessageBoxW(
                    hwnd,
                    PCWSTR(text.as_ptr()),
                    WINDOW_TITLE,
                    MB_OK | MB_ICONERROR,
                );
                return LRESULT(-1);
            }
            LRESULT(0)
        }
        WM_HOTKEY if wparam.0 as i32 == HOTKEY_ID => {
            begin_selection_capture(hwnd);
            LRESULT(0)
        }
        WM_SELECTION_CAPTURED => {
            finish_selection_capture(hwnd);
            LRESULT(0)
        }
        WM_PROVIDER_COMPLETE => {
            finish_provider_request(hwnd);
            LRESULT(0)
        }
        WM_TIMER if wparam.0 == CAPTURE_TIMER_ID => {
            selection_capture_timed_out(hwnd);
            LRESULT(0)
        }
        WM_TIMER if wparam.0 == PROVIDER_TIMER_ID => {
            provider_request_timed_out(hwnd);
            LRESULT(0)
        }
        WM_INPUT => {
            if raw_key_down(lparam) {
                UI.with(|slot| {
                    if let Some(state) = slot.borrow_mut().as_mut() {
                        state.raw_key_down_events = state.raw_key_down_events.saturating_add(1);
                    }
                });
            }
            // WM_INPUT must reach DefWindowProcW so Windows can perform cleanup.
            DefWindowProcW(hwnd, message, wparam, lparam)
        }
        WM_COMMAND => {
            match wparam.0 & 0xffff {
                ID_AI_IMPROVE => begin_provider_request(hwnd),
                ID_LOCAL_PREVIEW => run_local_preview(hwnd),
                ID_COPY => copy_result(),
                ID_SAVE_PROVIDER => save_provider_settings(),
                ID_REMOVE_KEY => remove_provider_key(),
                ID_HIDE => {
                    let _ = ShowWindow(hwnd, SW_HIDE);
                }
                _ => {}
            }
            LRESULT(0)
        }
        WM_CLOSE => {
            let _ = DestroyWindow(hwnd);
            LRESULT(0)
        }
        WM_DESTROY => {
            shut_down(hwnd);
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

unsafe fn initialize_window(hwnd: HWND) -> windows::core::Result<()> {
    let module = GetModuleHandleW(None)?;
    let instance = HINSTANCE(module.0);

    let initial_config = load_provider_config()
        .ok()
        .flatten()
        .unwrap_or_else(|| {
            ProviderConfig::new(DEFAULT_ENDPOINT, DEFAULT_MODEL)
                .expect("the built-in provider configuration is valid")
        });
    let endpoint_text = wide(&initial_config.endpoint);
    let model_text = wide(&initial_config.model);

    let intro = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Select text, then press Ctrl+Alt+Space from any app to open SwiftSlate."),
        WS_CHILD | WS_VISIBLE,
        20,
        16,
        680,
        24,
        hwnd,
        0,
        instance,
    )?;

    let original_label = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Original text"),
        WS_CHILD | WS_VISIBLE,
        20,
        48,
        200,
        20,
        hwnd,
        0,
        instance,
    )?;

    let original = create_control(
        WS_EX_CLIENTEDGE,
        w!("EDIT"),
        w!(""),
        WS_CHILD
            | WS_VISIBLE
            | WS_TABSTOP
            | WS_BORDER
            | WS_VSCROLL
            | WINDOW_STYLE((ES_MULTILINE | ES_AUTOVSCROLL | ES_WANTRETURN) as u32),
        20,
        69,
        680,
        125,
        hwnd,
        ID_ORIGINAL,
        instance,
    )?;

    let ai_improve = create_control(
        WINDOW_EX_STYLE(0),
        w!("BUTTON"),
        w!("Improve with AI"),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP | WINDOW_STYLE(BS_DEFPUSHBUTTON as u32),
        20,
        205,
        150,
        32,
        hwnd,
        ID_AI_IMPROVE as isize,
        instance,
    )?;

    let local_preview = create_control(
        WINDOW_EX_STYLE(0),
        w!("BUTTON"),
        w!("Local preview"),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP,
        180,
        205,
        130,
        32,
        hwnd,
        ID_LOCAL_PREVIEW as isize,
        instance,
    )?;

    let provider_label = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Provider settings (selected text leaves this device only after session consent)"),
        WS_CHILD | WS_VISIBLE,
        20,
        249,
        680,
        20,
        hwnd,
        0,
        instance,
    )?;

    let endpoint_label = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Endpoint"),
        WS_CHILD | WS_VISIBLE,
        20,
        276,
        65,
        22,
        hwnd,
        0,
        instance,
    )?;
    let endpoint = create_control(
        WS_EX_CLIENTEDGE,
        w!("EDIT"),
        PCWSTR(endpoint_text.as_ptr()),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_BORDER | WINDOW_STYLE(ES_AUTOHSCROLL as u32),
        88,
        272,
        612,
        25,
        hwnd,
        ID_ENDPOINT,
        instance,
    )?;

    let model_label = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Model"),
        WS_CHILD | WS_VISIBLE,
        20,
        310,
        50,
        22,
        hwnd,
        0,
        instance,
    )?;
    let model = create_control(
        WS_EX_CLIENTEDGE,
        w!("EDIT"),
        PCWSTR(model_text.as_ptr()),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_BORDER | WINDOW_STYLE(ES_AUTOHSCROLL as u32),
        70,
        306,
        180,
        25,
        hwnd,
        ID_MODEL,
        instance,
    )?;

    let key_label = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("API key"),
        WS_CHILD | WS_VISIBLE,
        265,
        310,
        55,
        22,
        hwnd,
        0,
        instance,
    )?;
    let api_key = create_control(
        WS_EX_CLIENTEDGE,
        w!("EDIT"),
        w!(""),
        WS_CHILD
            | WS_VISIBLE
            | WS_TABSTOP
            | WS_BORDER
            | WINDOW_STYLE((ES_AUTOHSCROLL | ES_PASSWORD) as u32),
        320,
        306,
        205,
        25,
        hwnd,
        ID_API_KEY,
        instance,
    )?;

    let save_provider = create_control(
        WINDOW_EX_STYLE(0),
        w!("BUTTON"),
        w!("Save"),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP,
        535,
        304,
        70,
        29,
        hwnd,
        ID_SAVE_PROVIDER as isize,
        instance,
    )?;
    let remove_key = create_control(
        WINDOW_EX_STYLE(0),
        w!("BUTTON"),
        w!("Remove key"),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP,
        610,
        304,
        90,
        29,
        hwnd,
        ID_REMOVE_KEY as isize,
        instance,
    )?;

    let result_label = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Review result"),
        WS_CHILD | WS_VISIBLE,
        20,
        347,
        200,
        20,
        hwnd,
        0,
        instance,
    )?;

    let result = create_control(
        WS_EX_CLIENTEDGE,
        w!("EDIT"),
        w!(""),
        WS_CHILD
            | WS_VISIBLE
            | WS_TABSTOP
            | WS_BORDER
            | WS_VSCROLL
            | WINDOW_STYLE((ES_MULTILINE | ES_AUTOVSCROLL | ES_WANTRETURN | ES_READONLY) as u32),
        20,
        368,
        680,
        145,
        hwnd,
        ID_RESULT,
        instance,
    )?;

    let copy = create_control(
        WINDOW_EX_STYLE(0),
        w!("BUTTON"),
        w!("Copy result"),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP,
        20,
        525,
        120,
        32,
        hwnd,
        ID_COPY as isize,
        instance,
    )?;

    let hide = create_control(
        WINDOW_EX_STYLE(0),
        w!("BUTTON"),
        w!("Hide"),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP,
        150,
        525,
        90,
        32,
        hwnd,
        ID_HIDE as isize,
        instance,
    )?;

    let status = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Starting SwiftSlate…"),
        WS_CHILD | WS_VISIBLE,
        20,
        571,
        680,
        55,
        hwnd,
        0,
        instance,
    )?;

    let font = GetStockObject(DEFAULT_GUI_FONT);
    for control in [
        intro,
        original_label,
        original,
        ai_improve,
        local_preview,
        provider_label,
        endpoint_label,
        endpoint,
        model_label,
        model,
        key_label,
        api_key,
        save_provider,
        remove_key,
        result_label,
        result,
        copy,
        hide,
        status,
    ] {
        SendMessageW(control, WM_SETFONT, WPARAM(font.0 as usize), LPARAM(1));
    }
    SendMessageW(original, EM_SETLIMITTEXT, WPARAM(32_768), LPARAM(0));
    SendMessageW(result, EM_SETLIMITTEXT, WPARAM(32_768), LPARAM(0));
    SendMessageW(endpoint, EM_SETLIMITTEXT, WPARAM(2_048), LPARAM(0));
    SendMessageW(model, EM_SETLIMITTEXT, WPARAM(128), LPARAM(0));
    SendMessageW(api_key, EM_SETLIMITTEXT, WPARAM(2_560), LPARAM(0));

    let hotkey_registered =
        RegisterHotKey(hwnd, HOTKEY_ID, HOTKEY_MODIFIERS, VK_SPACE.0 as u32).is_ok();

    let raw_input = RAWINPUTDEVICE {
        usUsagePage: 0x01,
        usUsage: 0x06,
        dwFlags: RIDEV_INPUTSINK,
        hwndTarget: hwnd,
    };
    let raw_input_registered =
        RegisterRawInputDevices(&[raw_input], size_of::<RAWINPUTDEVICE>() as u32).is_ok();
    let selection_worker = SelectionWorker::start(hwnd).ok();
    let provider_worker = ProviderWorker::start(hwnd).ok();

    UI.with(|slot| {
        *slot.borrow_mut() = Some(UiState {
            original,
            result,
            endpoint,
            model,
            api_key,
            status,
            raw_key_down_events: 0,
            hotkey_registered,
            raw_input_registered,
            selection_worker,
            latest_capture_id: 0,
            capture_pending: false,
            provider_worker,
            latest_provider_id: 0,
            provider_busy: false,
            provider_response_expected: false,
            provider_source: String::new(),
            consented_provider: None,
        });
    });

    refresh_startup_status();
    let _ = SetFocus(original);
    Ok(())
}

#[allow(clippy::too_many_arguments)]
unsafe fn create_control(
    extended_style: WINDOW_EX_STYLE,
    class_name: PCWSTR,
    text: PCWSTR,
    style: WINDOW_STYLE,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    parent: HWND,
    id: isize,
    instance: HINSTANCE,
) -> windows::core::Result<HWND> {
    let menu = if id == 0 {
        HMENU::default()
    } else {
        HMENU(id as *mut c_void)
    };
    CreateWindowExW(
        extended_style,
        class_name,
        text,
        style,
        x,
        y,
        width,
        height,
        parent,
        menu,
        instance,
        None,
    )
}

unsafe fn begin_selection_capture(hwnd: HWND) {
    let source_window = GetForegroundWindow();
    if source_window.is_invalid() || source_window == hwnd {
        show_palette_from_clipboard(
            hwnd,
            "No external text field was focused; loaded the existing clipboard as fallback.",
        );
        return;
    }

    let sent = UI.with(|slot| {
        let mut state = slot.borrow_mut();
        let Some(state) = state.as_mut() else {
            return false;
        };
        state.latest_capture_id = state.latest_capture_id.wrapping_add(1).max(1);
        state.capture_pending = true;
        set_text(
            state.status,
            "Inspecting the selected text with UI Automation…",
        );
        state.selection_worker.as_ref().is_some_and(|worker| {
            worker
                .request(state.latest_capture_id, source_window)
                .is_ok()
        })
    });

    if sent && SetTimer(hwnd, CAPTURE_TIMER_ID, CAPTURE_TIMEOUT_MS, None) != 0 {
        return;
    }

    UI.with(|slot| {
        if let Some(state) = slot.borrow_mut().as_mut() {
            state.capture_pending = false;
        }
    });
    show_empty_palette(
        hwnd,
        "UI Automation is unavailable. Nothing was captured; paste text manually if needed.",
    );
}

unsafe fn finish_selection_capture(hwnd: HWND) {
    let responses = UI.with(|slot| {
        slot.borrow()
            .as_ref()
            .and_then(|state| state.selection_worker.as_ref())
            .map(SelectionWorker::try_responses)
            .unwrap_or_default()
    });

    for response in responses {
        let accepted = UI.with(|slot| {
            let mut state = slot.borrow_mut();
            let Some(state) = state.as_mut() else {
                return false;
            };
            if !state.capture_pending || response.request_id != state.latest_capture_id {
                return false;
            }
            state.capture_pending = false;
            true
        });
        if !accepted {
            continue;
        }

        let _ = KillTimer(hwnd, CAPTURE_TIMER_ID);
        match response.outcome {
            CaptureOutcome::Selected(text) => show_text_palette(
                hwnd,
                &text,
                "Selection captured with UI Automation. Review it before continuing.",
            ),
            CaptureOutcome::Empty => show_empty_palette(
                hwnd,
                "The focused control has no selected text. Select text and try again.",
            ),
            CaptureOutcome::Protected => show_empty_palette(
                hwnd,
                "SwiftSlate is disabled for password or protected fields. Nothing was captured.",
            ),
            CaptureOutcome::Unsupported => show_palette_from_clipboard(
                hwnd,
                "This control does not expose text selection; loaded the existing clipboard as fallback.",
            ),
            CaptureOutcome::TargetChanged => show_empty_palette(
                hwnd,
                "Focus changed while SwiftSlate inspected the selection. Nothing was captured.",
            ),
            CaptureOutcome::TooLarge => show_empty_palette(
                hwnd,
                "The selection is too large or fragmented for the safe capture limit.",
            ),
            CaptureOutcome::Unavailable => show_palette_from_clipboard(
                hwnd,
                "UI Automation could not read this control; loaded the existing clipboard as fallback.",
            ),
        }
    }
}

unsafe fn selection_capture_timed_out(hwnd: HWND) {
    let timed_out = UI.with(|slot| {
        let mut state = slot.borrow_mut();
        let Some(state) = state.as_mut() else {
            return false;
        };
        if !state.capture_pending {
            return false;
        }
        state.capture_pending = false;
        true
    });
    if timed_out {
        let _ = KillTimer(hwnd, CAPTURE_TIMER_ID);
        show_empty_palette(
            hwnd,
            "Selection inspection timed out. Nothing was captured from the target application.",
        );
    }
}

unsafe fn show_text_palette(hwnd: HWND, text: &str, status: &str) {
    let _ = KillTimer(hwnd, PROVIDER_TIMER_ID);
    UI.with(|slot| {
        let mut state = slot.borrow_mut();
        let Some(state) = state.as_mut() else {
            return;
        };
        state.provider_response_expected = false;
        state.provider_source.clear();
        set_text(state.original, text);
        set_text(state.result, "");
        set_text(
            state.status,
            &format!(
                "{status} Raw Input observed {} key-down events; no keys were stored.",
                state.raw_key_down_events
            ),
        );
        show_and_focus(hwnd, state.original);
    });
}

unsafe fn show_empty_palette(hwnd: HWND, status: &str) {
    show_text_palette(hwnd, "", status);
}

unsafe fn show_palette_from_clipboard(hwnd: HWND, status: &str) {
    let _ = KillTimer(hwnd, PROVIDER_TIMER_ID);
    UI.with(|slot| {
        let mut state = slot.borrow_mut();
        let Some(state) = state.as_mut() else {
            return;
        };
        state.provider_response_expected = false;
        state.provider_source.clear();
        set_text(state.original, "");
        SendMessageW(state.original, WM_PASTE, WPARAM(0), LPARAM(0));
        set_text(state.result, "");
        let message = if get_text(state.original).trim().is_empty() {
            format!("{status} The clipboard has no plain text.")
        } else {
            format!("{status} Verify that it is the intended selection.")
        };
        set_text(state.status, &message);
        show_and_focus(hwnd, state.original);
    });
}

unsafe fn show_and_focus(hwnd: HWND, control: HWND) {
    let _ = ShowWindow(hwnd, SW_RESTORE);
    let _ = SetForegroundWindow(hwnd);
    let _ = SetFocus(control);
}

unsafe fn run_local_preview(hwnd: HWND) {
    let _ = KillTimer(hwnd, PROVIDER_TIMER_ID);
    UI.with(|slot| {
        let mut state = slot.borrow_mut();
        let Some(state) = state.as_mut() else {
            return;
        };
        state.provider_response_expected = false;
        state.provider_source.clear();
        let original = get_text(state.original);
        let result = improve_preview(&original);
        set_text(state.result, &result);
        if result.is_empty() {
            set_text(
                state.status,
                "Enter or paste text before running the preview.",
            );
        } else {
            set_text(
                state.status,
                "Local preview complete. No data was sent over the network.",
            );
        }
    });
}

unsafe fn save_provider_settings() {
    let snapshot = UI.with(|slot| {
        let state = slot.borrow();
        let state = state.as_ref()?;
        Some((
            get_text(state.endpoint),
            get_text(state.model),
            get_text(state.api_key),
            state.api_key,
            state.status,
        ))
    });
    let Some((endpoint, model, key, key_control, status_control)) = snapshot else {
        return;
    };
    let config = match ProviderConfig::new(endpoint, model) {
        Ok(config) => config,
        Err(error) => {
            set_text(status_control, &error.to_string());
            return;
        }
    };
    if let Err(error) = save_provider_config(&config) {
        set_text(status_control, &error);
        return;
    }

    if key.is_empty() {
        set_text(
            status_control,
            "Provider endpoint and model saved. The existing host-scoped API key was unchanged.",
        );
        return;
    }
    let target = match config.credential_target() {
        Ok(target) => target,
        Err(error) => {
            set_text(status_control, &error.to_string());
            return;
        }
    };
    let mut key = key.into_bytes();
    let saved = save_api_key(&target, &mut key);
    key.fill(0);
    match saved {
        Ok(()) => {
            set_text(key_control, "");
            set_text(
                status_control,
                "Provider settings saved. The API key is in Windows Credential Manager, not the registry.",
            );
        }
        Err(error) => set_text(status_control, &error),
    }
}

unsafe fn remove_provider_key() {
    let snapshot = UI.with(|slot| {
        let state = slot.borrow();
        let state = state.as_ref()?;
        Some((
            get_text(state.endpoint),
            get_text(state.model),
            state.api_key,
            state.status,
        ))
    });
    let Some((endpoint, model, key_control, status_control)) = snapshot else {
        return;
    };
    let config = match ProviderConfig::new(endpoint, model) {
        Ok(config) => config,
        Err(error) => {
            set_text(status_control, &error.to_string());
            return;
        }
    };
    let target = match config.credential_target() {
        Ok(target) => target,
        Err(error) => {
            set_text(status_control, &error.to_string());
            return;
        }
    };
    match delete_api_key(&target) {
        Ok(()) => {
            set_text(key_control, "");
            set_text(
                status_control,
                "The API key for this provider host was removed from Credential Manager.",
            );
        }
        Err(error) => set_text(status_control, &error),
    }
}

unsafe fn begin_provider_request(hwnd: HWND) {
    let snapshot = UI.with(|slot| {
        let state = slot.borrow();
        let state = state.as_ref()?;
        if state.provider_busy {
            set_text(
                state.status,
                "The previous provider network operation is still finishing. Please wait.",
            );
            return None;
        }
        Some((
            get_text(state.endpoint),
            get_text(state.model),
            get_text(state.api_key),
            get_text(state.original),
            state.provider_worker.is_some(),
            state.status,
        ))
    });
    let Some((endpoint, model, unsaved_key, source, worker_available, status_control)) = snapshot
    else {
        return;
    };
    if !worker_available {
        set_text(
            status_control,
            "The provider worker is unavailable; no network request was made.",
        );
        return;
    }
    if source.trim().is_empty() {
        set_text(status_control, "Enter or capture text before requesting an improvement.");
        return;
    }
    if !unsaved_key.is_empty() {
        set_text(
            status_control,
            "Save the provider settings and API key before making a request.",
        );
        return;
    }
    let config = match ProviderConfig::new(endpoint, model) {
        Ok(config) => config,
        Err(error) => {
            set_text(status_control, &error.to_string());
            return;
        }
    };
    let target = match config.credential_target() {
        Ok(target) => target,
        Err(error) => {
            set_text(status_control, &error.to_string());
            return;
        }
    };
    match read_api_key(&target) {
        Ok(Some(_)) => {}
        Ok(None) => {
            set_text(
                status_control,
                "No API key is saved for this provider host. Enter it and choose Save.",
            );
            return;
        }
        Err(error) => {
            set_text(status_control, &error);
            return;
        }
    }

    let consent_key = config.consent_key();
    let already_consented = UI.with(|slot| {
        slot.borrow()
            .as_ref()
            .and_then(|state| state.consented_provider.as_ref())
            == Some(&consent_key)
    });
    if !already_consented {
        let consent = wide(&format!(
            "Send the current Original text and a fixed editing instruction to:\n\n{}\n\nModel: {}\n\nThe API key remains in Windows Credential Manager. The result will only be shown for review; SwiftSlate will not replace text automatically.\n\nAllow requests to this endpoint and model for this session?",
            config.endpoint, config.model
        ));
        let choice = MessageBoxW(
            hwnd,
            PCWSTR(consent.as_ptr()),
            w!("SwiftSlate network consent"),
            MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2,
        );
        if choice != IDYES {
            set_text(status_control, "Consent was not granted. Nothing was sent.");
            return;
        }
        UI.with(|slot| {
            if let Some(state) = slot.borrow_mut().as_mut() {
                state.consented_provider = Some(consent_key);
            }
        });
    }

    let sent = UI.with(|slot| {
        let mut state = slot.borrow_mut();
        let Some(state) = state.as_mut() else {
            return false;
        };
        state.latest_provider_id = state.latest_provider_id.wrapping_add(1).max(1);
        let request_id = state.latest_provider_id;
        let sent = state
            .provider_worker
            .as_ref()
            .is_some_and(|worker| worker.request(request_id, config, source.clone()).is_ok());
        if sent {
            state.provider_busy = true;
            state.provider_response_expected = true;
            state.provider_source = source;
            set_text(state.result, "");
            set_text(
                state.status,
                "Waiting for the provider on a background worker. Selected text is not logged.",
            );
        }
        sent
    });
    if !sent {
        set_text(status_control, "Could not queue the provider request. Nothing was sent.");
        return;
    }
    if SetTimer(hwnd, PROVIDER_TIMER_ID, PROVIDER_TIMEOUT_MS, None) == 0 {
        set_text(
            status_control,
            "The request is running, but the UI timeout could not be started.",
        );
    }
}

unsafe fn finish_provider_request(hwnd: HWND) {
    let responses = UI.with(|slot| {
        slot.borrow()
            .as_ref()
            .and_then(|state| state.provider_worker.as_ref())
            .map(ProviderWorker::try_responses)
            .unwrap_or_default()
    });

    for response in responses {
        let action = UI.with(|slot| {
            let mut state = slot.borrow_mut();
            let state = state.as_mut()?;
            if !state.provider_busy || response.request_id != state.latest_provider_id {
                return None;
            }
            state.provider_busy = false;
            if !state.provider_response_expected {
                return None;
            }
            state.provider_response_expected = false;
            let source_unchanged = get_text(state.original) == state.provider_source;
            state.provider_source.clear();
            Some((source_unchanged, state.result, state.status))
        });
        let Some((source_unchanged, result_control, status_control)) = action else {
            continue;
        };
        let _ = KillTimer(hwnd, PROVIDER_TIMER_ID);
        if !source_unchanged {
            set_text(
                status_control,
                "The original text changed while the request was running. The stale response was discarded.",
            );
            continue;
        }
        match response.result {
            Ok(result) => {
                set_text(result_control, &result);
                set_text(
                    status_control,
                    "Provider response ready. Review it, then explicitly choose Copy result.",
                );
            }
            Err(error) => set_text(status_control, &error),
        }
    }
}

unsafe fn provider_request_timed_out(hwnd: HWND) {
    let timed_out = UI.with(|slot| {
        let mut state = slot.borrow_mut();
        let Some(state) = state.as_mut() else {
            return false;
        };
        if !state.provider_response_expected {
            return false;
        }
        state.provider_response_expected = false;
        state.provider_source.clear();
        set_text(
            state.status,
            "The provider request exceeded the UI wait limit. Any late response will be discarded.",
        );
        true
    });
    if timed_out {
        let _ = KillTimer(hwnd, PROVIDER_TIMER_ID);
    }
}

unsafe fn copy_result() {
    UI.with(|slot| {
        let state = slot.borrow();
        let Some(state) = state.as_ref() else {
            return;
        };
        if get_text(state.result).is_empty() {
            set_text(state.status, "There is no result to copy.");
            return;
        }
        SendMessageW(state.result, EM_SETSEL, WPARAM(0), LPARAM(-1));
        SendMessageW(state.result, WM_COPY, WPARAM(0), LPARAM(0));
        set_text(
            state.status,
            "Result copied. Paste it only after reviewing it.",
        );
    });
}

unsafe fn refresh_startup_status() {
    UI.with(|slot| {
        let state = slot.borrow();
        let Some(state) = state.as_ref() else {
            return;
        };
        let message = match (
            state.hotkey_registered,
            state.raw_input_registered,
            state.selection_worker.is_some(),
            state.provider_worker.is_some(),
        ) {
            (true, true, true, true) => {
                "Ready: protected selection capture and the background provider worker are active."
            }
            (false, _, _, _) => {
                "Ctrl+Alt+Space is already used by another application; the global hotkey is unavailable."
            }
            (_, false, _, _) => "The global hotkey is active, but Raw Input registration failed.",
            (_, _, false, _) => {
                "UI Automation is unavailable; selection capture will use an explicit clipboard fallback."
            }
            (_, _, _, false) => {
                "The provider worker is unavailable; local preview and selection capture remain active."
            }
        };
        set_text(state.status, message);
    });
}

unsafe fn get_text(hwnd: HWND) -> String {
    let length = GetWindowTextLengthW(hwnd).max(0) as usize;
    let mut buffer = vec![0u16; length + 1];
    let written = GetWindowTextW(hwnd, &mut buffer).max(0) as usize;
    String::from_utf16_lossy(&buffer[..written])
}

unsafe fn set_text(hwnd: HWND, text: &str) {
    let text = wide(text);
    let _ = SetWindowTextW(hwnd, PCWSTR(text.as_ptr()));
}

unsafe fn raw_key_down(lparam: LPARAM) -> bool {
    let mut raw = RAWINPUT::default();
    let mut size = size_of::<RAWINPUT>() as u32;
    let read = GetRawInputData(
        HRAWINPUT(lparam.0 as *mut c_void),
        RID_INPUT,
        Some((&mut raw as *mut RAWINPUT).cast()),
        &mut size,
        size_of::<RAWINPUTHEADER>() as u32,
    );
    read != u32::MAX
        && read >= size_of::<RAWINPUT>() as u32
        && raw.header.dwType == RIM_TYPEKEYBOARD.0
        && raw.data.keyboard.Flags & RI_KEY_BREAK == 0
}

unsafe fn shut_down(hwnd: HWND) {
    let _ = KillTimer(hwnd, CAPTURE_TIMER_ID);
    let _ = KillTimer(hwnd, PROVIDER_TIMER_ID);
    UI.with(|slot| {
        {
            let state = slot.borrow();
            if let Some(state) = state.as_ref() {
                if state.hotkey_registered {
                    let _ = UnregisterHotKey(hwnd, HOTKEY_ID);
                }
                if state.raw_input_registered {
                    let removal = RAWINPUTDEVICE {
                        usUsagePage: 0x01,
                        usUsage: 0x06,
                        dwFlags: RIDEV_REMOVE,
                        hwndTarget: HWND::default(),
                    };
                    let _ = RegisterRawInputDevices(&[removal], size_of::<RAWINPUTDEVICE>() as u32);
                }
                if let Some(worker) = state.selection_worker.as_ref() {
                    worker.stop();
                }
                if let Some(worker) = state.provider_worker.as_ref() {
                    worker.stop();
                }
            }
        }
        *slot.borrow_mut() = None;
    });
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}
