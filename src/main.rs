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

#[cfg(windows)]
fn main() {
    windows_app::main();
}

#[cfg(not(windows))]
fn main() {
    eprintln!("SwiftSlate's current prototype runs on Windows. Core tests are cross-platform.");
}
