//! Windows Credential Manager storage for provider API keys.

use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::ERROR_NOT_FOUND;
use windows::Win32::Security::Credentials::{
    CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_MAX_CREDENTIAL_BLOB_SIZE,
    CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
};

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

pub fn save_api_key(target: &str, secret: &mut [u8]) -> Result<(), String> {
    if secret.is_empty() {
        return Err("Enter an API key before saving.".into());
    }
    if std::str::from_utf8(secret).is_err()
        || secret.iter().any(|byte| matches!(*byte, b'\r' | b'\n' | 0))
    {
        return Err("The API key contains unsupported characters.".into());
    }
    if secret.len() > CRED_MAX_CREDENTIAL_BLOB_SIZE as usize {
        return Err("The API key is too long for Windows Credential Manager.".into());
    }

    let mut target = wide(target);
    let mut username = wide("SwiftSlate");
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target.as_mut_ptr()),
        CredentialBlobSize: secret.len() as u32,
        CredentialBlob: secret.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: PWSTR(username.as_mut_ptr()),
        ..Default::default()
    };
    unsafe { CredWriteW(&credential, 0) }
        .map_err(|error| format!("Could not save the API key in Credential Manager: {error}"))
}

pub fn read_api_key(target: &str) -> Result<Option<SecretBytes>, String> {
    let target = wide(target);
    let mut raw = std::ptr::null_mut::<CREDENTIALW>();
    match unsafe { CredReadW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, 0, &mut raw) } {
        Ok(()) if raw.is_null() => Ok(None),
        Ok(()) => {
            let allocation = CredentialAllocation(raw);
            let credential = unsafe { &*allocation.0 };
            if credential.CredentialBlob.is_null() || credential.CredentialBlobSize == 0 {
                return Ok(None);
            }
            let bytes = unsafe {
                std::slice::from_raw_parts(
                    credential.CredentialBlob,
                    credential.CredentialBlobSize as usize,
                )
            }
            .to_vec();
            Ok(Some(SecretBytes(bytes)))
        }
        Err(error) if error.code() == ERROR_NOT_FOUND.to_hresult() => Ok(None),
        Err(error) => Err(format!(
            "Could not read the API key from Credential Manager: {error}"
        )),
    }
}

pub fn delete_api_key(target: &str) -> Result<(), String> {
    let target = wide(target);
    match unsafe { CredDeleteW(PCWSTR(target.as_ptr()), CRED_TYPE_GENERIC, 0) } {
        Ok(()) => Ok(()),
        Err(error) if error.code() == ERROR_NOT_FOUND.to_hresult() => Ok(()),
        Err(error) => Err(format!(
            "Could not remove the API key from Credential Manager: {error}"
        )),
    }
}

struct CredentialAllocation(*mut CREDENTIALW);

impl Drop for CredentialAllocation {
    fn drop(&mut self) {
        unsafe { CredFree(self.0.cast()) };
    }
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}
