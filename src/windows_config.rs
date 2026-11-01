//! Non-secret Windows provider configuration stored under HKCU.
//!
//! API keys never enter the registry; they are handled by Windows Credential
//! Manager in `windows_secrets`.

use std::ffi::c_void;

use swiftslate::provider::ProviderConfig;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegGetValueW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    KEY_WRITE, REG_OPTION_NON_VOLATILE, REG_SAM_FLAGS, REG_SZ, RRF_RT_REG_SZ,
};

const SUBKEY: &str = "Software\\SwiftSlate";
const ENDPOINT_VALUE: &str = "ProviderEndpoint";
const MODEL_VALUE: &str = "ProviderModel";

pub const DEFAULT_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";

pub fn load_provider_config() -> Result<Option<ProviderConfig>, String> {
    let endpoint = read_string(ENDPOINT_VALUE)?;
    let model = read_string(MODEL_VALUE)?;
    match (endpoint, model) {
        (Some(endpoint), Some(model)) => ProviderConfig::new(endpoint, model)
            .map(Some)
            .map_err(|error| error.to_string()),
        _ => Ok(None),
    }
}

pub fn save_provider_config(config: &ProviderConfig) -> Result<(), String> {
    unsafe {
        let subkey = wide(SUBKEY);
        let mut key = HKEY::default();
        let access = REG_SAM_FLAGS(KEY_READ.0 | KEY_WRITE.0);
        let status = RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            access,
            None,
            &mut key,
            None,
        );
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Could not open SwiftSlate settings (Windows error {}).",
                status.0
            ));
        }
        let key = RegistryKey(key);
        write_string(key.0, ENDPOINT_VALUE, &config.endpoint)?;
        write_string(key.0, MODEL_VALUE, &config.model)
    }
}

struct RegistryKey(HKEY);

impl Drop for RegistryKey {
    fn drop(&mut self) {
        unsafe {
            let _ = RegCloseKey(self.0);
        }
    }
}

fn read_string(value_name: &str) -> Result<Option<String>, String> {
    unsafe {
        let subkey = wide(SUBKEY);
        let value_name = wide(value_name);
        let mut byte_count = 0u32;
        let status = RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            PCWSTR(value_name.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut byte_count),
        );
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Could not read SwiftSlate settings (Windows error {}).",
                status.0
            ));
        }
        if byte_count < 2 || byte_count % 2 != 0 {
            return Err("SwiftSlate settings contain an invalid string.".into());
        }

        let mut buffer = vec![0u16; byte_count as usize / 2];
        let status = RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            PCWSTR(value_name.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            Some(buffer.as_mut_ptr().cast::<c_void>()),
            Some(&mut byte_count),
        );
        if status != ERROR_SUCCESS {
            return Err(format!(
                "Could not read SwiftSlate settings (Windows error {}).",
                status.0
            ));
        }
        let length = buffer
            .iter()
            .position(|unit| *unit == 0)
            .unwrap_or(buffer.len());
        Ok(Some(String::from_utf16_lossy(&buffer[..length])))
    }
}

unsafe fn write_string(key: HKEY, value_name: &str, value: &str) -> Result<(), String> {
    let value_name = wide(value_name);
    let value = wide(value);
    let bytes = std::slice::from_raw_parts(value.as_ptr().cast::<u8>(), value.len() * 2);
    let status = RegSetValueExW(key, PCWSTR(value_name.as_ptr()), 0, REG_SZ, Some(bytes));
    if status == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(format!(
            "Could not save SwiftSlate settings (Windows error {}).",
            status.0
        ))
    }
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}
