//! Non-secret Linux provider configuration.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::PathBuf;

use serde_json::{json, Value};
use swiftslate::provider::ProviderConfig;

const MAX_CONFIG_BYTES: u64 = 16 * 1024;

pub const DEFAULT_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";
pub const DEFAULT_MODEL: &str = "gpt-4o-mini";

pub fn load_provider_config() -> Result<Option<ProviderConfig>, String> {
    let path = config_path()?;
    let mut file = match File::open(&path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not open {}: {error}", path.display())),
    };
    if file
        .metadata()
        .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?
        .len()
        > MAX_CONFIG_BYTES
    {
        return Err("SwiftSlate's provider configuration is oversized.".into());
    }

    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(MAX_CONFIG_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    if bytes.len() as u64 > MAX_CONFIG_BYTES {
        return Err("SwiftSlate's provider configuration is oversized.".into());
    }
    parse_config(&bytes).map(Some)
}

pub fn load_or_default() -> Result<ProviderConfig, String> {
    load_provider_config()?.map_or_else(
        || ProviderConfig::new(DEFAULT_ENDPOINT, DEFAULT_MODEL).map_err(|error| error.to_string()),
        Ok,
    )
}

pub fn save_provider_config(config: &ProviderConfig) -> Result<(), String> {
    let path = config_path()?;
    let directory = path
        .parent()
        .ok_or_else(|| "The provider configuration path has no parent.".to_owned())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create {}: {error}", directory.display()))?;
    fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("Could not secure {}: {error}", directory.display()))?;

    let bytes = serde_json::to_vec_pretty(&json!({
        "endpoint": config.endpoint,
        "model": config.model,
    }))
    .map_err(|_| "Could not encode the provider configuration.".to_owned())?;
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&temporary)
            .map_err(|error| format!("Could not create {}: {error}", temporary.display()))?;
        file.set_permissions(fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Could not secure {}: {error}", temporary.display()))?;
        file.write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(|error| format!("Could not write {}: {error}", temporary.display()))?;
        fs::rename(&temporary, &path)
            .map_err(|error| format!("Could not replace {}: {error}", path.display()))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn parse_config(bytes: &[u8]) -> Result<ProviderConfig, String> {
    let value: Value = serde_json::from_slice(bytes)
        .map_err(|_| "SwiftSlate's provider configuration is invalid JSON.".to_owned())?;
    let endpoint = value
        .get("endpoint")
        .and_then(Value::as_str)
        .ok_or_else(|| "The provider configuration has no endpoint.".to_owned())?;
    let model = value
        .get("model")
        .and_then(Value::as_str)
        .ok_or_else(|| "The provider configuration has no model.".to_owned())?;
    ProviderConfig::new(endpoint, model).map_err(|error| error.to_string())
}

fn config_path() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(path).join("swiftslate/provider.json"));
    }
    let home = std::env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Neither XDG_CONFIG_HOME nor HOME is set.".to_owned())?;
    Ok(PathBuf::from(home).join(".config/swiftslate/provider.json"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bounded_nonsecret_config() {
        let config = parse_config(
            br#"{"endpoint":"https://example.com/v1/chat/completions","model":"small"}"#,
        )
        .unwrap();
        assert_eq!(config.model, "small");
    }

    #[test]
    fn rejects_missing_or_insecure_config() {
        assert!(parse_config(br#"{"endpoint":"https://example.com"}"#).is_err());
        assert!(parse_config(br#"{"endpoint":"http://example.com","model":"x"}"#).is_err());
    }
}
