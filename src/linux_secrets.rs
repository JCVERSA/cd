//! Secret Service adapter using the standard `secret-tool` client.
//!
//! Secrets travel through pipes, never command-line arguments or environment
//! variables. Most Linux distributions package the client as `libsecret-tools`.

use std::io::{Read, Write};
use std::process::{Command, Stdio};

const MAX_SECRET_BYTES: usize = 16 * 1024;
const APPLICATION_ATTRIBUTE: &str = "swiftslate";

pub struct SecretBytes(Vec<u8>);

impl SecretBytes {
    pub fn as_utf8(&self) -> Result<&str, String> {
        std::str::from_utf8(&self.0)
            .map_err(|_| "The stored API key is not valid UTF-8.".to_owned())
    }
}

impl Drop for SecretBytes {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

pub fn read_api_key(target: &str) -> Result<Option<SecretBytes>, String> {
    let mut child = Command::new("secret-tool")
        .args([
            "lookup",
            "application",
            APPLICATION_ATTRIBUTE,
            "target",
            target,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(secret_tool_error)?;
    let mut output = Vec::new();
    child
        .stdout
        .take()
        .ok_or_else(|| "Could not read Secret Service output.".to_owned())?
        .take((MAX_SECRET_BYTES + 2) as u64)
        .read_to_end(&mut output)
        .map_err(|error| format!("Could not read the API key from Secret Service: {error}"))?;
    if output.len() > MAX_SECRET_BYTES + 1 {
        let _ = child.kill();
        let _ = child.wait();
        output.fill(0);
        return Err("The stored API key exceeds SwiftSlate's limit.".into());
    }
    let status = child
        .wait()
        .map_err(|error| format!("Could not wait for Secret Service: {error}"))?;
    if !status.success() {
        output.fill(0);
        return Ok(None);
    }
    if output.last() == Some(&b'\n') {
        output.pop();
        if output.last() == Some(&b'\r') {
            output.pop();
        }
    }
    if output.len() > MAX_SECRET_BYTES {
        output.fill(0);
        return Err("The stored API key exceeds SwiftSlate's limit.".into());
    }
    if output.is_empty() {
        Ok(None)
    } else {
        Ok(Some(SecretBytes(output)))
    }
}

pub fn save_api_key(target: &str, secret: &mut [u8]) -> Result<(), String> {
    validate_secret(secret)?;
    let mut child = Command::new("secret-tool")
        .args([
            "store",
            "--label=SwiftSlate API key",
            "application",
            APPLICATION_ATTRIBUTE,
            "target",
            target,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(secret_tool_error)?;
    child
        .stdin
        .take()
        .ok_or_else(|| "Could not open a pipe to Secret Service.".to_owned())?
        .write_all(secret)
        .map_err(|error| format!("Could not send the API key to Secret Service: {error}"))?;
    let status = child
        .wait()
        .map_err(|error| format!("Could not wait for Secret Service: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("Secret Service did not accept the API key.".into())
    }
}

pub fn delete_api_key(target: &str) -> Result<(), String> {
    let status = Command::new("secret-tool")
        .args([
            "clear",
            "application",
            APPLICATION_ATTRIBUTE,
            "target",
            target,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(secret_tool_error)?;
    if status.success() || status.code() == Some(1) {
        Ok(())
    } else {
        Err("Secret Service could not remove the API key.".into())
    }
}

fn validate_secret(secret: &[u8]) -> Result<(), String> {
    if secret.is_empty() {
        return Err("Enter an API key before saving.".into());
    }
    if secret.len() > MAX_SECRET_BYTES {
        return Err("The API key exceeds SwiftSlate's limit.".into());
    }
    if std::str::from_utf8(secret).is_err()
        || secret.iter().any(|byte| matches!(*byte, b'\r' | b'\n' | 0))
    {
        return Err("The API key contains unsupported characters.".into());
    }
    Ok(())
}

fn secret_tool_error(error: std::io::Error) -> String {
    if error.kind() == std::io::ErrorKind::NotFound {
        "Secret Service support requires the `secret-tool` command (often packaged as libsecret-tools)."
            .into()
    } else {
        format!("Could not start secret-tool: {error}")
    }
}
