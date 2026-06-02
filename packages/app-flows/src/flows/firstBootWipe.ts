/**
 * All flat v1.0 SecureStore keys that must be wiped on the first boot with
 * code. Includes the PIN hash — the user re-creates their PIN on
 * first launch after the upgrade because all wallet data is lost.
 *
 * NOTE: In v1.1 the PIN hash remains under the same global key
 * (prl_wallet_pin_hash), but it is wiped here because v1.0 data is
 * incompatible — the user must start fresh.
 */
export const V1_SECURE_KEYS = [
  "prl_wallet_mnemonic",
  "prl_wallet_type",
  "prl_wallet_xpub",
  "prl_wallet_wif",
  "prl_wallet_bip32_seed",
  "prl_wallet_blockchain_id",
  "prl_wallet_network_id",
  "prl_wallet_pin_hash",
] as const;

export const DATA_VERSION_KEY = "prl_data_version";
export const CURRENT_DATA_VERSION = "2";

export interface FirstBootWipeOptions {
  getDataVersion(key: string): Promise<string | null>;
  setDataVersion(key: string, value: string): Promise<void>;
  clearAllData(): Promise<void>;
  deleteSecureKeys(keys: readonly string[]): Promise<void>;
}

/**
 * On the first launch with v1.1 code, wipe all v1.0 flat SecureStore keys
 * and clear AsyncStorage, then mark the data version as "2". On subsequent
 * launches this function is a no-op.
 *
 * Platform-specific I/O (AsyncStorage, SecureStore on mobile; keyring +
 * plugin-store on desktop) is injected via FirstBootWipeOptions so this
 * helper stays shared-package clean.
 */
export async function performFirstBootWipeIfNeeded(
  opts: FirstBootWipeOptions,
): Promise<void> {
  const version = await opts.getDataVersion(DATA_VERSION_KEY);
  if (version === CURRENT_DATA_VERSION) return;

  // Wipe all v1.0 SecureStore keys (best-effort — caller swallows
  // individual deletion errors)
  await opts.deleteSecureKeys(V1_SECURE_KEYS);

  // Wipe all AsyncStorage / plugin-store data (clears any old Zustand
  // persist data)
  await opts.clearAllData();

  // Mark as v2 so subsequent boots skip this
  await opts.setDataVersion(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
}
