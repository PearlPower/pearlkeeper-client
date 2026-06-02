import { useState } from "react";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { ImportWalletType } from "./types.js";
import { nextWalletName } from "./walletNames.js";

type SetupSuccessNavigation = {
  goToSetupSuccess: (
    walletId: string,
    walletName: string,
    address: string,
  ) => void;
};

type UseWalletNameFlowArgs = {
  navigation: SetupSuccessNavigation;
  walletId: string;
  address: string;
  walletType: ImportWalletType;
};

export type WalletNameFlowResult = {
  continueToSetupSuccess: () => void;
  error: string | null;
  setWalletName: (name: string) => void;
  walletName: string;
};

export function useWalletNameFlow({
  navigation,
  walletId,
  address,
  walletType: _walletType,
}: UseWalletNameFlowArgs): WalletNameFlowResult {
  const { stores } = useAdapters();
  const walletListStore = stores.walletList;
  const wallets = walletListStore((state) => state.wallets);
  const [walletName, setWalletName] = useState(() => nextWalletName(wallets));
  const [error, setError] = useState<string | null>(null);

  const updateWalletName = (nextWalletNameValue: string) => {
    setWalletName(nextWalletNameValue);
    if (error) {
      setError(null);
    }
  };

  const continueToSetupSuccess = () => {
    const trimmedName = walletName.trim();

    if (!trimmedName) {
      setError("Wallet name is required.");
      return;
    }

    const isDuplicate = wallets.some(
      (wallet) => wallet.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (isDuplicate) {
      setError(
        `"${trimmedName}" is already in use. Please choose a different name.`,
      );
      return;
    }

    setError(null);
    navigation.goToSetupSuccess(walletId, trimmedName, address);
  };

  return {
    continueToSetupSuccess,
    error,
    setWalletName: updateWalletName,
    walletName,
  };
}
