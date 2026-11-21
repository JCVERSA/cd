"""Short-lived pywebview host for the bundled DroidSlate dashboard."""

from __future__ import annotations

import os
import traceback


def _message_box(title: str, message: str) -> None:
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, message, title, 0x10)
    # No fallback UI exists before Win32 itself is available.
    except Exception:  # nosec B110
        pass


def _hide_to_tray(window) -> None:
    """Remove the on-demand window while the tray engine keeps running."""
    window.destroy()


def main() -> int:
    url = os.environ.pop("DROIDSLATE_UI_URL", "")
    if not url.startswith("http://127.0.0.1:") or "#session=" not in url:
        _message_box("DroidSlate", "The private dashboard session could not be created.")
        return 2

    try:
        import webview

        # pywebview does not receive a privileged js_api object.  Every operation goes
        # through the independently authenticated loopback API.
        if "OPEN_EXTERNAL_LINKS_IN_BROWSER" in webview.settings:
            webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = False
        if "ALLOW_DOWNLOADS" in webview.settings:
            webview.settings["ALLOW_DOWNLOADS"] = False

        window = webview.create_window(
            "DroidSlate",
            url=url,
            width=1180,
            height=780,
            min_size=(920, 640),
            resizable=True,
            text_select=True,
            background_color="#08080c",
        )
        # Closing the child window already leaves the parent tray engine alive.
        # Treat Minimize the same way: remove the host from the taskbar and let a
        # later tray activation launch a fresh, authenticated dashboard session.
        window.events.minimized += _hide_to_tray
        storage_path = os.path.join(
            os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
            "DroidSlate",
            "WebView2",
        )
        os.makedirs(storage_path, exist_ok=True)
        webview.start(
            gui="edgechromium",
            debug=False,
            private_mode=False,
            storage_path=storage_path,
        )
        return 0
    except Exception as exc:
        # Keep details in the user's local log without leaking the private session URL.
        safe_error = "".join(traceback.format_exception_only(type(exc), exc)).strip()
        try:
            log_dir = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "DroidSlate")
            os.makedirs(log_dir, exist_ok=True)
            with open(os.path.join(log_dir, "ui-error.log"), "a", encoding="utf-8") as handle:
                handle.write(safe_error.replace(url, "<private-dashboard-url>") + "\n")
        except OSError:
            pass
        _message_box(
            "DroidSlate dashboard could not open",
            "DroidSlate needs the Microsoft Edge WebView2 Runtime to show its window. "
            "Repair the DroidSlate installation or install WebView2, then try again.",
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
