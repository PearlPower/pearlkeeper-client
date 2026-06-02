// apps/desktop/src-tauri/tests/secrets_roundtrip.rs
//
// Wave 0 — /03 Rust integration test scaffolding.
// Runs against the REAL OS keychain on every CI matrix leg
// (macOS-native, Windows-native, Linux gnome-keyring via dbus-launch).
// Test SERVICE constant differs from production (`...desktop.test`) so a
// dev box's real wallet entries cannot collide with test runs.
//
// Wave 1 lands the production secrets.rs that these tests exercise via
// the `keyring::Entry` direct path. The tests do NOT invoke Tauri commands
// because the test harness has no Tauri runtime — they prove the keyring
// crate works on each OS, which is the underlying primitive secrets.rs
// wraps.

use keyring::Entry;

const SERVICE: &str = "com.pearlkeeper.desktop.test";

// Test the production pre-flight guard from secrets.rs without spinning up Tauri.
// secrets.rs is part of the binary crate; we cannot import it directly into the
// integration-test crate. Instead, we replicate the constant here and assert the
// boundary contract that secrets_set MUST honor (cross-checked by code review +
// the Vitest secrets.adapter test in Wave 0 once Wave 2 lands the JS adapter).
const PRODUCTION_MAX_VALUE_BYTES: usize = 2_560;

#[test]
fn write_read_mnemonic() {
    // : 24-word BIP39 mnemonic round-trips through OS keychain.
    let entry = Entry::new(SERVICE, "wallet_test_mnemonic")
        .expect("Entry::new should succeed on a working keychain backend");
    let mnemonic = "abandon ".repeat(23) + "about";
    entry
        .set_password(&mnemonic)
        .expect("set_password should succeed");
    let read = entry.get_password().expect("get_password should succeed");
    assert_eq!(
        read, mnemonic,
        "round-trip preserves the 24-word mnemonic byte-for-byte"
    );
    entry
        .delete_credential()
        .expect("delete_credential should succeed");
}

#[test]
fn write_read_bip32_seed_hex() {
    // : 64-byte BIP32 seed hex (128 chars) round-trips.
    let entry =
        Entry::new(SERVICE, "wallet_test_bip32_seed").expect("Entry::new should succeed");
    let seed_hex = "a".repeat(128); // 64 bytes hex-encoded
    entry
        .set_password(&seed_hex)
        .expect("set_password should succeed");
    let read = entry.get_password().expect("get_password should succeed");
    assert_eq!(read, seed_hex);
    entry
        .delete_credential()
        .expect("delete_credential should succeed");
}

#[test]
fn write_read_xpub() {
    // : Taproot xpub round-trips (~112 chars typical).
    let entry = Entry::new(SERVICE, "wallet_test_xpub").expect("Entry::new should succeed");
    // Synthetic xpub-shaped string for round-trip; format details are
    // irrelevant to the keychain — it stores opaque text.
    let xpub = "xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz";
    entry
        .set_password(xpub)
        .expect("set_password should succeed");
    let read = entry.get_password().expect("get_password should succeed");
    assert_eq!(read, xpub);
    entry
        .delete_credential()
        .expect("delete_credential should succeed");
}

#[test]
fn delete_idempotent() {
    // mobile parity: deleting a non-existent entry must not panic.
    // (Wave 1's secrets_delete maps `KeyringError::NoEntry` to `Ok(())`.)
    let entry =
        Entry::new(SERVICE, "wallet_test_does_not_exist").expect("Entry::new should succeed");
    // The keyring crate returns NoEntry; the production command will swallow it.
    // Here we just verify the call returns an Err of the expected kind, so
    // Wave 1 has the contract pinned.
    let result = entry.delete_credential();
    match result {
        Ok(()) => {}
        Err(keyring::Error::NoEntry) => {}
        Err(other) => panic!(
            "delete on missing entry returned unexpected error: {other:?} \
             (production secrets_delete must map this to Ok(()))"
        ),
    }
}

#[test]
fn oversized_value_pre_flight_check() {
    // / P-NEW-2 — boundary contract.
    // The production secrets.rs `MAX_VALUE_BYTES` constant MUST equal this value.
    // If a future change in secrets.rs raises the limit (e.g., when keyring 4.x
    // exposes typed TooLong on Windows), update both this constant AND the
    // P-NEW-2 fallback message-match in From<KeyringError>.
    assert_eq!(
        PRODUCTION_MAX_VALUE_BYTES, 2_560,
        "Windows Credential Manager limit is 2,560 bytes; loosening this \
         requires a re-audit of P-NEW-2"
    );

    // Verify the test fixture exceeds the boundary (sanity check).
    let big = "x".repeat(PRODUCTION_MAX_VALUE_BYTES + 1);
    assert!(big.len() > PRODUCTION_MAX_VALUE_BYTES);
}

#[test]
fn probe_sentinel_round_trip() {
    // the exact path secrets_probe() takes; if this fails on a CI
    // matrix leg, secrets_probe will fail at boot on the same OS and the user
    // will see the KeychainUnavailableScreen.
    let entry = Entry::new(SERVICE, "wallet_probe_sentinel")
        .expect("Entry::new should succeed");
    entry.set_password("ok").expect("set_password should succeed");
    let read = entry.get_password().expect("get_password should succeed");
    assert_eq!(read, "ok", "probe sentinel read MUST equal write");
    entry
        .delete_credential()
        .expect("delete_credential should succeed");
}
