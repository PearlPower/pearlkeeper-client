// apps/desktop/src/platform/storage.ts
//
// (, , P-NEW-1) — real StoragePort backed by
// @tauri-apps/plugin-store, with durable writes routed through the Rust
// `metadata_save_atomic` command (P-NEW-1 fix).
//
// Why not just call store.save()?
// tauri-plugin-store@2.4.2 implements save() as fs::write — non-atomic.
// demands "old-or-new on power loss"; only an atomic temp-file +
// rename gives that guarantee. The Rust `metadata_save_atomic` command
// in src-tauri/src/storage.rs uses `tempfile::NamedTempFile` + `persist`
// which is `std::fs::rename` — atomic on POSIX & NTFS.
//
// Persistence contract preserved across mobile/desktop:
// Single store file `wallet-state.json` at BaseDirectory::AppData.
// One top-level key per Zustand store (`prl_wallet_registry`,
// `prl-pin`, etc.). Wallet metadata (wallets[], activeWalletId) lands
// under `prl_wallet_registry`; walletType is NEVER serialized into
// this file ( invariant).
//
// Lazy load: the Store handle is constructed once per process (first
// getItem/setItem/removeItem call) and cached. `autoSave: false` means we
// own the durable-write trigger explicitly — exactly one
// `metadata_save_atomic` per setItem / removeItem.
//
// Path resolution: @tauri-apps/plugin-store@2.4.2 does not expose
// Store.path() on its public API (verified against dist-js/index.d.ts).
// We compute the on-disk path the same way the plugin does:
// appDataDir() / STORE_FILE
// and pass it to the Rust atomic-save command.

import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { load, type Store } from "@tauri-apps/plugin-store";
import type { StoragePort } from "@prl-wallet/app-adapters";

const STORE_FILE = "wallet-state.json";

let storePromise: Promise<Store> | null = null;
let pathPromise: Promise<string> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false, defaults: {} });
  }
  return storePromise;
}

function getStorePath(): Promise<string> {
  if (!pathPromise) {
    pathPromise = (async () => {
      const dir = await appDataDir();
      return join(dir, STORE_FILE);
    })();
  }
  return pathPromise;
}

/**
 * Build the JSON payload that metadata_save_atomic writes. The shape
 * matches what tauri-plugin-store's Store.save() would write (an object
 * keyed by every store entry), so a Wave 4 SIGKILL UAT can interleave
 * Store.save() and metadata_save_atomic without payload divergence.
 */
async function serializeStoreState(store: Store): Promise<string> {
  const entries = await store.entries();
  const obj: Record<string, unknown> = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return JSON.stringify(obj);
}

async function durableWrite(store: Store): Promise<void> {
  const path = await getStorePath();
  const contents = await serializeStoreState(store);
  // P-NEW-1 fix: route the durable write through the Rust atomic command,
  // NOT store.save() (which is non-atomic fs::write).
  await invoke<void>("metadata_save_atomic", {
    path,
    contents,
  });
}

export function createDesktopStorage(): StoragePort {
  return {
    async getItem(key) {
      const store = await getStore();
      const value = await store.get<string>(key);
      return value ?? null;
    },
    async setItem(key, value) {
      const store = await getStore();
      await store.set(key, value);
      await durableWrite(store);
    },
    async removeItem(key) {
      const store = await getStore();
      await store.delete(key);
      await durableWrite(store);
    },
  };
}
