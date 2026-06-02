import * as SecureStore from "expo-secure-store";
import { argon2idAsync } from "@noble/hashes/argon2";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils";
import {
  argon2idRawHex,
  isArgon2NativeAvailable,
} from "../../modules/argon2-native";
import type { WalletType } from "../store/walletListStore";

// ─── Secure store options ────────────────────────────────────────────────────

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// ─── Global key constants ────────────────────────────────────────────────────

const PIN_HASH_KEY = "prl_wallet_pin_hash";

// ─── Per-wallet key constructors ─────────────────────────────────────────────

const walletKey = (walletId: string, suffix: string) =>
  `wallet_${walletId}_${suffix}`;

// ─── Error handling helper ───────────────────────────────────────────────────

function handleKeychainError(_error: unknown): never {
  throw new Error("KEYCHAIN_UNAVAILABLE");
}

// ─── PIN hashing (S-CRITICAL-1 fix) ──────────────────────────────────────────
//
// PIN is hashed with Argon2id + a per-install 16-byte random salt. The OLD
// scheme was raw SHA-256(pin) — a 6-digit PIN has a 10^6 keyspace so a full
// rainbow table fits in ~32MB and reverses any captured hash in seconds. The
// new format is a self-describing record persisted in `prl_wallet_pin_hash`:
//
// argon2id-v1$<saltHex:32>$<hashHex:64>
//
// Argon2id parameters — OWASP ASVS minimum (Argon2 v1.3, 2023):
// t=2 iterations, m=19 MiB, p=1 lanes, dkLen=32 bytes
//
// We use the OWASP minimum rather than the "recommended" tier (m=64MB)
// because @noble/hashes' pure-JS Argon2id is single-threaded and would
// freeze the RN UI thread for several seconds at m=64MB. Brute-force cost
// against a 6-digit PIN at these params is still ~hours on a high-end GPU
// and ~weeks on commodity CPU — combined with the rate-limit + 10-attempt
// lockout in lockStore, this raises captured-hash recovery cost from
// "seconds" (the SHA-256 baseline) to "infeasible under realistic threats".
//
// Each create generates a fresh salt; verify parses the record and re-hashes
// against the stored salt. Comparison is constant-time. No migration path —
// pre-release, no users on the legacy scheme.

const ARGON2ID_RECORD_PREFIX = "argon2id-v1";
const ARGON2ID_PARAMS = { t: 2, m: 19 * 1024, p: 1, dkLen: 32 } as const;
const PIN_SALT_BYTES = 16;
const PIN_ENCODER = new TextEncoder();

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) acc |= a[i] ^ b[i];
  return acc === 0;
}

// Argon2id → hex. Uses the native module (off the JS thread, ~tens of ms on
// device) when present; falls back to pure-JS @noble (Expo Go / web / tests,
// or if the native call ever fails). Both produce byte-identical output for
// these params, so stored records verify regardless of which path ran.
async function argon2idHex(pin: string, salt: Uint8Array): Promise<string> {
  if (isArgon2NativeAvailable) {
    try {
      return await argon2idRawHex(
        pin,
        bytesToHex(salt),
        ARGON2ID_PARAMS.t,
        ARGON2ID_PARAMS.m,
        ARGON2ID_PARAMS.p,
        ARGON2ID_PARAMS.dkLen,
      );
    } catch {
      // Fall through to the JS implementation.
    }
  }
  const hash = await argon2idAsync(
    PIN_ENCODER.encode(pin),
    salt,
    ARGON2ID_PARAMS,
  );
  return bytesToHex(hash);
}

/**
 * Generate a fresh PIN record for first-time setup or PIN change. The
 * returned string is opaque to callers; store it verbatim via
 * `storePinHash(record)` and verify with `verifyPin(pin, record)`.
 */
export async function createPinRecord(pin: string): Promise<string> {
  const salt = randomBytes(PIN_SALT_BYTES);
  const hashHex = await argon2idHex(pin, salt);
  return `${ARGON2ID_RECORD_PREFIX}$${bytesToHex(salt)}$${hashHex}`;
}

/**
 * Verify a PIN against a stored record. Returns false on any parse/length
 * mismatch or hash divergence; never throws.
 */
export async function verifyPin(pin: string, record: string): Promise<boolean> {
  const parts = record.split("$");
  if (parts.length !== 3 || parts[0] !== ARGON2ID_RECORD_PREFIX) return false;
  const [, saltHex, expectedHex] = parts;
  if (saltHex.length !== PIN_SALT_BYTES * 2) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = hexToBytes(saltHex);
    expected = hexToBytes(expectedHex);
  } catch {
    return false;
  }
  let computed: Uint8Array;
  try {
    computed = hexToBytes(await argon2idHex(pin, salt));
  } catch {
    return false;
  }
  return timingSafeEqualBytes(computed, expected);
}

// ─── Mnemonic (per-wallet) ────────────────────────────────────────────────────

export async function storeMnemonic(
  walletId: string,
  mnemonic: string,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      walletKey(walletId, "mnemonic"),
      mnemonic,
      SECURE_OPTIONS,
    );
  } catch (error) {
    handleKeychainError(error);
  }
}

export async function getMnemonic(walletId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      walletKey(walletId, "mnemonic"),
      SECURE_OPTIONS,
    );
  } catch (error) {
    handleKeychainError(error);
  }
}

// ─── BIP32 Seed (per-wallet) ──────────────────────────────────────────────────

export async function storeBIP32Seed(
  walletId: string,
  seed: string,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      walletKey(walletId, "bip32_seed"),
      seed,
      SECURE_OPTIONS,
    );
  } catch (error) {
    handleKeychainError(error);
  }
}

export async function getBIP32Seed(walletId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      walletKey(walletId, "bip32_seed"),
      SECURE_OPTIONS,
    );
  } catch (error) {
    handleKeychainError(error);
  }
}

// ─── Xpub (per-wallet, watch-only) ───────────────────────────────────────────

export async function storeXpub(walletId: string, xpub: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      walletKey(walletId, "xpub"),
      xpub,
      SECURE_OPTIONS,
    );
  } catch (error) {
    handleKeychainError(error);
  }
}

export async function getXpub(walletId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      walletKey(walletId, "xpub"),
      SECURE_OPTIONS,
    );
  } catch (error) {
    handleKeychainError(error);
  }
}

// ─── Wallet type (per-wallet, stored in SecureStore — not AsyncStorage) ───────

export async function storeWalletType(
  walletId: string,
  type: WalletType,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      walletKey(walletId, "type"),
      type,
      SECURE_OPTIONS,
    );
  } catch (error) {
    handleKeychainError(error);
  }
}

export async function getWalletType(
  walletId: string,
): Promise<WalletType | null> {
  try {
    const value = await SecureStore.getItemAsync(
      walletKey(walletId, "type"),
      SECURE_OPTIONS,
    );
    if (value === "mnemonic" || value === "bip32Seed" || value === "xpub") {
      return value;
    }
    // Legacy 'wif' alias upgrade
    if (value === "wif") return "bip32Seed";
    return null;
  } catch (error) {
    handleKeychainError(error);
  }
}

// ─── PIN hash (global — not per-wallet) ───────────────────────────────────────
//
// : method names are lower-case `Pin` (not `PIN`) so the
// WalletSecretsPort surface matches verbatim across mobile + desktop adapters.
// The on-disk key (`prl_wallet_pin_hash`) is unchanged — pure rename.

export async function storePinHash(pinHash: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PIN_HASH_KEY, pinHash, SECURE_OPTIONS);
  } catch (error) {
    handleKeychainError(error);
  }
}

export async function getPinHash(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PIN_HASH_KEY, SECURE_OPTIONS);
  } catch (error) {
    handleKeychainError(error);
  }
}

export async function deletePinHash(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_HASH_KEY, SECURE_OPTIONS);
  } catch (error) {
    handleKeychainError(error);
  }
}

// ─── Per-wallet delete (scoped) ───────────────────────────────────────────────

/**
 * Delete all SecureStore secrets for a single wallet.
 * Touches only wallet_<id>_mnemonic, wallet_<id>_bip32_seed,
 * wallet_<id>_xpub, wallet_<id>_type.
 * prl_wallet_pin_hash is intentionally NOT deleted.
 */
export async function deleteWalletSecrets(walletId: string): Promise<void> {
  const suffixes = ["mnemonic", "bip32_seed", "xpub", "type"] as const;
  await Promise.all(
    suffixes.map((suffix) =>
      SecureStore.deleteItemAsync(
        walletKey(walletId, suffix),
        SECURE_OPTIONS,
      ).catch(() => undefined),
    ),
  );
}

// ─── Full factory reset (wipes everything including PIN) ─────────────────────

/**
 * @deprecated — Use `deleteAllSecrets` from `@prl-wallet/services` directly,
 * passing the hydrated wallet list (the canonical "which wallets exist"
 * source of truth). This wrapper exists only as a transitional bridge for
 * callers that have not migrated yet. The legacy hardcoded v1.0 key list
 * was bug-prone (orphaned per-wallet keys post-v1.1).
 *
 * / : delegates to the shared port-based helper. Reads
 * the hydrated wallet list via `useWalletListStore.getState().wallets` so
 * every per-wallet bucket gets cleaned up before the global PIN hash is
 * deleted.
 */
export async function deleteAllSecrets(): Promise<void> {
  // Lazy require to avoid a cyclic-dep risk if a future refactor moves
  // secureStorage into a deeper folder. `@prl-wallet/services` is already
  // in apps/mobile/package.json.
  const { deleteAllSecrets: shared } = await import("@prl-wallet/services");
  const { useWalletListStore } = await import("../store/walletListStore");
  const wallets = useWalletListStore.getState().wallets;
  await shared({
    secrets: {
      getMnemonic,
      getBIP32Seed,
      getXpub,
      getWalletType,
      storeMnemonic,
      storeBIP32Seed,
      storeXpub,
      storeWalletType,
      deleteWalletSecrets,
      getPinHash,
      storePinHash,
      deletePinHash,
    },
    wallets,
  });
}
