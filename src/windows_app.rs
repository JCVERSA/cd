//! Minimal native Win32 shell for the first SwiftSlate prototype.
//!
//! The shell validates three architectural assumptions without introducing a
//! web runtime: a global hotkey, background Raw Input registration, and a native
//! review-before-copy workflow. It deliberately does not call an AI service yet.

use std::cell::RefCell;
use std::ffi::c_void;
use std::mem::size_of;
use std::panic::{catch_unwind, AssertUnwindSafe};

use swiftslate::preview::improve_preview;
use windows::core::{w, Error, PCWSTR};
use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{GetStockObject, GetSysColorBrush, COLOR_WINDOW, DEFAULT_GUI_FONT};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, SetFocus, UnregisterHotKey, HOT_KEY_MODIFIERS, VK_SPACE,
};
use windows::Win32::UI::Input::{
    GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE, RAWINPUTHEADER,
    RIDEV_INPUTSINK, RIDEV_REMOVE, RID_INPUT, RIM_TYPEKEYBOARD,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
    GetWindowTextLengthW, GetWindowTextW, HMENU, IDC_ARROW, LoadCursorW, MB_ICONERROR, MB_OK,
    MSG, MessageBoxW, PostQuitMessage, RegisterClassW, SendMessageW, SetForegroundWindow,
    SetWindowTextW, ShowWindow, TranslateMessage, WINDOW_EX_STYLE, WINDOW_STYLE, WM_CLOSE,
    WM_COMMAND, WM_COPY, WM_CREATE, WM_DESTROY, WM_HOTKEY, WM_INPUT, WM_PASTE, WM_SETFONT,
    WNDCLASSW, WS_BORDER, WS_CAPTION, WS_CHILD, WS_EX_CLIENTEDGE, WS_MINIMIZEBOX,
    WS_OVERLAPPED, WS_SYSMENU, WS_TABSTOP, WS_VISIBLE, WS_VSCROLL, BS_DEFPUSHBUTTON,
    ES_AUTOVSCROLL, ES_MULTILINE, ES_READONLY, ES_WANTRETURN, SW_HIDE, SW_RESTORE,
    SW_SHOWNORMAL,
};

const CLASS_NAME: PCWSTR = w!("SwiftSlatePrototypeWindow");
const WINDOW_TITLE: PCWSTR = w!("SwiftSlate Prototype");
const HOTKEY_ID: i32 = 0x5353;
const HOTKEY_MODIFIERS: HOT_KEY_MODIFIERS = HOT_KEY_MODIFIERS(0x0001 | 0x0002 | 0x4000);

const ID_ORIGINAL: isize = 101;
const ID_RESULT: isize = 102;
const ID_IMPROVE: usize = 201;
const ID_COPY: usize = 202;
const ID_HIDE: usize = 203;

// EM_SETSEL is stable across supported Windows versions and does not require
// loading the broader common-controls API surface.
const EM_SETSEL: u32 = 0x00B1;
const RI_KEY_BREAK: u16 = 0x0001;

struct UiState {
    original: HWND,
    result: HWND,
    status: HWND,
    raw_key_down_events: u64,
    hotkey_registered: bool,
    raw_input_registered: bool,
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
            720,
            610,
            None,
            None,
            instance,
            None,
        )?;

        ShowWindow(hwnd, SW_SHOWNORMAL);
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

unsafe fn window_proc_inner(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match message {
        WM_CREATE => {
            if let Err(error) = initialize_window(hwnd) {
                let text = wide(&format!("The prototype UI could not be initialized.\n\n{error}"));
                MessageBoxW(
                    Some(hwnd),
                    PCWSTR(text.as_ptr()),
                    WINDOW_TITLE,
                    MB_OK | MB_ICONERROR,
                );
                return LRESULT(-1);
            }
            LRESULT(0)
        }
        WM_HOTKEY if wparam.0 as i32 == HOTKEY_ID => {
            show_palette(hwnd);
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
                ID_IMPROVE => run_local_preview(),
                ID_COPY => copy_result(),
                ID_HIDE => {
                    ShowWindow(hwnd, SW_HIDE);
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

    let intro = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Copy text, then press Ctrl+Alt+Space from any app to open SwiftSlate."),
        WS_CHILD | WS_VISIBLE,
        20,
        16,
        665,
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
        51,
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
        73,
        665,
        155,
        hwnd,
        ID_ORIGINAL,
        instance,
    )?;

    let improve = create_control(
        WINDOW_EX_STYLE(0),
        w!("BUTTON"),
        w!("Improve (local preview)"),
        WS_CHILD | WS_VISIBLE | WS_TABSTOP | WINDOW_STYLE(BS_DEFPUSHBUTTON as u32),
        20,
        239,
        190,
        34,
        hwnd,
        ID_IMPROVE as isize,
        instance,
    )?;

    let result_label = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Review result"),
        WS_CHILD | WS_VISIBLE,
        20,
        287,
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
            | WINDOW_STYLE(
                (ES_MULTILINE | ES_AUTOVSCROLL | ES_WANTRETURN | ES_READONLY) as u32,
            ),
        20,
        309,
        665,
        155,
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
        478,
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
        478,
        90,
        32,
        hwnd,
        ID_HIDE as isize,
        instance,
    )?;

    let status = create_control(
        WINDOW_EX_STYLE(0),
        w!("STATIC"),
        w!("Local prototype: no network requests and no text history."),
        WS_CHILD | WS_VISIBLE,
        20,
        524,
        665,
        25,
        hwnd,
        0,
        instance,
    )?;

    let font = GetStockObject(DEFAULT_GUI_FONT);
    for control in [
        intro,
        original_label,
        original,
        improve,
        result_label,
        result,
        copy,
        hide,
        status,
    ] {
        SendMessageW(
            control,
            WM_SETFONT,
            WPARAM(font.0 as usize),
            LPARAM(1),
        );
    }

    let hotkey_registered = RegisterHotKey(
        Some(hwnd),
        HOTKEY_ID,
        HOTKEY_MODIFIERS,
        VK_SPACE.0 as u32,
    )
    .is_ok();

    let raw_input = RAWINPUTDEVICE {
        usUsagePage: 0x01,
        usUsage: 0x06,
        dwFlags: RIDEV_INPUTSINK,
        hwndTarget: hwnd,
    };
    let raw_input_registered =
        RegisterRawInputDevices(&[raw_input], size_of::<RAWINPUTDEVICE>() as u32).is_ok();

    UI.with(|slot| {
        *slot.borrow_mut() = Some(UiState {
            original,
            result,
            status,
            raw_key_down_events: 0,
            hotkey_registered,
            raw_input_registered,
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
        None
    } else {
        Some(HMENU(id as *mut c_void))
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
        Some(parent),
        menu,
        instance,
        None,
    )
}

unsafe fn show_palette(hwnd: HWND) {
    UI.with(|slot| {
        let state = slot.borrow();
        let Some(state) = state.as_ref() else {
            return;
        };

        let _ = SetWindowTextW(state.original, w!(""));
        SendMessageW(state.original, WM_PASTE, WPARAM(0), LPARAM(0));
        let _ = SetWindowTextW(state.result, w!(""));

        let status = if get_text(state.original).trim().is_empty() {
            format!(
                "Clipboard has no plain text. Raw Input observed {} key-down events; no text was stored.",
                state.raw_key_down_events
            )
        } else {
            format!(
                "Clipboard loaded. Raw Input observed {} key-down events; no text was stored.",
                state.raw_key_down_events
            )
        };
        set_text(state.status, &status);
        ShowWindow(hwnd, SW_RESTORE);
        let _ = SetForegroundWindow(hwnd);
        let _ = SetFocus(state.original);
    });
}

unsafe fn run_local_preview() {
    UI.with(|slot| {
        let state = slot.borrow();
        let Some(state) = state.as_ref() else {
            return;
        };
        let original = get_text(state.original);
        let result = improve_preview(&original);
        set_text(state.result, &result);
        if result.is_empty() {
            set_text(state.status, "Enter or paste text before running the preview.");
        } else {
            set_text(
                state.status,
                "Local preview complete. No data was sent over the network.",
            );
        }
    });
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
        set_text(state.status, "Result copied. Paste it only after reviewing it.");
    });
}

unsafe fn refresh_startup_status() {
    UI.with(|slot| {
        let state = slot.borrow();
        let Some(state) = state.as_ref() else {
            return;
        };
        let message = match (state.hotkey_registered, state.raw_input_registered) {
            (true, true) => "Ready: global hotkey and privacy-bounded Raw Input are active.",
            (false, true) => {
                "Raw Input is active, but Ctrl+Alt+Space is already used by another application."
            }
            (true, false) => "Global hotkey is active, but Raw Input registration failed.",
            (false, false) => "Global hotkey and Raw Input registration both failed.",
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
    UI.with(|slot| {
        if let Some(state) = slot.borrow().as_ref() {
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
                let _ = RegisterRawInputDevices(
                    &[removal],
                    size_of::<RAWINPUTDEVICE>() as u32,
                );
            }
        }
        *slot.borrow_mut() = None;
    });
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}
