// apps/desktop/src-tauri/src/network_gate.rs
//
// (, ). Rust state-mutex tracking the user's network toggle.
// The mutex is the WRITE side of a frontend-canonical state machine — the
// front-end's Zustand networkGateStore is the source of truth, and the
// `set_gate_state` IPC command mirrors changes here. Today's only Rust-side
// reader is diagnostic; future phases (e.g., idle-auto-lock) may
// consult `is_open` from Rust contexts that don't have access to the Zustand
// store.
//
// REQ- wording mentions online.json/offline.json capability swap;
// directs this Rust state-mutex path because Tauri 2 does
// NOT support runtime capability hot-swap. The static capability scope
// (default.json) IS the host allow-list; this mutex IS the on/off.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct NetworkGate(pub Arc<AtomicBool>);

impl NetworkGate {
    pub fn new(initial: bool) -> Self {
        Self(Arc::new(AtomicBool::new(initial)))
    }
    pub fn is_open(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
    pub fn set_open(&self, v: bool) {
        self.0.store(v, Ordering::Release);
    }
}

#[tauri::command]
pub fn set_gate_state(state: tauri::State<NetworkGate>, is_open: bool) {
    state.set_open(is_open);
}
