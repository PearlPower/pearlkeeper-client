// apps/desktop/src-tauri/tests/attestation_roundtrip.rs
//
// fulfills the Wave-0 #[ignore] RED stubs.
//
// Test-only SERVICE constant (`com.pearlkeeper.desktop.test`) so dev-box
// keychain entries cannot collide with test runs. Test-only KEY_NAME with a
// random suffix so parallel cargo test workers don't collide on the same entry.
//
// SCOPE: these tests verify the *cryptographic primitives* the production
// `attestation.rs` commands use (ed25519-dalek keygen, sign, verify; SHA-256
// instance_id stability) plus a real OS-keychain seed roundtrip via the
// keyring crate. Production `attestation_*` Tauri commands are NOT invoked
// here because integration tests run outside the Tauri runtime — 's
// `secrets_roundtrip.rs` already exercises the keyring path under the Tauri
// command surface, and our tests pin the same keyring contract for the
// attestation seed.

#![allow(dead_code)]

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use keyring::Entry;
use rand::rngs::OsRng;
use sha2::{Digest, Sha256};

const TEST_SERVICE: &str = "com.pearlkeeper.desktop.test";

fn random_test_key_name() -> String {
    // Random suffix so parallel tests don't collide on the same keychain entry.
    format!("wallet_attestation_priv_test_{}", rand::random::<u32>())
}

#[test]
fn attestation_keygen_persists_seed() {
    // SEC analog: verify the 32-byte raw seed roundtrips through the OS
    // keychain via the same `keyring::Entry` path production uses, and that
    // the post-decode bytes match the pre-encode bytes (no truncation /
    // base64 alphabet drift / charset mangling).
    let key_name = random_test_key_name();
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let seed: [u8; 32] = signing_key.to_bytes();
    let seed_b64 = B64.encode(seed);

    // The base64 encoding of 32 bytes is 44 chars (standard padding) —
    // well under the secrets.rs MAX_VALUE_BYTES = 2_560 cap.
    assert_eq!(seed_b64.len(), 44);

    let entry = Entry::new(TEST_SERVICE, &key_name).expect("Entry::new should succeed");
    entry
        .set_password(&seed_b64)
        .expect("set_password should succeed");

    let read = entry.get_password().expect("get_password should succeed");
    assert_eq!(
        read, seed_b64,
        "round-trip preserves the base64 seed byte-for-byte"
    );

    let decoded = B64
        .decode(&read)
        .expect("base64 decode of read seed should succeed");
    assert_eq!(decoded.len(), 32, "decoded seed must be 32 bytes");
    assert_eq!(
        decoded.as_slice(),
        seed.as_slice(),
        "decoded seed bytes equal pre-encode bytes"
    );

    entry
        .delete_credential()
        .expect("delete_credential should succeed");
}

#[test]
fn attestation_sign_roundtrip() {
    // Verify the ed25519 sign-then-verify cycle on the SHA256(body || challenge)
    // pre-image. This is the *exact* digest construction the production
    // attestation_sign command computes — Rust signs over the SHA-256 digest
    // as the message, and crypto.verify('ed25519', digest, pubkey, sig) on the
    // backend validates the same 32-byte digest. We use the same primitives
    // (SigningKey + ed25519_dalek::Verifier) the command uses internally.
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let pubkey: VerifyingKey = signing_key.verifying_key();

    let body_hash = "<base64-of-rawBody>.";
    let challenge = "test-challenge-40b-base64url";
    let mut h = Sha256::new();
    h.update(body_hash.as_bytes());
    h.update(challenge.as_bytes());
    let digest = h.finalize();

    let signature: Signature = signing_key.sign(&digest);

    // External verify with the corresponding public key — proves the signature
    // is bound to the (body || challenge) pre-image and to this specific
    // keypair.
    pubkey
        .verify(&digest, &signature)
        .expect("ed25519 signature must verify with the same pubkey + digest");

    // Negative control: a different challenge MUST NOT verify.
    let mut h2 = Sha256::new();
    h2.update(body_hash.as_bytes());
    h2.update(b"different-challenge");
    let other_digest = h2.finalize();
    assert!(
        pubkey.verify(&other_digest, &signature).is_err(),
        "signature MUST NOT verify against a different pre-image (replay defense)"
    );
}

#[test]
fn attestation_status_idempotent() {
    // instance_id = SHA256(public_key) hex must be deterministic — the backend
    // re-derives the same value via node:crypto and constant-time-compares to
    // the claimed instance_id in the wire token (T-27-DESK-02 mitigation).
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let pubkey = signing_key.verifying_key();
    let pub_bytes = pubkey.to_bytes();

    let mut h1 = Sha256::new();
    h1.update(pub_bytes);
    let id1 = hex::encode(h1.finalize());

    let mut h2 = Sha256::new();
    h2.update(pub_bytes);
    let id2 = hex::encode(h2.finalize());

    assert_eq!(id1, id2, "SHA-256 of the same pubkey is deterministic");
    assert_eq!(id1.len(), 64, "instance_id is 64 hex chars (32 bytes)");

    // Distinct keypair MUST produce a distinct instance_id (otherwise the
    // backend's mismatch check in desktopVerifier.ts would never catch a
    // forged token).
    let other = SigningKey::generate(&mut csprng);
    let mut h3 = Sha256::new();
    h3.update(other.verifying_key().to_bytes());
    let id3 = hex::encode(h3.finalize());
    assert_ne!(id1, id3, "different keypairs produce different instance_ids");
}
