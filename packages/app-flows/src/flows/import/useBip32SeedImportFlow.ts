import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { isValidMnemonic } from "@prl-wallet/core";
import type { AddressService, ServicesPorts } from "@prl-wallet/services";
import {
  ExtendedKeyNetworkMismatchError,
  assertExtendedKeyMatchesPrefix,
} from "@prl-wallet/services";
import { formatImportError } from "../formatImportError.js";
import type { ImportWalletType } from "../create/types.js";

/**
 * Detect when the user has pasted a BIP-39 mnemonic into the BIP32-seed
 * input. Surfacing a friendly error here saves the user from the cryptic
 * `Unknown letter: "l". Allowed: 1-9A-HJ-NP-Za-km-z` thrown by `bs58.decode`
 * deep in the credentials-loading path when a mnemonic falls through to
 * `BIP32.fromBase58`.
 *
 * Heuristic: input is space-separated, has 12/15/18/21/24 tokens (BIP-39
 * lengths), and the first token is in the BIP-39 English wordlist. We don't
 * require checksum validity here — a malformed mnemonic is still better
 * routed to the dedicated Mnemonic import screen, which will surface the
 * proper `Invalid mnemonic` error.
 */
export function looksLikeMnemonic(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.includes(" ")) return false;
  const words = trimmed.split(/\s+/);
  // BIP-39 valid word counts: 12, 15, 18, 21, 24.
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  // If the full string passes BIP-39 checksum validation, definitely a mnemonic.
  if (isValidMnemonic(trimmed.toLowerCase())) return true;
  // Even an invalid checksum but BIP-39-shaped input should be routed to the
  // mnemonic flow — the user clearly meant "seed phrase", not "hex seed".
  // We treat 12/24 words of lowercase letters as mnemonic-shaped.
  return words.every((w) => /^[a-zA-Z]{3,}$/.test(w));
}

type WalletNameNavigation = {
  goToWalletName: (
    walletId: string,
    address: string,
    walletType: ImportWalletType,
  ) => void;
};

type UseBip32SeedImportFlowArgs = {
  navigation: WalletNameNavigation;
  addressService: AddressService;
  ports: ServicesPorts;
  networkId: string;
  extendedKeyPrefix: string;
  /**
   * Used only to render the cross-network paste error message; not required
   * for validation (the BIP32-seed flow accepts private keys, so it's the
   * `extendedKeyPrefix` that matters).
   */
  extendedPubKeyPrefix?: string;
};

const HEX_SEED_PATTERN = /^[0-9a-fA-F]{64,128}$/;

export type Bip32SeedImportFlowResult = {
  error: string | null;
  extendedKeyPrefix: string;
  importWallet: () => Promise<void>;
  input: string;
  isImporting: boolean;
  scanLog: string[];
  setInput: (value: string) => void;
  setShowLog: Dispatch<SetStateAction<boolean>>;
  showLog: boolean;
};

export function useBip32SeedImportFlow({
  navigation,
  addressService,
  ports,
  networkId,
  extendedKeyPrefix,
  extendedPubKeyPrefix,
}: UseBip32SeedImportFlowArgs): Bip32SeedImportFlowResult {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [scanLog, setScanLog] = useState<string[]>([]);

  const importWallet = async () => {
    const trimmed = input.trim();
    setError(null);
    setScanLog([]);

    if (!trimmed) {
      setError(`Please enter a BIP32 seed (hex) or ${extendedKeyPrefix} key.`);
      return;
    }

    // Friendly redirect for mnemonic-shaped input — without this, the user
    // sees `Unknown letter: "l"` from bs58 decoding deep in the discovery path.
    if (looksLikeMnemonic(trimmed)) {
      setError(
        "This looks like a 12- or 24-word seed phrase. Go back and choose Mnemonic instead.",
      );
      return;
    }

    // CR-1: validate extended-key prefix BEFORE writing to secure storage.
    // Hex seeds are exempt; for any other input we require the network's
    // configured `extendedKeyPrefix` so a cross-network paste never reaches
    // the keychain.
    const isHexSeed =
      HEX_SEED_PATTERN.test(trimmed) && trimmed.length % 2 === 0;
    if (!isHexSeed) {
      try {
        assertExtendedKeyMatchesPrefix(trimmed, {
          networkId,
          extendedKeyPrefix,
          extendedPubKeyPrefix: extendedPubKeyPrefix ?? extendedKeyPrefix,
          allow: "private",
        });
      } catch (err) {
        if (err instanceof ExtendedKeyNetworkMismatchError) {
          setError(
            `This extended key isn't for ${networkId}. Expected a "${extendedKeyPrefix}" key.`,
          );
          return;
        }
        throw err;
      }
    }

    setIsImporting(true);
    setScanLog([
      "Saving import secret...",
      `Scanning ${networkId} receive addresses...`,
    ]);

    const walletId = ports.runtime.createId();

    try {
      await ports.secrets.storeBIP32Seed(walletId, trimmed);
      await ports.secrets.storeWalletType(walletId, "bip32Seed");

      const discovery = await addressService.discoverAddresses({
        wallet: {
          walletId,
          networkId,
          walletType: "bip32Seed",
          capability: "signing",
        },
      });

      setScanLog((currentLog) => [
        ...currentLog,
        `Done - receive index ${discovery.receiveAddressIndex}`,
      ]);
      navigation.goToWalletName(
        walletId,
        discovery.receiveAddress,
        "bip32Seed",
      );
    } catch (importError) {
      // Roll back partially-stored secrets so the user does not accumulate
      // orphaned Keychain entries on iOS retries (see review WR-04).
      await ports.secrets.deleteWalletSecrets(walletId).catch(() => undefined);
      setError(formatImportError(importError));
    } finally {
      setIsImporting(false);
    }
  };

  return {
    error,
    extendedKeyPrefix,
    importWallet,
    input,
    isImporting,
    scanLog,
    setInput,
    setShowLog,
    showLog,
  };
}
