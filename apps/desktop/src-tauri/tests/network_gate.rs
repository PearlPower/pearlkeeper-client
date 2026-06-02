// apps/desktop/src-tauri/tests/network_gate.rs
//
// NetworkGate state-mutex round-trip integration test.
// Tests the underlying primitive (Arc<AtomicBool>) without spinning up
// Tauri runtime. Mirrors 's secrets_roundtrip.rs pattern:
// prove the primitive works before asserting any IPC behavior.

// Re-export the module from lib.rs's path. Cargo's [[test]] integration
// tests are compiled separately, so we declare a local path mod.
#[path = "../src/network_gate.rs"]
mod network_gate;

use network_gate::NetworkGate;

#[test]
fn new_with_false_is_closed() {
    let gate = NetworkGate::new(false);
    assert_eq!(gate.is_open(), false);
}

#[test]
fn new_with_true_is_open() {
    let gate = NetworkGate::new(true);
    assert_eq!(gate.is_open(), true);
}

#[test]
fn set_open_flips_state() {
    let gate = NetworkGate::new(false);
    gate.set_open(true);
    assert_eq!(gate.is_open(), true);
    gate.set_open(false);
    assert_eq!(gate.is_open(), false);
}

#[test]
fn last_write_wins() {
    let gate = NetworkGate::new(false);
    gate.set_open(true);
    gate.set_open(false);
    gate.set_open(true);
    assert_eq!(gate.is_open(), true);
}
