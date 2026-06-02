// apps/desktop/src-tauri/src/storage.rs
//
// (P-NEW-1, , ) — atomic metadata write command.
//
// `tauri-plugin-store::Store::save()` writes via fs::write (non-atomic).
// demands "old-or-new on power loss"; only an atomic temp-file +
// rename gives that guarantee. This module owns that primitive.
//
// JS-side StoragePort (apps/desktop/src/platform/storage.ts) lands in Wave 2
// and routes setItem/removeItem durable writes through `metadata_save_atomic`
// instead of (or in addition to) Store.save().
//
// Dev-only `__test_write_metadata` is the SIGKILL UAT trigger (). The
// command vanishes from release builds via cfg(debug_assertions), and the
// handler entry in lib.rs is correspondingly cfg-gated — even a compromised
// frontend that knows the command name gets "command not found" in release.

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tempfile::NamedTempFile;

/// Atomic write helper.
/// `path`: absolute file path the JS adapter computed via `Store.path()` /
/// `BaseDirectory.AppData`. Rust does not compute the path itself
/// to keep the directory-resolution logic in JS land where Wave 2's
/// `@tauri-apps/plugin-store` lives.
/// `contents`: the full serialized JSON the JS adapter computed (Store.set
/// followed by Store.save with autoSave:false leaves the in-memory
/// state correct; Wave 2 reads back via Store.entries() then
/// JSON.stringify-s into `contents`).
fn atomic_write(path: &str, contents: &str) -> Result<(), String> {
    let target = PathBuf::from(path);
    let parent = target
        .parent()
        .ok_or_else(|| "metadata_save_atomic: path has no parent dir".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("create_dir_all: {e}"))?;
    let mut tmp =
        NamedTempFile::new_in(parent).map_err(|e| format!("NamedTempFile::new_in: {e}"))?;
    tmp.write_all(contents.as_bytes())
        .map_err(|e| format!("write_all: {e}"))?;
    tmp.as_file()
        .sync_data()
        .map_err(|e| format!("sync_data: {e}"))?;
    // tempfile::persist performs std::fs::rename — atomic on POSIX & NTFS.
    tmp.persist(&target)
        .map_err(|e| format!("persist (rename): {}", e.error))?;
    Ok(())
}

/// Production atomic-save command. Wave 2's StoragePort.setItem and
/// StoragePort.removeItem call this after Store.set/Store.delete to
/// satisfy .
#[tauri::command]
pub fn metadata_save_atomic(path: String, contents: String) -> Result<(), String> {
    atomic_write(&path, &contents)
}

/// Dev-only mid-write trigger for the SIGKILL UAT ().
/// Compile-time stripped from release binaries; the handler entry in lib.rs
/// is also cfg-gated. UAT script (Wave 4 — scripts/uat/atomicity.sh) invokes
/// this via a debug-only CLI flag on the binary.
///
/// Behavior is identical to `metadata_save_atomic` so the SIGKILL test
/// exercises the exact same write path; the only difference is the
/// compile-time gate.
#[cfg(debug_assertions)]
#[tauri::command]
pub fn __test_write_metadata(path: String, contents: String) -> Result<(), String> {
    atomic_write(&path, &contents)
}
