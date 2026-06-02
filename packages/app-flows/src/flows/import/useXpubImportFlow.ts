import { useMemo, useState } from "react";
import { BIP32, p2trAddress } from "@prl-wallet/core";
import type { AddressService, ServicesPorts } from "@prl-wallet/services";
import {
  ExtendedKeyNetworkMismatchError,
  assertExtendedKeyMatchesPrefix,
} from "@prl-wallet/services";
import type { Network } from "bitcoinjs-lib";
import type { ImportWalletType } from "../create/types.js";

type WalletNameNavigation = {
  goToWalletName: (
    walletId: string,
    address: string,
    walletType: ImportWalletType,
  ) => void;
};

type UseXpubImportFlowArgs = {
  navigation: WalletNameNavigation;
  addressService: AddressService;
  ports: ServicesPorts;
  networkId: string;
  network: Network;
  extendedPubKeyPrefix: string;
};

export type XpubImportFlowResult = {
  error: string | null;
  extendedPubKeyPrefix: string;
  importWallet: () => Promise<void>;
  isImporting: boolean;
  previewAddress: string | null;
  setXpub: (value: string) => void;
  xpub: string;
};

export function useXpubImportFlow({
  navigation,
  addressService,
  ports,
  networkId,
  network,
  extendedPubKeyPrefix,
}: UseXpubImportFlowArgs): XpubImportFlowResult {
  const [xpub, setXpub] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const previewAddress = useMemo(() => {
    const trimmed = xpub.trim();
    if (!trimmed || !network) {
      return null;
    }

    // CR-1: prefix-string guard before base58 decode. Keeps the preview
    // empty (rather than misleading) when the user has pasted a cross-network
    // xpub.
    try {
      assertExtendedKeyMatchesPrefix(trimmed, {
        networkId,
        extendedKeyPrefix: extendedPubKeyPrefix,
        extendedPubKeyPrefix,
        allow: "public",
      });
    } catch {
      return null;
    }

    try {
      const accountNode = BIP32.fromBase58(trimmed, network);
      const child = accountNode.derive(0).derive(0);
      return p2trAddress(child.publicKey.slice(1), network);
    } catch {
      return null;
    }
  }, [network, xpub, extendedPubKeyPrefix, networkId]);

  const importWallet = async () => {
    const trimmed = xpub.trim();
    setError(null);

    if (!trimmed) {
      setError("Please enter an extended public key.");
      return;
    }

    // CR-1: refuse to store a cross-network xpub. Without this, an xpub for
    // the wrong network would silently land in the keychain and produce
    // garbage derived addresses on every discovery call.
    try {
      assertExtendedKeyMatchesPrefix(trimmed, {
        networkId,
        extendedKeyPrefix: extendedPubKeyPrefix,
        extendedPubKeyPrefix,
        allow: "public",
      });
    } catch (err) {
      if (err instanceof ExtendedKeyNetworkMismatchError) {
        setError(
          `This extended public key isn't for ${networkId}. Expected a "${extendedPubKeyPrefix}" key.`,
        );
        return;
      }
      throw err;
    }

    setIsImporting(true);

    const walletId = ports.runtime.createId();

    try {
      await ports.secrets.storeXpub(walletId, trimmed);
      await ports.secrets.storeWalletType(walletId, "xpub");

      const discovery = await addressService.discoverAddresses({
        wallet: {
          walletId,
          networkId,
          walletType: "xpub",
          capability: "watchOnly",
        },
      });

      navigation.goToWalletName(
        walletId,
        discovery.receiveAddress ?? previewAddress ?? "",
        "xpub",
      );
    } catch {
      // Roll back partially-stored secrets so the user does not accumulate
      // orphaned Keychain entries on iOS retries (see review WR-04).
      await ports.secrets.deleteWalletSecrets(walletId).catch(() => undefined);
      setError(
        "Invalid extended public key — must be a valid extended public key in base58 format.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return {
    error,
    extendedPubKeyPrefix,
    importWallet,
    isImporting,
    previewAddress,
    setXpub,
    xpub,
  };
}
