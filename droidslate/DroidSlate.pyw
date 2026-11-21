"""
DroidSlate
A lightweight Android Debug Bridge (ADB) desktop tool for Windows.
https://github.com/JCVERSA/cd/tree/arena/33e46336-cd/droidslate
"""

import collections
import ctypes
import ctypes.wintypes as wt
import os
import subprocess  # nosec B404 - Required for the isolated UI child process.
import sys
import tempfile
import threading
import time
import urllib.parse

from dashboard_server import DroidSlateBackend, create_dashboard_server

# --- Win32 constants ---
WM_DESTROY = 0x0002
WS_OVERLAPPEDWINDOW = 0x00CF0000
CW_USEDEFAULT = -2147483648  # 0x80000000 as signed c_int
IMAGE_ICON = 1
LR_LOADFROMFILE = 0x00000010
IDC_ARROW = 32512

# Notification constants
NIM_ADD = 0x00000000
NIM_MODIFY = 0x00000001
NIM_DELETE = 0x00000002
NIM_SETVERSION = 0x00000004
NIF_MESSAGE = 0x00000001
NIF_ICON = 0x00000002
NIF_TIP = 0x00000004
NIF_INFO = 0x00000010
NIF_SHOWTIP = 0x00000080
NIIF_INFO = 0x00000001
NIIF_ERROR = 0x00000003
NIIF_NOSOUND = 0x00000010
NOTIFYICON_VERSION_4 = 4
WM_TRAYICON = 0x8001
WM_OPEN_DASHBOARD = 0x8002
WM_CONTEXTMENU = 0x007B
WM_LBUTTONUP = 0x0202
WM_LBUTTONDBLCLK = 0x0203
WM_RBUTTONUP = 0x0205
NIN_SELECT = 0x0400
NIN_KEYSELECT = 0x0401
TPM_RETURNCMD = 0x0100
TPM_RIGHTBUTTON = 0x0002
MF_STRING = 0x0000
MF_SEPARATOR = 0x00000800
MENU_ID_OPEN = 1000
MENU_ID_EXIT = 1001

# --- Win32 API ---
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shell32 = ctypes.windll.shell32

# Pointer-sized types for 64-bit correctness
LRESULT = wt.LPARAM  # LRESULT is pointer-sized (8 bytes on x64)
ULONG_PTR = wt.WPARAM  # ULONG_PTR is pointer-sized

user32.SetForegroundWindow.argtypes = [wt.HWND]
user32.SetForegroundWindow.restype = wt.BOOL
user32.FindWindowW.argtypes = [wt.LPCWSTR, wt.LPCWSTR]
user32.FindWindowW.restype = wt.HWND
user32.PostMessageW.argtypes = [wt.HWND, wt.UINT, wt.WPARAM, wt.LPARAM]
user32.PostMessageW.restype = wt.BOOL
user32.GetCursorPos.argtypes = [ctypes.POINTER(wt.POINT)]
user32.GetCursorPos.restype = wt.BOOL
user32.CreatePopupMenu.restype = wt.HANDLE
user32.AppendMenuW.argtypes = [wt.HANDLE, wt.UINT, ULONG_PTR, wt.LPCWSTR]
user32.AppendMenuW.restype = wt.BOOL
user32.TrackPopupMenu.argtypes = [wt.HANDLE, wt.UINT, ctypes.c_int, ctypes.c_int,
                                  ctypes.c_int, wt.HWND, wt.LPVOID]
user32.TrackPopupMenu.restype = wt.UINT
user32.DestroyMenu.argtypes = [wt.HANDLE]
user32.DestroyMenu.restype = wt.BOOL
user32.DestroyWindow.argtypes = [wt.HWND]
user32.DestroyWindow.restype = wt.BOOL
user32.CreateWindowExW.argtypes = [wt.DWORD, wt.LPCWSTR, wt.LPCWSTR, wt.DWORD,
                                   ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                   wt.HWND, wt.HMENU, wt.HINSTANCE, wt.LPVOID]
user32.CreateWindowExW.restype = wt.HWND
user32.DefWindowProcW.argtypes = [wt.HWND, wt.UINT, wt.WPARAM, wt.LPARAM]
user32.DefWindowProcW.restype = LRESULT
user32.RegisterClassExW.argtypes = [ctypes.c_void_p]
user32.RegisterClassExW.restype = wt.ATOM
user32.LoadImageW.argtypes = [wt.HINSTANCE, wt.LPCWSTR, wt.UINT, ctypes.c_int, ctypes.c_int, wt.UINT]
user32.LoadImageW.restype = wt.HANDLE
user32.LoadCursorW.argtypes = [wt.HINSTANCE, ctypes.c_void_p]
user32.LoadCursorW.restype = wt.HANDLE
user32.DestroyIcon.argtypes = [wt.HICON]
user32.DestroyIcon.restype = wt.BOOL
user32.GetMessageW.argtypes = [ctypes.POINTER(wt.MSG), wt.HWND, wt.UINT, wt.UINT]
user32.GetMessageW.restype = wt.BOOL
user32.TranslateMessage.argtypes = [ctypes.POINTER(wt.MSG)]
user32.TranslateMessage.restype = wt.BOOL
user32.DispatchMessageW.argtypes = [ctypes.POINTER(wt.MSG)]
user32.DispatchMessageW.restype = LRESULT
user32.PostQuitMessage.argtypes = [ctypes.c_int]
user32.PostQuitMessage.restype = None
kernel32.GetModuleHandleW.argtypes = [wt.LPCWSTR]
kernel32.GetModuleHandleW.restype = wt.HMODULE
kernel32.CreateMutexW.argtypes = [wt.LPVOID, wt.BOOL, wt.LPCWSTR]
kernel32.CreateMutexW.restype = wt.HANDLE
kernel32.GetLastError.argtypes = []
kernel32.GetLastError.restype = wt.DWORD
kernel32.CloseHandle.argtypes = [wt.HANDLE]
kernel32.CloseHandle.restype = wt.BOOL
user32.LoadIconW.argtypes = [wt.HINSTANCE, wt.LPCWSTR]
user32.LoadIconW.restype = wt.HICON


class GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wt.DWORD),
        ("Data2", wt.WORD),
        ("Data3", wt.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class NOTIFYICONDATAW(ctypes.Structure):
    _fields_ = [
        ("cbSize", wt.DWORD),
        ("hWnd", wt.HWND),
        ("uID", wt.UINT),
        ("uFlags", wt.UINT),
        ("uCallbackMessage", wt.UINT),
        ("hIcon", wt.HICON),
        ("szTip", wt.WCHAR * 128),
        ("dwState", wt.DWORD),
        ("dwStateMask", wt.DWORD),
        ("szInfo", wt.WCHAR * 256),
        ("uVersion", wt.UINT),
        ("szInfoTitle", wt.WCHAR * 64),
        ("dwInfoFlags", wt.DWORD),
        ("guidItem", GUID),
        ("hBalloonIcon", wt.HICON),
    ]


shell32.Shell_NotifyIconW.argtypes = [wt.DWORD, ctypes.POINTER(NOTIFYICONDATAW)]
shell32.Shell_NotifyIconW.restype = wt.BOOL


class WNDCLASSEXW(ctypes.Structure):
    _fields_ = [
        ("cbSize", wt.UINT), ("style", wt.UINT), ("lpfnWndProc", ctypes.WINFUNCTYPE(LRESULT, wt.HWND, wt.UINT, wt.WPARAM, wt.LPARAM)),
        ("cbClsExtra", ctypes.c_int), ("cbWndExtra", ctypes.c_int),
        ("hInstance", wt.HINSTANCE), ("hIcon", wt.HICON), ("hCursor", wt.HANDLE),
        ("hbrBackground", wt.HBRUSH), ("lpszMenuName", wt.LPCWSTR),
        ("lpszClassName", wt.LPCWSTR), ("hIconSm", wt.HICON),
    ]


# --- Globals ---
script_dir = os.path.dirname(os.path.abspath(__file__))
resource_dir = getattr(sys, "_MEIPASS", script_dir)
# Source checkouts keep their existing adjacent files. Frozen installations use a
# writable, upgrade-safe per-user data directory instead of writing into Program Files.
data_dir = (os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "DroidSlate")
            if getattr(sys, "frozen", False) else script_dir)
hwnd_main = None
_large_app_icon = None
_small_app_icon = None

# --- Debug & Logging ---
debug_mode = "--debug" in sys.argv
log_file = None
log_records = collections.deque(maxlen=200)


def log(msg):
    """Keep a bounded runtime log; write it to disk only in debug mode."""
    ts = time.strftime("%H:%M:%S", time.localtime()) + f".{int(time.time()*1000)%1000:03d}"
    message = str(msg)
    log_records.append({"time": ts, "level": "INFO", "message": message[:1000]})
    line = f"[{ts}] {message}"
    if debug_mode:
        print(line)
    if log_file:
        try:
            log_file.write(line + "\n")
            log_file.flush()
        except (OSError, ValueError):
            pass


# --- Application icon and notifications ---
def _load_app_icon(size):
    """Load the bundled multi-resolution DroidSlate icon at the requested size."""
    candidates = (
        os.path.join(resource_dir, "assets", "DroidSlate.ico"),
        os.path.join(script_dir, "packaging", "DroidSlate.ico"),
    )
    for icon_path in candidates:
        if os.path.isfile(icon_path):
            icon = user32.LoadImageW(None, icon_path, IMAGE_ICON, size, size, LR_LOADFROMFILE)
            if icon:
                return icon
    return None


_notify_icon_added = False
_NOTIFY_ID = 1001


def _ensure_notify_icon():
    """Add the notification tray icon if not already present."""
    global _notify_icon_added
    if _notify_icon_added or not hwnd_main:
        return _notify_icon_added

    nid = NOTIFYICONDATAW()
    nid.cbSize = ctypes.sizeof(NOTIFYICONDATAW)
    nid.hWnd = hwnd_main
    nid.uID = _NOTIFY_ID
    nid.uFlags = NIF_ICON | NIF_TIP | NIF_SHOWTIP | NIF_MESSAGE
    nid.uCallbackMessage = WM_TRAYICON
    nid.hIcon = _small_app_icon or user32.LoadIconW(None, ctypes.cast(IDC_ARROW, wt.LPCWSTR))
    nid.szTip = "DroidSlate"

    if shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(nid)):
        nid.uVersion = NOTIFYICON_VERSION_4
        shell32.Shell_NotifyIconW(NIM_SETVERSION, ctypes.byref(nid))
        _notify_icon_added = True
        return True
    return False


def notify(title, message, icon=NIIF_INFO):
    """Show a Windows toast notification. Non-blocking, safe to call from any thread."""
    if not hwnd_main:
        if icon == NIIF_ERROR:
            try:
                user32.MessageBoxW(None, message, title, 0x10)
            except Exception as mb_err:
                log(f"MessageBox fallback failed: {mb_err}")
        return
    try:
        _ensure_notify_icon()
        nid = NOTIFYICONDATAW()
        nid.cbSize = ctypes.sizeof(NOTIFYICONDATAW)
        nid.hWnd = hwnd_main
        nid.uID = _NOTIFY_ID
        nid.uFlags = NIF_INFO
        nid.szInfoTitle = title[:63]
        nid.szInfo = message[:255]
        nid.dwInfoFlags = icon | NIIF_NOSOUND
        shell32.Shell_NotifyIconW(NIM_MODIFY, ctypes.byref(nid))
    except Exception as e:
        log(f"Notification failed: {e}")


def _remove_notify_icon():
    """Remove tray icon on exit."""
    global _notify_icon_added
    if _notify_icon_added and hwnd_main:
        nid = NOTIFYICONDATAW()
        nid.cbSize = ctypes.sizeof(NOTIFYICONDATAW)
        nid.hWnd = hwnd_main
        nid.uID = _NOTIFY_ID
        shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(nid))
        _notify_icon_added = False


# --- Dashboard (loopback API + on-demand WebView2 window) ---
_dashboard_server = None
_dashboard_backend = None
_dashboard_thread = None
_ui_process = None


def open_dashboard():
    """Create (or reuse) the dashboard server and launch the WebView2 window."""
    global _dashboard_server, _dashboard_backend, _dashboard_thread, _ui_process
    try:
        if _dashboard_server is None:
            _dashboard_backend = DroidSlateBackend(data_dir)
            _dashboard_server, token = create_dashboard_server(
                _dashboard_backend,
                os.path.join(resource_dir, "ui_bundle"),
            )
            _dashboard_thread = threading.Thread(
                target=_dashboard_server.serve_forever,
                name="DroidSlateDashboardAPI",
                daemon=True,
            )
            _dashboard_thread.start()
        else:
            token = _dashboard_server.rotate_session()

        url = f"http://127.0.0.1:{_dashboard_server.server_port}/?desktop=1#session={urllib.parse.quote(token)}"
        env = os.environ.copy()
        env["DROIDSLATE_UI_URL"] = url
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        if getattr(sys, "frozen", False):
            command = [sys.executable, "--ui"]
        else:
            command = [sys.executable, os.path.join(script_dir, "ui_host.py")]
        # Executable/script paths are constructed internally, never from an API request.
        _ui_process = subprocess.Popen(  # nosec B603
            command,
            env=env,
            close_fds=True,
            creationflags=creationflags,
        )
        log("Dashboard opened")
    except Exception as exc:
        log(f"Dashboard failed to open: {type(exc).__name__}: {exc}")
        notify("DroidSlate", "The window could not open. Repair the DroidSlate installation and try again.", NIIF_ERROR)


# --- Window procedure ---
def wnd_proc(hwnd, msg, wparam, lparam):
    try:
        if msg == WM_OPEN_DASHBOARD:
            open_dashboard()

        elif msg == WM_TRAYICON:
            # NOTIFYICON_VERSION_4 stores the event code in LOWORD(lParam) and
            # the icon identifier in HIWORD(lParam). Masking also remains compatible
            # with legacy shell callbacks that pass only the event code.
            tray_event = int(lparam) & 0xFFFF
            if tray_event in (WM_RBUTTONUP, WM_CONTEXTMENU):
                # Context menu with the app's only exit path. SetForegroundWindow is
                # required for the menu to dismiss when the user clicks elsewhere.
                user32.SetForegroundWindow(hwnd)
                hmenu = user32.CreatePopupMenu()
                if hmenu:
                    user32.AppendMenuW(hmenu, MF_STRING, MENU_ID_OPEN, "Open DroidSlate")
                    user32.AppendMenuW(hmenu, MF_SEPARATOR, 0, None)
                    user32.AppendMenuW(hmenu, MF_STRING, MENU_ID_EXIT, "Exit DroidSlate")
                    pt = wt.POINT()
                    user32.GetCursorPos(ctypes.byref(pt))
                    cmd = user32.TrackPopupMenu(hmenu, TPM_RETURNCMD | TPM_RIGHTBUTTON,
                                                pt.x, pt.y, 0, hwnd, None)
                    user32.DestroyMenu(hmenu)
                    if cmd == MENU_ID_OPEN:
                        open_dashboard()
                    elif cmd == MENU_ID_EXIT:
                        log("Exit requested from tray menu")
                        user32.DestroyWindow(hwnd)  # WM_DESTROY -> PostQuitMessage
            elif tray_event in (WM_LBUTTONUP, WM_LBUTTONDBLCLK, NIN_SELECT, NIN_KEYSELECT):
                # Open on one click. NIN_SELECT/NIN_KEYSELECT support version-4
                # shell activation and keyboard activation of the notification icon.
                log("Tray activation")
                open_dashboard()

        elif msg == WM_DESTROY:
            user32.PostQuitMessage(0)
    except Exception as e:
        log(f"ERROR in wnd_proc: {e}")

    return user32.DefWindowProcW(hwnd, msg, wparam, lparam)


# --- Singleton (session-local named mutex prevents duplicate instances) ---
_mutex_handle = None


def acquire_singleton():
    """Create a session-local Win32 mutex. Return True only for its first owner."""
    global _mutex_handle
    handle = kernel32.CreateMutexW(None, False, r"Local\DroidSlate.Desktop.Singleton.v1")
    if not handle:
        return False
    if kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        kernel32.CloseHandle(handle)
        return False
    _mutex_handle = handle
    return True


# --- Main ---
def self_test():
    """Non-interactive packaged-build smoke test used by Windows CI."""
    from adb_manager import ADBManager, find_adb
    from dashboard_server import DroidSlateBackend, create_dashboard_server
    import webview  # noqa: F401 - verifies the WebView2 host dependency was bundled

    assets = os.path.join(resource_dir, "ui_bundle")
    if not os.path.isfile(os.path.join(assets, "index.html")):
        raise RuntimeError("Bundled dashboard assets are missing")
    if getattr(sys, "frozen", False) and not os.path.isfile(
        os.path.join(resource_dir, "assets", "DroidSlate.ico")
    ):
        raise RuntimeError("Bundled application icon is missing")
    manager = ADBManager()
    if not manager.adb_path:
        raise RuntimeError("ADB binary could not be resolved")
    # PyInstaller 6 bundles data files under _internal/ (sys._MEIPASS). When a
    # bundled adb exists there, resolution must actually find it — otherwise the
    # packaged app would silently depend on a system-wide adb install.
    bundled_adb = os.path.join(resource_dir, "adb-bin", "adb.exe")
    if os.path.isfile(bundled_adb) and not os.path.isfile(manager.adb_path):
        raise RuntimeError(f"Bundled adb.exe was not resolved (resolved: {manager.adb_path})")
    with tempfile.TemporaryDirectory() as temporary:
        backend = DroidSlateBackend(temporary, adb=manager)
        server, _ = create_dashboard_server(backend, assets)
        snapshot = backend.snapshot()
        server.server_close()
        backend.close()
        if "devices" not in snapshot or "runtime" not in snapshot:
            raise RuntimeError("Dashboard snapshot is incomplete")
    return 0


def main():
    global hwnd_main, log_file
    global _large_app_icon, _small_app_icon

    try:
        os.makedirs(data_dir, exist_ok=True)
    except Exception as exc:
        ctypes.windll.user32.MessageBoxW(
            None,
            f"DroidSlate could not create its user data folder.\n\n{type(exc).__name__}",
            "DroidSlate",
            0x10,
        )
        return

    # Only write debug.log when --debug is passed
    if debug_mode:
        log_path = os.path.join(data_dir, "debug.log")
        log_file = open(log_path, "w", encoding="utf-8")
    log(f"Script directory: {script_dir}")

    # Prevent duplicate instances
    if not acquire_singleton():
        log("Another instance is already running; requesting its window.")
        existing = user32.FindWindowW("DroidSlateDesktop", None)
        if existing and user32.PostMessageW(existing, WM_OPEN_DASHBOARD, 0, 0):
            return
        ctypes.windll.user32.MessageBoxW(
            None,
            "DroidSlate is already running, but its window could not be opened. "
            "Use the tray icon, or exit DroidSlate in Task Manager and start it again.",
            "DroidSlate",
            0x30,
        )
        return

    # Create window class
    WNDPROC = ctypes.WINFUNCTYPE(LRESULT, wt.HWND, wt.UINT, wt.WPARAM, wt.LPARAM)
    wnd_proc_cb = WNDPROC(wnd_proc)

    hinstance = kernel32.GetModuleHandleW(None)
    class_name = "DroidSlateDesktop"
    _large_app_icon = _load_app_icon(32)
    _small_app_icon = _load_app_icon(16)

    wc = WNDCLASSEXW()
    wc.cbSize = ctypes.sizeof(WNDCLASSEXW)
    wc.lpfnWndProc = wnd_proc_cb
    wc.hInstance = hinstance
    wc.hIcon = _large_app_icon
    wc.hCursor = user32.LoadCursorW(None, IDC_ARROW)
    wc.hIconSm = _small_app_icon
    wc.lpszClassName = class_name

    if not user32.RegisterClassExW(ctypes.byref(wc)):
        log("Failed to register window class")
        ctypes.windll.user32.MessageBoxW(
            None, "DroidSlate could not start: failed to register its window class.", "DroidSlate", 0x10)
        return

    # Create hidden window
    hwnd_main = user32.CreateWindowExW(
        0, class_name, "DroidSlate", WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 1, 1,
        None, None, hinstance, None
    )

    if not hwnd_main:
        log("Failed to create window")
        ctypes.windll.user32.MessageBoxW(
            None, "DroidSlate could not start: failed to create its message window.", "DroidSlate", 0x10)
        return

    _ensure_notify_icon()
    log("DroidSlate running")

    # First launch opens the window so the app does not appear to do nothing.
    threading.Timer(0.35, open_dashboard).start()

    if debug_mode:
        print("  DroidSlate running")
        print("  Use the tray icon to reopen the window.")
        print()

    # Message loop (BLOCKING - zero CPU when idle)
    msg = wt.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))

    # Cleanup
    _remove_notify_icon()
    if _dashboard_server is not None:
        _dashboard_server.shutdown()
        _dashboard_server.server_close()
    if _dashboard_backend is not None:
        _dashboard_backend.close()
    if _ui_process is not None and _ui_process.poll() is None:
        _ui_process.terminate()
    for icon in (_small_app_icon, _large_app_icon):
        if icon:
            user32.DestroyIcon(icon)
    _small_app_icon = None
    _large_app_icon = None
    if _mutex_handle:
        kernel32.CloseHandle(_mutex_handle)
    log("Shutting down")
    if log_file:
        log_file.close()


if __name__ == "__main__":
    try:
        if "--self-test" in sys.argv:
            try:
                raise SystemExit(self_test())
            except SystemExit:
                raise
            except Exception:
                # Windowed PyInstaller executables otherwise show a modal traceback dialog,
                # which would hang unattended installer validation. Keep the diagnostic local.
                error_path = os.path.join(tempfile.gettempdir(), "DroidSlate-self-test.log")
                try:
                    import traceback
                    with open(error_path, "w", encoding="utf-8") as error_file:
                        traceback.print_exc(file=error_file)
                except OSError:
                    pass
                raise SystemExit(1)
        if "--ui" in sys.argv:
            from ui_host import main as ui_main
            raise SystemExit(ui_main())
        main()
    finally:
        if log_file:
            log_file.close()
