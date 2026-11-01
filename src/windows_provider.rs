//! Asynchronous OpenAI-compatible provider requests over WinHTTP.
//!
//! The window thread only submits work and receives a posted completion. The
//! worker owns all blocking DNS, connection, send, and receive operations.

use std::ffi::c_void;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};

use swiftslate::provider::{
    build_chat_request, parse_chat_response, ProviderConfig, MAX_PROVIDER_RESPONSE_BYTES,
};
use windows::core::{Error as WindowsError, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::Networking::WinHttp::{
    WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpQueryHeaders,
    WinHttpReadData, WinHttpReceiveResponse, WinHttpSendRequest, WinHttpSetOption,
    WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_ACCESS_TYPE_NO_PROXY,
    WINHTTP_DISABLE_REDIRECTS, WINHTTP_FLAG_SECURE, WINHTTP_OPEN_REQUEST_FLAGS,
    WINHTTP_OPTION_DISABLE_FEATURE,
    WINHTTP_OPTION_MAX_RESPONSE_HEADER_SIZE, WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_QUERY_STATUS_CODE,
};
use windows::Win32::UI::WindowsAndMessaging::{PostMessageW, WM_APP};

use crate::windows_secrets::read_api_key;

pub const WM_PROVIDER_COMPLETE: u32 = WM_APP + 18;
const MAX_RESPONSE_HEADERS_BYTES: u32 = 32 * 1024;
const NETWORK_DEADLINE: Duration = Duration::from_secs(45);

#[derive(Debug)]
pub struct ProviderResponse {
    pub request_id: u64,
    pub result: Result<String, String>,
}

struct ProviderRequest {
    request_id: u64,
    config: ProviderConfig,
    input: String,
}

enum WorkerCommand {
    Request(ProviderRequest),
    Stop,
}

pub struct ProviderWorker {
    command_tx: Sender<WorkerCommand>,
    response_rx: Receiver<ProviderResponse>,
}

impl ProviderWorker {
    pub fn start(notification_window: HWND) -> Result<Self, String> {
        let notification_window = notification_window.0 as isize;
        let (command_tx, command_rx) = mpsc::channel();
        let (response_tx, response_rx) = mpsc::channel();
        thread::Builder::new()
            .name("swiftslate-provider".into())
            .spawn(move || worker_main(notification_window, command_rx, response_tx))
            .map_err(|error| format!("could not create provider worker: {error}"))?;
        Ok(Self {
            command_tx,
            response_rx,
        })
    }

    pub fn request(
        &self,
        request_id: u64,
        config: ProviderConfig,
        input: String,
    ) -> Result<(), ()> {
        self.command_tx
            .send(WorkerCommand::Request(ProviderRequest {
                request_id,
                config,
                input,
            }))
            .map_err(|_| ())
    }

    pub fn try_responses(&self) -> Vec<ProviderResponse> {
        self.response_rx.try_iter().collect()
    }

    pub fn stop(&self) {
        let _ = self.command_tx.send(WorkerCommand::Stop);
    }
}

fn worker_main(
    notification_window: isize,
    command_rx: Receiver<WorkerCommand>,
    response_tx: Sender<ProviderResponse>,
) {
    while let Ok(command) = command_rx.recv() {
        let request = match command {
            WorkerCommand::Request(request) => request,
            WorkerCommand::Stop => break,
        };
        let response = ProviderResponse {
            request_id: request.request_id,
            result: perform_request(&request.config, &request.input),
        };
        if response_tx.send(response).is_err() {
            break;
        }
        let window = HWND(notification_window as *mut c_void);
        let _ = unsafe { PostMessageW(window, WM_PROVIDER_COMPLETE, WPARAM(0), LPARAM(0)) };
    }
}

fn perform_request(config: &ProviderConfig, input: &str) -> Result<String, String> {
    let endpoint = config.endpoint_parts().map_err(|error| error.to_string())?;
    let target = config
        .credential_target()
        .map_err(|error| error.to_string())?;
    let api_key = read_api_key(&target)?
        .ok_or_else(|| "No API key is saved for this provider host.".to_owned())?;
    let api_key = api_key.as_utf8()?;
    if api_key.is_empty()
        || api_key
            .bytes()
            .any(|byte| matches!(byte, b'\r' | b'\n' | 0))
    {
        return Err("The stored API key is invalid.".into());
    }

    let mut body = SensitiveBytes(build_chat_request(config, input));
    let mut headers = SensitiveWide(
        "Content-Type: application/json\r\nAccept: application/json\r\nAuthorization: Bearer "
            .encode_utf16()
            .collect(),
    );
    headers.0.extend(api_key.encode_utf16());
    headers.0.extend("\r\n".encode_utf16());

    let response = unsafe { send_winhttp(&endpoint, &headers.0, &body.0) };
    headers.0.fill(0);
    body.0.fill(0);
    let (status, mut response_body) = response?;
    let parsed = parse_chat_response(status, &response_body).map_err(|error| error.to_string());
    response_body.fill(0);
    parsed
}

unsafe fn send_winhttp(
    endpoint: &swiftslate::provider::EndpointParts,
    headers: &[u16],
    body: &[u8],
) -> Result<(u32, Vec<u8>), String> {
    let started = Instant::now();
    let agent = wide("SwiftSlate/0.3");
    let access_type = if endpoint.secure {
        WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY
    } else {
        WINHTTP_ACCESS_TYPE_NO_PROXY
    };
    let session = WinHttpOpen(
        PCWSTR(agent.as_ptr()),
        access_type,
        PCWSTR::null(),
        PCWSTR::null(),
        0,
    );
    let session = InternetHandle::new(session, "open a network session")?;
    WinHttpSetTimeouts(session.0, 5_000, 8_000, 10_000, 10_000)
        .map_err(|error| network_error("set network timeouts", error))?;
    WinHttpSetOption(
        Some(session.0),
        WINHTTP_OPTION_MAX_RESPONSE_HEADER_SIZE,
        Some(&MAX_RESPONSE_HEADERS_BYTES.to_ne_bytes()),
    )
    .map_err(|error| network_error("set the response-header limit", error))?;

    let connection_host = if !endpoint.secure && endpoint.host.eq_ignore_ascii_case("localhost") {
        "127.0.0.1"
    } else {
        &endpoint.host
    };
    let host = wide(connection_host);
    let connection = WinHttpConnect(session.0, PCWSTR(host.as_ptr()), endpoint.port, 0);
    let connection = InternetHandle::new(connection, "connect to the provider")?;

    let method = wide("POST");
    let path = wide(&endpoint.path_and_query);
    let flags = if endpoint.secure {
        WINHTTP_FLAG_SECURE
    } else {
        WINHTTP_OPEN_REQUEST_FLAGS(0)
    };
    let request = WinHttpOpenRequest(
        connection.0,
        PCWSTR(method.as_ptr()),
        PCWSTR(path.as_ptr()),
        PCWSTR::null(),
        PCWSTR::null(),
        std::ptr::null(),
        flags,
    );
    let request = InternetHandle::new(request, "create the provider request")?;
    WinHttpSetOption(
        Some(request.0),
        WINHTTP_OPTION_DISABLE_FEATURE,
        Some(&WINHTTP_DISABLE_REDIRECTS.to_ne_bytes()),
    )
    .map_err(|error| network_error("disable redirects", error))?;

    let body_length =
        u32::try_from(body.len()).map_err(|_| "The request is too large.".to_owned())?;
    WinHttpSendRequest(
        request.0,
        Some(headers),
        Some(body.as_ptr().cast()),
        body_length,
        body_length,
        0,
    )
    .map_err(|error| network_error("send the provider request", error))?;
    ensure_before_deadline(started)?;
    WinHttpReceiveResponse(request.0, std::ptr::null_mut())
        .map_err(|error| network_error("receive the provider response", error))?;
    ensure_before_deadline(started)?;

    let status = query_status(request.0)?;
    let response_body = read_bounded_body(request.0, started)?;
    Ok((status, response_body))
}

unsafe fn query_status(request: *mut c_void) -> Result<u32, String> {
    let mut status = 0u32;
    let mut bytes = std::mem::size_of::<u32>() as u32;
    let mut index = 0u32;
    WinHttpQueryHeaders(
        request,
        WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
        PCWSTR::null(),
        Some((&mut status as *mut u32).cast()),
        &mut bytes,
        &mut index,
    )
    .map_err(|error| network_error("read the provider status", error))?;
    Ok(status)
}

unsafe fn read_bounded_body(
    request: *mut c_void,
    started: Instant,
) -> Result<Vec<u8>, String> {
    let mut response = Vec::new();
    let mut chunk = [0u8; 8 * 1024];
    loop {
        ensure_before_deadline(started)?;
        let mut bytes_read = 0u32;
        WinHttpReadData(
            request,
            chunk.as_mut_ptr().cast(),
            chunk.len() as u32,
            &mut bytes_read,
        )
        .map_err(|error| network_error("read the provider response", error))?;
        ensure_before_deadline(started)?;
        if bytes_read == 0 {
            return Ok(response);
        }
        let bytes_read = bytes_read as usize;
        if response.len().saturating_add(bytes_read) > MAX_PROVIDER_RESPONSE_BYTES {
            return Err("The provider response exceeded the download limit.".into());
        }
        response.extend_from_slice(&chunk[..bytes_read]);
    }
}

fn ensure_before_deadline(started: Instant) -> Result<(), String> {
    if started.elapsed() > NETWORK_DEADLINE {
        Err("The provider request exceeded the network deadline.".into())
    } else {
        Ok(())
    }
}

fn network_error(action: &str, error: WindowsError) -> String {
    format!("Could not {action}: {error}")
}

struct InternetHandle(*mut c_void);

impl InternetHandle {
    fn new(handle: *mut c_void, action: &str) -> Result<Self, String> {
        if handle.is_null() {
            Err(network_error(action, WindowsError::from_win32()))
        } else {
            Ok(Self(handle))
        }
    }
}

impl Drop for InternetHandle {
    fn drop(&mut self) {
        let _ = unsafe { WinHttpCloseHandle(self.0) };
    }
}

struct SensitiveBytes(Vec<u8>);

impl Drop for SensitiveBytes {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

struct SensitiveWide(Vec<u16>);

impl Drop for SensitiveWide {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}
