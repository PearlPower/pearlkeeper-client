// apps/desktop/src-tauri/src/secrets.rs
//
// (.., , ) — keyring-backed secrets commands.
// Mirrors mobile's apps/mobile/src/services/secureStorage.ts contract:
// Per-secret keychain entries (; never JSON blob).
// SERVICE = bundle identifier (matches tauri.conf.json).
// delete is idempotent (NoEntry → Ok(())).
// Probe = set+read+match+delete on a sentinel key ().
//
// P-NEW-2: pre-flight `value.len() > 2_560` check before set_password,
// because keyring 3.6.3 windows-native does not surface TooLong for
// oversized blobs (returns PlatformFailure(ERROR_INVALID_PARAMETER)).

use keyring::{Entry, Error as KeyringError};
use serde::Serialize;

/// Keychain service name. MUST match tauri.conf.json `identifier`.
/// Future-proofs macOS signing ACL (per-app keychain access group).
pub const SERVICE: &str = "com.pearlkeeper.desktop";

/// Maximum value size enforced before invoking the keychain backend.
/// Windows Credential Manager `CRED_MAX_CREDENTIAL_BLOB_SIZE` = 2,560 bytes.
/// macOS / Linux backends accept larger values, but we apply the same cap
/// for cross-platform parity (PITFALLS P11).
pub const MAX_VALUE_BYTES: usize = 2_560;

const SENTINEL_KEY: &str = "wallet_probe_sentinel";
const SENTINEL_VAL: &str = "ok";

#[derive(Debug, Serialize, thiserror::Error)]
#[serde(tag = "kind", content = "data")]
pub enum SecretError {
    #[error("no backend (Linux Secret Service unavailable?)")]
    NoBackend,
    #[error("value too large: {bytes} bytes")]
    ValueTooLarge { bytes: usize },
    #[error("access denied")]
    AccessDenied,
    #[error("io: {0}")]
    Io(String),
}

impl From<KeyringError> for SecretError {
    fn from(e: KeyringError) -> Self {
        match e {
            // Linux: secret service / kwallet unreachable / not running.
            KeyringError::NoStorageAccess(_) => SecretError::NoBackend,
            // Windows / macOS: platform-specific failures wrapped here.
            // P-NEW-2: ERROR_INVALID_PARAMETER (0x80070057) on Windows means
            // the credential blob exceeded 2,560 bytes — surface as ValueTooLarge.
            KeyringError::PlatformFailure(inner) => {
                let s = inner.to_string();
                if s.contains("0x80070057") || s.contains("password is too long") {
                    // bytes unknown at this layer; pre-flight check normally
                    // catches this before we get here.
                    SecretError::ValueTooLarge { bytes: 0 }
                } else if s.contains("access denied") || s.contains("AccessDenied") {
                    SecretError::AccessDenied
                } else {
                    SecretError::Io(s)
                }
            }
            // keyring 3.6.x emits TooLong on the Linux secret-service path
            // when D-Bus rejects an oversize attribute. Carries length info.
            KeyringError::TooLong(_, len) => SecretError::ValueTooLarge {
                bytes: len as usize,
            },
            // Treated as Io — callers (secrets_get, secrets_delete) handle
            // this variant explicitly before delegating to From conversion.
            KeyringError::NoEntry => SecretError::Io("NoEntry".into()),
            other => SecretError::Io(other.to_string()),
        }
    }
}

#[tauri::command]
pub fn secrets_set(key: &str, value: &str) -> Result<(), SecretError> {
    // P-NEW-2 pre-flight — defense in depth. Production wallet payloads
    // (mnemonic ~216, seed 128, xpub ~112, type <15, pin_hash 64) all fit
    // comfortably under 2,560; this check guards against a future caller
    // accidentally JSON-wrapping multiple secrets.
    if value.len() > MAX_VALUE_BYTES {
        return Err(SecretError::ValueTooLarge { bytes: value.len() });
    }
    Entry::new(SERVICE, key)
        .map_err(SecretError::from)?
        .set_password(value)
        .map_err(SecretError::from)
}

#[tauri::command]
pub fn secrets_get(key: &str) -> Result<Option<String>, SecretError> {
    let entry = Entry::new(SERVICE, key).map_err(SecretError::from)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        // Mobile parity: missing keys return null, not an error.
        Err(KeyringError::NoEntry) => Ok(None),
        Err(e) => Err(SecretError::from(e)),
    }
}

#[tauri::command]
pub fn secrets_delete(key: &str) -> Result<(), SecretError> {
    let entry = Entry::new(SERVICE, key).map_err(SecretError::from)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        // Mobile parity: deleting a non-existent entry is a no-op.
        Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(SecretError::from(e)),
    }
}

#[tauri::command]
pub fn secrets_probe() -> Result<(), SecretError> {
    // : write→read→match→delete a sentinel. Same code on every OS;
    // catches missing daemon, full disk, and ACL issues uniformly.
    // The sentinel value is observable in macOS Keychain.app for ~ms
    // (delete is synchronous); invisible in Windows Credential Manager.
    let entry = Entry::new(SERVICE, SENTINEL_KEY).map_err(SecretError::from)?;
    entry
        .set_password(SENTINEL_VAL)
        .map_err(SecretError::from)?;
    let read = entry.get_password().map_err(SecretError::from)?;
    if read != SENTINEL_VAL {
        return Err(SecretError::Io("sentinel mismatch".into()));
    }
    entry.delete_credential().map_err(SecretError::from)?;
    Ok(())
}
