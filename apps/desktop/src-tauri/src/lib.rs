mod attestation;
mod network_gate;
mod secrets;
mod storage;

use network_gate::NetworkGate;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // REQ- wording mentions a runtime swap between online.json and
    // offline.json capability files. explicitly rejects this
    // because Tauri 2 does not support runtime capability hot-swap. The
    // static `http:default` scope in capabilities/default.json IS the host
    // allow-list; the dynamic on/off lives in the NetworkGate state-mutex
    // managed below.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build()) // — auto save+restore window state (StateFlags::all() default)
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // auto-updater plugin. Endpoint + pubkey live in
        // tauri.conf.json plugins.updater (, ). The plugin handles
        // minisign signature verification against the pubkey before extraction.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // relaunch() target for installAndRestart() flow.
        .plugin(tauri_plugin_process::init())
        .manage(NetworkGate::new(false));

    // Debug builds register the dev-only mid-write command;
    // release builds do not — even the symbol is absent (cfg(debug_assertions)
    // strips at compile time).
    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        secrets::secrets_set,
        secrets::secrets_get,
        secrets::secrets_delete,
        secrets::secrets_probe,
        storage::metadata_save_atomic,
        storage::__test_write_metadata,
        network_gate::set_gate_state,
        attestation::attestation_status,
        attestation::attestation_enroll,
        attestation::attestation_sign,
        attestation::attestation_reset,
    ]);
    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        secrets::secrets_set,
        secrets::secrets_get,
        secrets::secrets_delete,
        secrets::secrets_probe,
        storage::metadata_save_atomic,
        network_gate::set_gate_state,
        attestation::attestation_status,
        attestation::attestation_enroll,
        attestation::attestation_sign,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
