import { useState } from "react";
import { isValidMnemonic } from "@prl-wallet/core";
import type { AddressService, ServicesPorts } from "@prl-wallet/services";
import { formatImportError } from "../formatImportError.js";
import type { ImportWalletType } from "../create/types.js";

type WalletNameNavigation = {
  goToWalletName: (
    walletId: string,
    address: string,
    walletType: ImportWalletType,
  ) => void;
};

type UseMnemonicImportFlowArgs = {
  navigation: WalletNameNavigation;
  addressService: AddressService;
  ports: ServicesPorts;
  networkId: string;
};

function createEmptyWords(count: 12 | 24) {
  return Array(count).fill("") as string[];
}

export type MnemonicImportFlowResult = {
  error: string | null;
  importWallet: () => Promise<void>;
  isImporting: boolean;
  setSelectedWordCount: (count: 12 | 24) => void;
  setWord: (index: number, value: string) => void;
  wordCount: 12 | 24;
  words: string[];
};

export function useMnemonicImportFlow({
  navigation,
  addressService,
  ports,
  networkId,
}: UseMnemonicImportFlowArgs): MnemonicImportFlowResult {
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [words, setWords] = useState<string[]>(() => createEmptyWords(12));
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const setWord = (index: number, value: string) => {
    setWords((currentWords) => {
      const nextWords = [...currentWords];
      nextWords[index] = value;
      return nextWords;
    });
  };

  const setSelectedWordCount = (count: 12 | 24) => {
    setWordCount(count);
    setWords(createEmptyWords(count));
    setError(null);
  };

  const importWallet = async () => {
    if (words.some((word) => !word.trim())) {
      setError("Please fill in all word fields before importing.");
      return;
    }

    const mnemonic = words.map((word) => word.trim().toLowerCase()).join(" ");

    if (!isValidMnemonic(mnemonic)) {
      setError("Invalid mnemonic — please check each word and try again");
      return;
    }

    setError(null);
    setIsImporting(true);

    const walletId = ports.runtime.createId();

    try {
      await ports.secrets.storeMnemonic(walletId, mnemonic);
      await ports.secrets.storeWalletType(walletId, "mnemonic");

      const discovery = await addressService.discoverAddresses({
        wallet: {
          walletId,
          networkId,
          walletType: "mnemonic",
          capability: "signing",
        },
      });

      navigation.goToWalletName(walletId, discovery.receiveAddress, "mnemonic");
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
    importWallet,
    isImporting,
    setSelectedWordCount,
    setWord,
    wordCount,
    words,
  };
}
