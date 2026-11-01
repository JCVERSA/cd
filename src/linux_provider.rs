//! Bounded Linux provider transport.

use std::time::Duration;

use swiftslate::provider::{
    build_chat_request, parse_chat_response, EndpointParts, ProviderConfig,
    MAX_PROVIDER_RESPONSE_BYTES,
};
use ureq::tls::{RootCerts, TlsConfig, TlsProvider};
use ureq::Agent;

use crate::linux_secrets::read_api_key;

const MAX_RESPONSE_HEADERS_BYTES: usize = 32 * 1024;
const NETWORK_DEADLINE: Duration = Duration::from_secs(45);

pub fn perform_request(config: &ProviderConfig, input: &str) -> Result<String, String> {
    let endpoint = config.endpoint_parts().map_err(|error| error.to_string())?;
    let target = config
        .credential_target()
        .map_err(|error| error.to_string())?;
    let key = read_api_key(&target)?
        .ok_or_else(|| "No API key is saved for this provider host.".to_owned())?;
    let key = key.as_utf8()?;
    if key.is_empty() || key.bytes().any(|byte| matches!(byte, b'\r' | b'\n' | 0)) {
        return Err("The stored API key is invalid.".into());
    }

    let mut authorization = SensitiveBytes(b"Bearer ".to_vec());
    authorization.0.extend_from_slice(key.as_bytes());
    let authorization = authorization.as_utf8()?;
    let mut request_body = SensitiveBytes(build_chat_request(config, input));
    let result = send_request(&endpoint, authorization, &request_body.0);
    request_body.0.fill(0);
    let (status, mut response_body) = result?;
    let parsed = parse_chat_response(status, &response_body).map_err(|error| error.to_string());
    response_body.fill(0);
    parsed
}

fn send_request(
    endpoint: &EndpointParts,
    authorization: &str,
    body: &[u8],
) -> Result<(u32, Vec<u8>), String> {
    let tls = TlsConfig::builder()
        .provider(TlsProvider::NativeTls)
        .root_certs(RootCerts::PlatformVerifier)
        .build();
    let mut builder = Agent::config_builder()
        .tls_config(tls)
        .http_status_as_error(false)
        .max_redirects(0)
        .max_response_header_size(MAX_RESPONSE_HEADERS_BYTES)
        .timeout_global(Some(NETWORK_DEADLINE))
        .timeout_per_read(Some(Duration::from_secs(10)))
        .timeout_per_write(Some(Duration::from_secs(10)))
        .user_agent("SwiftSlate/1.1")
        .accept("application/json");
    if !endpoint.secure {
        builder = builder.proxy(None);
    }
    let agent: Agent = builder.build().into();
    let request_url = request_url(endpoint);
    let mut response = agent
        .post(&request_url)
        .header("Content-Type", "application/json")
        .header("Authorization", authorization)
        .send(body)
        .map_err(|error| format!("Could not complete the provider request: {error}"))?;
    let status = u32::from(response.status().as_u16());
    let response_body = response
        .body_mut()
        .with_config()
        .limit(MAX_PROVIDER_RESPONSE_BYTES as u64)
        .read_to_vec()
        .map_err(|error| format!("Could not read the bounded provider response: {error}"))?;
    Ok((status, response_body))
}

fn request_url(endpoint: &EndpointParts) -> String {
    let scheme = if endpoint.secure { "https" } else { "http" };
    let host = if !endpoint.secure && endpoint.host.eq_ignore_ascii_case("localhost") {
        "127.0.0.1".to_owned()
    } else if endpoint.host.contains(':') {
        format!("[{}]", endpoint.host)
    } else {
        endpoint.host.clone()
    };
    format!(
        "{scheme}://{host}:{}{}",
        endpoint.port, endpoint.path_and_query
    )
}

struct SensitiveBytes(Vec<u8>);

impl SensitiveBytes {
    fn as_utf8(&self) -> Result<&str, String> {
        std::str::from_utf8(&self.0).map_err(|_| "Sensitive data is not valid UTF-8.".to_owned())
    }
}

impl Drop for SensitiveBytes {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;

    struct TestServer {
        port: u16,
        request_rx: mpsc::Receiver<Vec<u8>>,
        handle: std::thread::JoinHandle<()>,
    }

    fn spawn_server(status: &str, headers: &[(&str, &str)], body: Vec<u8>) -> TestServer {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let status = status.to_owned();
        let headers: Vec<(String, String)> = headers
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
            let _ = request_tx.send(request);
            let mut response = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n",
                body.len()
            );
            for (name, value) in headers {
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

    fn local_endpoint(port: u16) -> EndpointParts {
        EndpointParts {
            secure: false,
            host: "127.0.0.1".into(),
            port,
            path_and_query: "/v1/chat/completions".into(),
        }
    }

    #[test]
    fn canonicalizes_loopback_transport_without_touching_remote_urls() {
        let local = ProviderConfig::new("http://localhost:11434/v1/chat", "local")
            .unwrap()
            .endpoint_parts()
            .unwrap();
        assert_eq!(request_url(&local), "http://127.0.0.1:11434/v1/chat");

        let remote = ProviderConfig::new("https://example.com/v1/chat", "remote")
            .unwrap()
            .endpoint_parts()
            .unwrap();
        assert_eq!(request_url(&remote), "https://example.com:443/v1/chat");
    }

    #[test]
    fn linux_transport_posts_without_following_redirects() {
        let success = spawn_server(
            "200 OK",
            &[("Content-Type", "application/json")],
            br#"{"choices":[{"message":{"content":"Linux result."}}]}"#.to_vec(),
        );
        let (status, body) =
            send_request(&local_endpoint(success.port), "Bearer test-key", b"{}").unwrap();
        assert_eq!(status, 200);
        assert_eq!(
            parse_chat_response(status, &body),
            Ok("Linux result.".into())
        );
        let request = success.request_rx.recv().unwrap();
        let request = String::from_utf8_lossy(&request);
        assert!(request.starts_with("POST /v1/chat/completions HTTP/1.1\r\n"));
        assert!(request
            .to_ascii_lowercase()
            .contains("authorization: bearer test-key\r\n"));
        success.handle.join().unwrap();

        let redirect = spawn_server(
            "302 Found",
            &[("Location", "http://127.0.0.1:1/should-not-open")],
            b"{}".to_vec(),
        );
        let (status, _) =
            send_request(&local_endpoint(redirect.port), "Bearer test-key", b"{}").unwrap();
        assert_eq!(status, 302);
        redirect.handle.join().unwrap();
    }
}
