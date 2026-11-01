//! Asynchronous OpenAI-compatible provider requests over WinHTTP.
//!
//! The window thread only submits work and receives a posted completion. The
//! worker owns all blocking DNS, connection, send, and receive operations.

use std::ffi::c_void;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};

use swiftslate::provider::{
    build_command_request, parse_chat_response, parse_model_catalog, ProviderConfig,
    MAX_PROVIDER_RESPONSE_BYTES,
};
use windows::core::{Error as WindowsError, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::Networking::WinHttp::{
    WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpQueryHeaders,
    WinHttpReadData, WinHttpReceiveResponse, WinHttpSendRequest, WinHttpSetOption,
    WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_ACCESS_TYPE_NO_PROXY,
    WINHTTP_DISABLE_REDIRECTS, WINHTTP_FLAG_SECURE, WINHTTP_OPEN_REQUEST_FLAGS,
    WINHTTP_OPTION_DISABLE_FEATURE, WINHTTP_OPTION_MAX_RESPONSE_HEADER_SIZE,
    WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_QUERY_STATUS_CODE,
};
use windows::Win32::UI::WindowsAndMessaging::{PostMessageW, WM_APP};

use crate::windows_secrets::read_api_key;

pub const WM_PROVIDER_COMPLETE: u32 = WM_APP + 18;
const MAX_RESPONSE_HEADERS_BYTES: u32 = 32 * 1024;
const NETWORK_DEADLINE: Duration = Duration::from_secs(45);

#[derive(Debug)]
pub enum ProviderOutput {
    Completion(String),
    Models(Vec<String>),
    TestSucceeded,
}

#[derive(Debug)]
pub struct ProviderResponse {
    pub request_id: u64,
    pub result: Result<ProviderOutput, String>,
}

struct ProviderRequest {
    request_id: u64,
    config: ProviderConfig,
    instruction: String,
    input: String,
}

enum UtilityKind {
    FetchModels,
    Test,
}

struct UtilityRequest {
    request_id: u64,
    config: ProviderConfig,
    kind: UtilityKind,
}

enum WorkerCommand {
    Request(ProviderRequest),
    Utility(UtilityRequest),
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
        instruction: String,
        input: String,
    ) -> Result<(), ()> {
        self.command_tx
            .send(WorkerCommand::Request(ProviderRequest {
                request_id,
                config,
                instruction,
                input,
            }))
            .map_err(|_| ())
    }

    pub fn fetch_models(&self, request_id: u64, config: ProviderConfig) -> Result<(), ()> {
        self.utility(request_id, config, UtilityKind::FetchModels)
    }

    pub fn test(&self, request_id: u64, config: ProviderConfig) -> Result<(), ()> {
        self.utility(request_id, config, UtilityKind::Test)
    }

    fn utility(
        &self,
        request_id: u64,
        config: ProviderConfig,
        kind: UtilityKind,
    ) -> Result<(), ()> {
        self.command_tx
            .send(WorkerCommand::Utility(UtilityRequest {
                request_id,
                config,
                kind,
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
        let response = match command {
            WorkerCommand::Request(request) => ProviderResponse {
                request_id: request.request_id,
                result: perform_request(&request.config, &request.instruction, &request.input)
                    .map(ProviderOutput::Completion),
            },
            WorkerCommand::Utility(request) => ProviderResponse {
                request_id: request.request_id,
                result: match request.kind {
                    UtilityKind::FetchModels => perform_model_fetch(&request.config)
                        .map(ProviderOutput::Models),
                    UtilityKind::Test => perform_provider_test(&request.config)
                        .map(|()| ProviderOutput::TestSucceeded),
                },
            },
            WorkerCommand::Stop => break,
        };
        if response_tx.send(response).is_err() {
            break;
        }
        let window = HWND(notification_window as *mut c_void);
        let _ = unsafe { PostMessageW(window, WM_PROVIDER_COMPLETE, WPARAM(0), LPARAM(0)) };
    }
}

fn perform_request(
    config: &ProviderConfig,
    instruction: &str,
    input: &str,
) -> Result<String, String> {
    let (endpoint, mut headers) = request_headers(config, true)?;
    let mut body = SensitiveBytes(build_command_request(config, instruction, input));

    let response = unsafe { send_winhttp(&endpoint, &headers.0, &body.0) };
    headers.0.fill(0);
    body.0.fill(0);
    let (status, mut response_body) = response?;
    let parsed = parse_chat_response(status, &response_body).map_err(|error| error.to_string());
    response_body.fill(0);
    parsed
}

fn perform_model_fetch(config: &ProviderConfig) -> Result<Vec<String>, String> {
    let (endpoint, mut headers) = request_headers(config, false)?;
    let response = unsafe { send_winhttp_get(&endpoint, &headers.0) };
    headers.0.fill(0);
    let (status, mut body) = response?;
    let models = parse_model_catalog(status, &body).map_err(|error| error.to_string());
    body.fill(0);
    models
}

fn perform_provider_test(config: &ProviderConfig) -> Result<(), String> {
    let (endpoint, mut headers) = request_headers(config, false)?;
    let response = unsafe { send_winhttp_get(&endpoint, &headers.0) };
    headers.0.fill(0);
    let (status, mut body) = response?;
    let result = if (200..300).contains(&status) {
        Ok(())
    } else {
        parse_model_catalog(status, &body)
            .map(|_| ())
            .map_err(|error| error.to_string())
    };
    body.fill(0);
    result
}

fn request_headers(
    config: &ProviderConfig,
    include_content_type: bool,
) -> Result<(swiftslate::provider::EndpointParts, SensitiveWide), String> {
    let endpoint = config.endpoint_parts().map_err(|error| error.to_string())?;
    let target = config
        .credential_target()
        .map_err(|error| error.to_string())?;
    let api_key = read_api_key(&target)?;
    if api_key.is_none() && endpoint.secure {
        return Err("No API key is saved for this provider host.".into());
    }

    let initial = if include_content_type {
        "Content-Type: application/json\r\nAccept: application/json\r\n"
    } else {
        "Accept: application/json\r\n"
    };
    let mut headers = SensitiveWide(initial.encode_utf16().collect());
    if let Some(api_key) = api_key.as_ref() {
        let api_key = api_key.as_utf8()?;
        if api_key.is_empty()
            || api_key
                .bytes()
                .any(|byte| matches!(byte, b'\r' | b'\n' | 0))
        {
            return Err("The stored API key is invalid.".into());
        }
        headers.0.extend("Authorization: Bearer ".encode_utf16());
        headers.0.extend(api_key.encode_utf16());
        headers.0.extend("\r\n".encode_utf16());
    }
    Ok((endpoint, headers))
}

unsafe fn send_winhttp(
    endpoint: &swiftslate::provider::EndpointParts,
    headers: &[u16],
    body: &[u8],
) -> Result<(u32, Vec<u8>), String> {
    send_winhttp_method(endpoint, "POST", headers, body)
}

unsafe fn send_winhttp_get(
    endpoint: &swiftslate::provider::EndpointParts,
    headers: &[u16],
) -> Result<(u32, Vec<u8>), String> {
    send_winhttp_method(endpoint, "GET", headers, &[])
}

unsafe fn send_winhttp_method(
    endpoint: &swiftslate::provider::EndpointParts,
    method: &str,
    headers: &[u16],
    body: &[u8],
) -> Result<(u32, Vec<u8>), String> {
    let started = Instant::now();
    let agent = wide("SwiftSlate/1.2");
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

    let method = wide(method);
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
    let optional_body = (!body.is_empty()).then(|| body.as_ptr().cast());
    WinHttpSendRequest(
        request.0,
        Some(headers),
        optional_body,
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

unsafe fn read_bounded_body(request: *mut c_void, started: Instant) -> Result<Vec<u8>, String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use swiftslate::provider::EndpointParts;

    struct TestServer {
        port: u16,
        request_rx: mpsc::Receiver<Vec<u8>>,
        handle: std::thread::JoinHandle<()>,
    }

    fn spawn_server(status: &str, extra_headers: &[(&str, &str)], body: Vec<u8>) -> TestServer {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let status = status.to_owned();
        let extra_headers: Vec<(String, String)> = extra_headers
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect();
        let (request_tx, request_rx) = mpsc::channel();
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            let mut chunk = [0u8; 1024];
            while !request.windows(4).any(|window| window == b"\r\n\r\n") {
                let read = stream.read(&mut chunk).unwrap();
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&chunk[..read]);
            }
            let header_end = request
                .windows(4)
                .position(|window| window == b"\r\n\r\n")
                .map(|position| position + 4)
                .unwrap_or(request.len());
            let content_length = String::from_utf8_lossy(&request[..header_end])
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    if name.eq_ignore_ascii_case("content-length") {
                        value.trim().parse::<usize>().ok()
                    } else {
                        None
                    }
                })
                .unwrap_or(0);
            while request.len() < header_end.saturating_add(content_length) {
                let read = stream.read(&mut chunk).unwrap();
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&chunk[..read]);
            }
            let _ = request_tx.send(request);

            let mut response = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n",
                body.len()
            );
            for (name, value) in extra_headers {
                response.push_str(&format!("{name}: {value}\r\n"));
            }
            response.push_str("\r\n");
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.write_all(&body);
        });
        TestServer {
            port,
            request_rx,
            handle,
        }
    }

    fn endpoint(port: u16) -> EndpointParts {
        EndpointParts {
            secure: false,
            host: "127.0.0.1".into(),
            port,
            path_and_query: "/v1/chat/completions".into(),
        }
    }

    fn headers() -> Vec<u16> {
        "Content-Type: application/json\r\nAuthorization: Bearer test-key\r\n"
            .encode_utf16()
            .collect()
    }

    #[test]
    fn winhttp_posts_and_reads_a_bounded_completion() {
        let response = br#"{"choices":[{"message":{"content":"Revised."}}]}"#.to_vec();
        let server = spawn_server("200 OK", &[("Content-Type", "application/json")], response);
        let (status, body) =
            unsafe { send_winhttp(&endpoint(server.port), &headers(), br#"{"request":true}"#) }
                .unwrap();
        assert_eq!(status, 200);
        assert_eq!(parse_chat_response(status, &body), Ok("Revised.".into()));
        let request = server.request_rx.recv().unwrap();
        let request = String::from_utf8_lossy(&request);
        assert!(request.starts_with("POST /v1/chat/completions HTTP/1.1\r\n"));
        assert!(request.contains("Authorization: Bearer test-key\r\n"));
        server.handle.join().unwrap();
    }

    #[test]
    fn winhttp_gets_model_catalogs_without_a_request_body() {
        let response = br#"{"data":[{"id":"model-a"}]}"#.to_vec();
        let server = spawn_server("200 OK", &[("Content-Type", "application/json")], response);
        let (status, body) = unsafe { send_winhttp_get(&endpoint(server.port), &headers()) }.unwrap();
        assert_eq!(parse_model_catalog(status, &body), Ok(vec!["model-a".into()]));
        let request = server.request_rx.recv().unwrap();
        let request = String::from_utf8_lossy(&request);
        assert!(request.starts_with("GET /v1/chat/completions HTTP/1.1\r\n"));
        server.handle.join().unwrap();
    }

    #[test]
    fn winhttp_does_not_follow_redirects() {
        let server = spawn_server(
            "302 Found",
            &[("Location", "http://127.0.0.1:1/should-not-open")],
            b"{}".to_vec(),
        );
        let (status, _) =
            unsafe { send_winhttp(&endpoint(server.port), &headers(), b"{}") }.unwrap();
        assert_eq!(status, 302);
        server.handle.join().unwrap();
    }

    #[test]
    fn winhttp_rejects_oversized_response_bodies() {
        let server = spawn_server("200 OK", &[], vec![b'x'; MAX_PROVIDER_RESPONSE_BYTES + 1]);
        let result = unsafe { send_winhttp(&endpoint(server.port), &headers(), b"{}") };
        assert_eq!(
            result.unwrap_err(),
            "The provider response exceeded the download limit."
        );
        server.handle.join().unwrap();
    }
}
