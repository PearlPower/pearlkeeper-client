import { useState } from "react";
import type { ServicesPorts } from "@prl-wallet/services";
import { useAdapters } from "@prl-wallet/app-adapters";

type SetupSuccessResetNavigation = {
  resetToRoot: (walletId: string) => void;
};

type UseSetupSuccessFlowArgs = {
  ports: ServicesPorts;
  walletId: string;
  walletName: string;
  address: string;
  networkId: string;
  navigation: SetupSuccessResetNavigation;
};

export type SetupSuccessFlowResult = {
  createWallet: () => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
};

export function useSetupSuccessFlow({
  ports,
  walletId,
  walletName,
  address: _address,
  networkId,
  navigation,
}: UseSetupSuccessFlowArgs): SetupSuccessFlowResult {
  const { stores } = useAdapters();
  const walletListStore = stores.walletList;
  const lockStore = stores.lock;
  const setPendingOpenWalletId = walletListStore(
    (state) => state.setPendingOpenWalletId,
  );
  const setActiveWalletId = walletListStore((state) => state.setActiveWalletId);
  const unlock = lockStore((state) => state.unlock);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createWallet = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isFirstWallet = walletListStore.getState().wallets.length === 0;
      const record = {
        id: walletId,
        name: walletName,
        networkId,
        createdAt: ports.runtime.now(),
      };

      await ports.registry.addWallet(record);

      setActiveWalletId(walletId);
      unlock();

      if (!isFirstWallet) {
        setPendingOpenWalletId(walletId);
      }

      if (isFirstWallet) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      navigation.resetToRoot(walletId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    createWallet,
    isSubmitting,
    error,
  };
}
