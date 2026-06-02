// apps/desktop/src/platform/secrets.ts
//
// (.., ) — real WalletSecretsPort implementation
// backed by the Tauri commands defined in src-tauri/src/secrets.rs.
//
// Mirrors apps/mobile/src/services/secureStorage.ts contract:
// Per-secret keychain entries (; never JSON blob).
// `wallet_<id>_<suffix>` for per-wallet, `pin_hash` for global PIN.
// NB: desktop uses "pin_hash" (); mobile uses "prl_wallet_pin_hash"
// because Expo SecureStore namespaces under the bundle id. Both apps
// read/write their own keys; no cross-platform key sharing.
// All keychain errors map to `Error("KEYCHAIN_UNAVAILABLE")` for parity
// with mobile's handleKeychainError contract. The typed SecretError shape
// is logged (not propagated) per .

import { invoke } from "@tauri-apps/api/core";
import type { WalletSecretsPort, WalletType } from "@prl-wallet/services";

const PIN_HASH_KEY = "pin_hash";

const walletKey = (walletId: string, suffix: string): string =>
  `wallet_${walletId}_${suffix}`;

/**
 * Wraps every secrets_* invoke. Catches the typed SecretError emitted by
 * Rust (shape: `{ kind: "NoBackend" | "ValueTooLarge" | "AccessDenied" | "Io", data?: ... }`),
 * logs the diagnostic, and rethrows the mobile-parity `KEYCHAIN_UNAVAILABLE`
 * error so flow code in @prl-wallet/services / @prl-wallet/app-flows can
 * pattern-match on the same string across platforms.
 */
async function callSecret<T>(
  cmd: "secrets_set" | "secrets_get" | "secrets_delete",
  args: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    // err is the SecretError shape via Tauri serde tag/content.
    // Don't propagate the typed shape — the rest of the codebase only
    // knows the "KEYCHAIN_UNAVAILABLE" string contract.
    // eslint-disable-next-line no-console
    console.error("[keychain]", cmd, err);
    throw new Error("KEYCHAIN_UNAVAILABLE");
  }
}

export function createDesktopSecrets(): WalletSecretsPort {
  return {
    async getMnemonic(walletId) {
      return callSecret<string | null>("secrets_get", {
        key: walletKey(walletId, "mnemonic"),
      });
    },
    async getBIP32Seed(walletId) {
      return callSecret<string | null>("secrets_get", {
        key: walletKey(walletId, "bip32_seed"),
      });
    },
    async getXpub(walletId) {
      return callSecret<string | null>("secrets_get", {
        key: walletKey(walletId, "xpub"),
      });
    },
    async getWalletType(walletId): Promise<WalletType | null> {
      const value = await callSecret<string | null>("secrets_get", {
        key: walletKey(walletId, "type"),
      });
      if (value === "mnemonic" || value === "bip32Seed" || value === "xpub") {
        return value;
      }
      // Legacy 'wif' alias upgrade (mirror of mobile secureStorage.ts:150).
      if (value === "wif") return "bip32Seed";
      return null;
    },
    async storeMnemonic(walletId, mnemonic) {
      await callSecret<void>("secrets_set", {
        key: walletKey(walletId, "mnemonic"),
        value: mnemonic,
      });
    },
    async storeBIP32Seed(walletId, seed) {
      await callSecret<void>("secrets_set", {
        key: walletKey(walletId, "bip32_seed"),
        value: seed,
      });
    },
    async storeXpub(walletId, xpub) {
      await callSecret<void>("secrets_set", {
        key: walletKey(walletId, "xpub"),
        value: xpub,
      });
    },
    async storeWalletType(walletId, type) {
      await callSecret<void>("secrets_set", {
        key: walletKey(walletId, "type"),
        value: type,
      });
    },
    async deleteWalletSecrets(walletId) {
      const suffixes = ["mnemonic", "bip32_seed", "xpub", "type"] as const;
      await Promise.all(
        suffixes.map((suffix) =>
          callSecret<void>("secrets_delete", {
            key: walletKey(walletId, suffix),
          }).catch(() => undefined),
        ),
      );
    },
    async getPinHash() {
      return callSecret<string | null>("secrets_get", { key: PIN_HASH_KEY });
    },
    async storePinHash(hash) {
      await callSecret<void>("secrets_set", { key: PIN_HASH_KEY, value: hash });
    },
    async deletePinHash() {
      await callSecret<void>("secrets_delete", { key: PIN_HASH_KEY });
    },
  };
}
