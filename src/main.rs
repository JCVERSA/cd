#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

#[cfg(windows)]
mod windows_app;
#[cfg(windows)]
mod windows_config;
#[cfg(windows)]
mod windows_provider;
#[cfg(windows)]
mod windows_secrets;
#[cfg(windows)]
mod windows_selection;

#[cfg(target_os = "linux")]
mod linux_app;
#[cfg(target_os = "linux")]
mod linux_config;
#[cfg(target_os = "linux")]
mod linux_provider;
#[cfg(target_os = "linux")]
mod linux_secrets;
#[cfg(target_os = "linux")]
mod linux_selection;

#[cfg(windows)]
fn main() {
    windows_app::main();
}

#[cfg(target_os = "linux")]
fn main() {
    linux_app::main();
}

#[cfg(not(any(windows, target_os = "linux")))]
fn main() {
    eprintln!("SwiftSlate currently supports Windows and Linux.");
}
