//! Provider-neutral validation and OpenAI-compatible chat-completion JSON.
//!
//! HTTP, endpoint parsing, and secret retrieval remain platform adapters. This
//! module is safe Rust and never logs request or response content.

use std::fmt;

use serde_json::{json, Value};

pub const MAX_ENDPOINT_LENGTH: usize = 2_048;
pub const MAX_MODEL_LENGTH: usize = 128;
pub const MAX_PROVIDER_RESPONSE_BYTES: usize = 256 * 1024;
pub const MAX_PROVIDER_OUTPUT_UTF16: usize = 32_768;

const SYSTEM_PROMPT: &str =
    "Improve the user's writing while preserving its meaning. Return only the revised text.";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderConfig {
    pub endpoint: String,
    pub model: String,
}

impl ProviderConfig {
    pub fn new(endpoint: impl Into<String>, model: impl Into<String>) -> Result<Self, ConfigError> {
        let endpoint = endpoint.into().trim().to_owned();
        let model = model.into().trim().to_owned();
        if endpoint.is_empty() {
            return Err(ConfigError::EmptyEndpoint);
        }
        if endpoint.len() > MAX_ENDPOINT_LENGTH || endpoint.chars().any(char::is_control) {
            return Err(ConfigError::InvalidEndpoint);
        }
        parse_endpoint(&endpoint)?;
        if model.is_empty() {
            return Err(ConfigError::EmptyModel);
        }
        if model.len() > MAX_MODEL_LENGTH || model.chars().any(char::is_control) {
            return Err(ConfigError::InvalidModel);
        }
        Ok(Self { endpoint, model })
    }

    pub fn consent_key(&self) -> String {
        format!("{}\n{}", self.endpoint, self.model)
    }

    pub fn endpoint_parts(&self) -> Result<EndpointParts, ConfigError> {
        parse_endpoint(&self.endpoint)
    }

    pub fn credential_target(&self) -> Result<String, ConfigError> {
        let endpoint = self.endpoint_parts()?;
        let host = if endpoint.host.contains(':') {
            format!("[{}]", endpoint.host.to_ascii_lowercase())
        } else {
            endpoint.host.to_ascii_lowercase()
        };
        Ok(format!("SwiftSlate/provider/{host}:{}", endpoint.port))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EndpointParts {
    pub secure: bool,
    pub host: String,
    pub port: u16,
    pub path_and_query: String,
}

fn parse_endpoint(endpoint: &str) -> Result<EndpointParts, ConfigError> {
    if endpoint.chars().any(char::is_whitespace) || endpoint.contains('#') {
        return Err(ConfigError::InvalidEndpoint);
    }
    let (scheme, remainder) = endpoint
        .split_once("://")
        .ok_or(ConfigError::InvalidEndpoint)?;
    let secure = if scheme.eq_ignore_ascii_case("https") {
        true
    } else if scheme.eq_ignore_ascii_case("http") {
        false
    } else {
        return Err(ConfigError::InvalidEndpoint);
    };

    let authority_end = remainder
        .find(|character| matches!(character, '/' | '?'))
        .unwrap_or(remainder.len());
    let authority = &remainder[..authority_end];
    if authority.is_empty() || authority.contains('@') || authority.contains('\\') {
        return Err(ConfigError::InvalidEndpoint);
    }
    let suffix = &remainder[authority_end..];
    let path_and_query = if suffix.is_empty() {
        "/".to_owned()
    } else if suffix.starts_with('?') {
        format!("/{suffix}")
    } else {
        suffix.to_owned()
    };

    let (host, port) = if let Some(bracketed) = authority.strip_prefix('[') {
        let end = bracketed.find(']').ok_or(ConfigError::InvalidEndpoint)?;
        let host = &bracketed[..end];
        let after = &bracketed[end + 1..];
        let port = parse_port(after, secure)?;
        if host.parse::<std::net::Ipv6Addr>().is_err() {
            return Err(ConfigError::InvalidEndpoint);
        }
        (host, port)
    } else {
        let colon_count = authority.bytes().filter(|byte| *byte == b':').count();
        if colon_count > 1 {
            return Err(ConfigError::InvalidEndpoint);
        }
        let (host, port_text) = authority
            .rsplit_once(':')
            .map_or((authority, ""), |(host, port)| (host, port));
        if host.is_empty()
            || host.starts_with('.')
            || host.ends_with('.')
            || host.contains("..")
            || !host
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
        {
            return Err(ConfigError::InvalidEndpoint);
        }
        let port = if port_text.is_empty() && colon_count == 0 {
            default_port(secure)
        } else {
            parse_numeric_port(port_text)?
        };
        (host, port)
    };

    if !secure && !is_exact_loopback(host) {
        return Err(ConfigError::InsecureEndpoint);
    }
    Ok(EndpointParts {
        secure,
        host: host.to_owned(),
        port,
        path_and_query,
    })
}

fn parse_port(after_bracket: &str, secure: bool) -> Result<u16, ConfigError> {
    if after_bracket.is_empty() {
        Ok(default_port(secure))
    } else {
        parse_numeric_port(
            after_bracket
                .strip_prefix(':')
                .ok_or(ConfigError::InvalidEndpoint)?,
        )
    }
}

fn parse_numeric_port(port: &str) -> Result<u16, ConfigError> {
    port.parse::<u16>()
        .ok()
        .filter(|port| *port != 0)
        .ok_or(ConfigError::InvalidEndpoint)
}

fn default_port(secure: bool) -> u16 {
    if secure { 443 } else { 80 }
}

fn is_exact_loopback(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1" || host == "::1"
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfigError {
    EmptyEndpoint,
    InvalidEndpoint,
    InsecureEndpoint,
    EmptyModel,
    InvalidModel,
}

impl fmt::Display for ConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::EmptyEndpoint => "Enter an API endpoint.",
            Self::InvalidEndpoint => "The API endpoint is invalid or too long.",
            Self::InsecureEndpoint => {
                "Remote API endpoints must use HTTPS; HTTP is allowed only for exact loopback hosts."
            }
            Self::EmptyModel => "Enter a model name.",
            Self::InvalidModel => "The model name is invalid or too long.",
        };
        formatter.write_str(message)
    }
}

pub fn build_chat_request(config: &ProviderConfig, input: &str) -> Vec<u8> {
    json!({
        "model": config.model,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": input }
        ],
        "stream": false
    })
    .to_string()
    .into_bytes()
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ResponseError {
    InvalidJson,
    MissingContent,
    OutputTooLong,
    Http { status: u32, message: String },
}

impl fmt::Display for ResponseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson => formatter.write_str("The provider returned invalid JSON."),
            Self::MissingContent => {
                formatter.write_str("The provider response did not contain revised text.")
            }
            Self::OutputTooLong => formatter.write_str("The provider response exceeded the limit."),
            Self::Http { status, message } if message.is_empty() => {
                write!(formatter, "The provider returned HTTP {status}.")
            }
            Self::Http { status, message } => {
                write!(formatter, "The provider returned HTTP {status}: {message}")
            }
        }
    }
}

pub fn parse_chat_response(status: u32, body: &[u8]) -> Result<String, ResponseError> {
    if body.len() > MAX_PROVIDER_RESPONSE_BYTES {
        return Err(ResponseError::OutputTooLong);
    }
    if !(200..300).contains(&status) {
        let message = serde_json::from_slice::<Value>(body)
            .ok()
            .and_then(|value| {
                value
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .map(sanitize_provider_message)
            })
            .unwrap_or_default();
        return Err(ResponseError::Http { status, message });
    }

    let value: Value = serde_json::from_slice(body).map_err(|_| ResponseError::InvalidJson)?;
    let content = value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or(ResponseError::MissingContent)?;
    if content.trim().is_empty() {
        return Err(ResponseError::MissingContent);
    }
    if content.encode_utf16().count() > MAX_PROVIDER_OUTPUT_UTF16 {
        return Err(ResponseError::OutputTooLong);
    }
    Ok(content.to_owned())
}

fn sanitize_provider_message(message: &str) -> String {
    message
        .chars()
        .filter(|character| !character.is_control() || *character == ' ')
        .take(300)
        .collect::<String>()
        .trim()
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> ProviderConfig {
        ProviderConfig::new("https://example.com/v1/chat/completions", "test-model").unwrap()
    }

    #[test]
    fn validates_configuration() {
        assert_eq!(
            ProviderConfig::new("", "model"),
            Err(ConfigError::EmptyEndpoint)
        );
        assert_eq!(
            ProviderConfig::new("https://example.com", ""),
            Err(ConfigError::EmptyModel)
        );
        assert!(ProviderConfig::new("https://example.com", "model").is_ok());
    }

    #[test]
    fn endpoint_policy_requires_https_except_exact_loopback() {
        assert_eq!(
            ProviderConfig::new("http://example.com/v1", "model"),
            Err(ConfigError::InsecureEndpoint)
        );
        assert_eq!(
            ProviderConfig::new("http://127.0.0.1.evil.test/v1", "model"),
            Err(ConfigError::InsecureEndpoint)
        );
        assert!(ProviderConfig::new("http://localhost:11434/v1/chat/completions", "model").is_ok());
        assert!(ProviderConfig::new("http://[::1]:11434/v1/chat/completions", "model").is_ok());
    }

    #[test]
    fn endpoint_parts_and_secret_target_are_canonical() {
        let config = ProviderConfig::new(
            "https://EXAMPLE.com:8443/v1/chat/completions?mode=fast",
            "model",
        )
        .unwrap();
        assert_eq!(
            config.endpoint_parts().unwrap(),
            EndpointParts {
                secure: true,
                host: "EXAMPLE.com".into(),
                port: 8443,
                path_and_query: "/v1/chat/completions?mode=fast".into(),
            }
        );
        assert_eq!(
            config.credential_target().unwrap(),
            "SwiftSlate/provider/example.com:8443"
        );
    }

    #[test]
    fn request_json_escapes_user_text() {
        let body = build_chat_request(&config(), "quote: \" and newline\n");
        let parsed: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(parsed["messages"][1]["content"], "quote: \" and newline\n");
        assert_eq!(parsed["stream"], false);
    }

    #[test]
    fn parses_chat_completion_content() {
        let body = br#"{"choices":[{"message":{"content":"Revised text."}}]}"#;
        assert_eq!(parse_chat_response(200, body), Ok("Revised text.".into()));
    }

    #[test]
    fn extracts_bounded_provider_errors() {
        let body = br#"{"error":{"message":"invalid model\nsecret-safe"}}"#;
        assert_eq!(
            parse_chat_response(400, body),
            Err(ResponseError::Http {
                status: 400,
                message: "invalid modelsecret-safe".into(),
            })
        );
    }

    #[test]
    fn rejects_missing_or_oversized_content() {
        assert_eq!(
            parse_chat_response(200, br#"{"choices":[]}"#),
            Err(ResponseError::MissingContent)
        );
        let content = "a".repeat(MAX_PROVIDER_OUTPUT_UTF16 + 1);
        let body = json!({"choices": [{"message": {"content": content}}]}).to_string();
        assert_eq!(
            parse_chat_response(200, body.as_bytes()),
            Err(ResponseError::OutputTooLong)
        );
    }
}
