// apps/desktop/src-tauri/src/attestation.rs — ...
// ed25519 keypair generation + signing for backend attestation. Private
// 32-byte seed is stored in OS keychain via 's keyring pattern;
// private material NEVER crosses the Tauri IPC boundary (T-27-DESK-01).
//
// SHARES the SERVICE constant from secrets.rs so that all keychain entries
// for this app live under the same logical namespace; uses the dedicated
// KEY_NAME "wallet_attestation_priv" so it doesn't collide with mnemonic
// / xpub / metadata entries.
//
// PRE-IMAGE CONTRACT (cross-checked against backend desktopVerifier.ts):
// The `attestation_sign(challenge, body_hash)` command computes
// digest = SHA256(body_hash || challenge)
// and signs `digest` directly with ed25519 (which is itself a 32-byte
// message — node:crypto.verify(null, digest, pubkey, sig) on the backend
// verifies over the same 32-byte digest). The TypeScript port passes
// `body_hash = base64(rawBody) + "."` so the Rust pre-image
// `<base64body>.<challenge>` matches the backend's
// `SHA256(<base64(rawBody)>.<challenge>)` byte-for-byte.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use keyring::{Entry, Error as KeyringError};
use rand::rngs::OsRng;
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::secrets::SERVICE;

/// Keychain entry name for the 32-byte ed25519 seed (base64-encoded ~44
/// chars — well under MAX_VALUE_BYTES = 2_560 from secrets.rs).
pub const KEY_NAME: &str = "wallet_attestation_priv";

#[derive(Debug, Serialize, thiserror::Error)]
#[serde(tag = "kind", content = "data")]
pub enum AttestationError {
    #[error("attestation key missing")]
    KeyMissing,
    #[error("keychain unavailable")]
    KeychainUnavailable,
    #[error("invalid challenge: {0}")]
    InvalidChallenge(String),
    #[error("io: {0}")]
    Io(String),
}

impl From<KeyringError> for AttestationError {
    fn from(e: KeyringError) -> Self {
        match e {
            // Linux: secret service / kwallet unreachable / not running.
            KeyringError::NoStorageAccess(_) => AttestationError::KeychainUnavailable,
            // macOS / Windows platform-specific failures.
            KeyringError::PlatformFailure(_) => AttestationError::KeychainUnavailable,
            // Caller-handled: the keygen path treats NoEntry as "not yet
            // enrolled" and runs the load_or_generate branch.
            KeyringError::NoEntry => AttestationError::KeyMissing,
            other => AttestationError::Io(other.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AttestationStatus {
    pub enrolled: bool,
    /// base64-encoded raw 32-byte ed25519 public key (or `None` if not enrolled).
    pub public_key: Option<String>,
    /// hex-encoded SHA-256 of the public key (64 chars; `None` if not enrolled).
    pub instance_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EnrollmentResult {
    /// base64-encoded raw 32-byte ed25519 public key.
    pub public_key: String,
    /// base64-encoded 64-byte ed25519 signature over `SHA256(public_key || challenge)`.
    pub signature: String,
    /// hex-encoded SHA-256 of the public key (the canonical instance_id).
    pub instance_id: String,
}

/// Read the stored seed and reconstruct the SigningKey. Returns `Err(KeyMissing)`
/// when the keychain entry is absent (caller decides whether to generate a fresh
/// key or surface to the user).
fn load_signing_key() -> Result<SigningKey, AttestationError> {
    let entry = Entry::new(SERVICE, KEY_NAME).map_err(AttestationError::from)?;
    let b64_seed = entry.get_password().map_err(AttestationError::from)?;
    let seed = B64
        .decode(&b64_seed)
        .map_err(|e| AttestationError::Io(format!("seed decode: {}", e)))?;
    let arr: [u8; 32] = seed
        .try_into()
        .map_err(|_| AttestationError::Io("seed length != 32".into()))?;
    Ok(SigningKey::from_bytes(&arr))
}

/// Idempotent: returns the existing key if one is enrolled, else generates a
/// fresh keypair (using the OS CSPRNG via `OsRng`), persists the 32-byte seed
/// to the keychain, and returns the new SigningKey.
fn load_or_generate_signing_key() -> Result<SigningKey, AttestationError> {
    match load_signing_key() {
        Ok(k) => Ok(k),
        Err(AttestationError::KeyMissing) => {
            let mut csprng = OsRng;
            let signing_key = SigningKey::generate(&mut csprng);
            let seed_b64 = B64.encode(signing_key.to_bytes());
            let entry = Entry::new(SERVICE, KEY_NAME).map_err(AttestationError::from)?;
            entry
                .set_password(&seed_b64)
                .map_err(AttestationError::from)?;
            Ok(signing_key)
        }
        Err(e) => Err(e),
    }
}

/// `instance_id = SHA256(public_key)` hex (64 chars). Backend re-derives via
/// node:crypto and constant-time-compares to the claimed value (T-27-DESK-02).
fn instance_id_for(pubkey: &VerifyingKey) -> String {
    let mut h = Sha256::new();
    h.update(pubkey.to_bytes());
    hex::encode(h.finalize())
}

/// Probe the keychain for an existing attestation key. Never generates one.
/// Returns `enrolled: false` (no error) when no entry exists — callers use
/// this to decide whether to surface "enroll" UI.
#[tauri::command]
pub fn attestation_status() -> Result<AttestationStatus, AttestationError> {
    match load_signing_key() {
        Ok(k) => {
            let pubkey = k.verifying_key();
            Ok(AttestationStatus {
                enrolled: true,
                public_key: Some(B64.encode(pubkey.to_bytes())),
                instance_id: Some(instance_id_for(&pubkey)),
            })
        }
        Err(AttestationError::KeyMissing) => Ok(AttestationStatus {
            enrolled: false,
            public_key: None,
            instance_id: None,
        }),
        Err(e) => Err(e),
    }
}

/// Idempotent enrollment: load or generate a keypair, then sign
/// `SHA256(public_key || challenge)` with it. Returns the public key (base64),
/// the signature (base64), and the instance_id (hex) — all values the backend's
/// `enrollDesktop` route expects in `DesktopEnrollRequest`.
///
/// PRIVATE KEY ISOLATION: the 32-byte seed is loaded from the keychain inside
/// this function and never appears in the return type — only the public key
/// + signature cross the IPC boundary (T-27-DESK-01).
#[tauri::command]
pub fn attestation_enroll(challenge: String) -> Result<EnrollmentResult, AttestationError> {
    if challenge.is_empty() {
        return Err(AttestationError::InvalidChallenge("empty".into()));
    }
    let signing_key = load_or_generate_signing_key()?;
    let pubkey = signing_key.verifying_key();
    let pub_bytes = pubkey.to_bytes();
    let mut h = Sha256::new();
    h.update(pub_bytes);
    h.update(challenge.as_bytes());
    let digest = h.finalize();
    // ed25519 signs the 32-byte SHA-256 digest as a message; the backend's
    // verifyDesktopSignature wraps the public key with SPKI ASN.1 + calls
    // crypto.verify('ed25519', digest, pubKey, sig) which validates the same
    // 32-byte digest as the signed message.
    let signature: Signature = signing_key.sign(&digest);
    Ok(EnrollmentResult {
        public_key: B64.encode(pub_bytes),
        signature: B64.encode(signature.to_bytes()),
        instance_id: instance_id_for(&pubkey),
    })
}

/// Per-request signing path. Caller MUST have already enrolled — if no keychain
/// entry exists, returns `KeyMissing` (the TypeScript port treats this as a
/// signal to re-enter the enrollment branch, not to generate a fresh key
/// silently — enrollment-state machine owns this transition).
///
/// Computes `digest = SHA256(body_hash || challenge)` and ed25519-signs the
/// digest. The TypeScript caller passes `body_hash = base64(rawBody) + "."`
/// (literal "." separator) so the resulting pre-image matches the backend's
/// `SHA256(<base64(rawBody)>.<challenge>)` byte-for-byte.
#[tauri::command]
pub fn attestation_sign(
    challenge: String,
    body_hash: String,
) -> Result<String, AttestationError> {
    if challenge.is_empty() {
        return Err(AttestationError::InvalidChallenge("empty".into()));
    }
    let signing_key = load_signing_key()?; // KeyMissing if not enrolled.
    let mut h = Sha256::new();
    h.update(body_hash.as_bytes());
    h.update(challenge.as_bytes());
    let digest = h.finalize();
    let signature: Signature = signing_key.sign(&digest);
    Ok(B64.encode(signature.to_bytes()))
}

/// Debug-only: delete the keychain entry so the next enrollment call generates
/// a fresh keypair. ABSOLUTELY MUST NOT ship in release — `#[cfg(debug_assertions)]`
/// strips it from the binary entirely (T-27-RESET-01 mitigation per RESEARCH
/// Anti-Pattern: "DON'T register attestation_reset outside cfg(debug_assertions)").
///
/// NoEntry is OK (idempotent — deleting an absent entry is a no-op).
#[tauri::command]
#[cfg(debug_assertions)]
pub fn attestation_reset() -> Result<(), AttestationError> {
    let entry = Entry::new(SERVICE, KEY_NAME).map_err(AttestationError::from)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(AttestationError::from(e)),
    }
}
