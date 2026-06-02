import { useCallback, useEffect, useRef, useState } from "react";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useWalletServices } from "./useWalletServices.js";
import { resolveMaintainedReceiveAddress } from "./receiveAddress.js";
import { toWalletReference } from "./walletReferences.js";

type ReceiveNavigation = {
  goBack: () => void;
};

type UseReceiveFlowArgs = {
  walletId: string;
  navigation: ReceiveNavigation;
};

export function useReceiveFlow({ walletId, navigation }: UseReceiveFlowArgs) {
  const { ports, services, stores } = useAdapters();
  const walletListStore = stores.walletList;
  const wallet = walletListStore(
    (state) => state.wallets.find((item) => item.id === walletId) ?? null,
  );
  const updateWalletReceiveAddress = walletListStore(
    (state) => state.updateWalletReceiveAddress ?? (() => undefined),
  );
  const networkId = wallet?.networkId ?? null;
  const { addressService } = useWalletServices();
  const [receiveAddress, setReceiveAddress] = useState<string | null>(
    wallet?.nextReceiveAddress ?? null,
  );
  const [isLoading, setIsLoading] = useState(Boolean(networkId));
  const [isGeneratingAnother, setIsGeneratingAnother] = useState(false);
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const loadVersionRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReceiveAddress(wallet?.nextReceiveAddress ?? null);
  }, [wallet?.nextReceiveAddress]);

  useEffect(() => {
    let cancelled = false;

    async function loadReceiveAddress() {
      const loadVersion = ++loadVersionRef.current;

      if (!networkId) {
        setReceiveAddress(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const walletType = await services.secrets.getWalletType(walletId);
        if (!walletType) {
          if (!cancelled) {
            setReceiveAddress(null);
          }
          return;
        }

        const discovery = await addressService.discoverAddresses({
          wallet: toWalletReference({ id: walletId, networkId }, walletType),
        });
        const nextReceiveAddress = resolveMaintainedReceiveAddress(
          discovery.derivedAddresses,
          discovery.receiveAddress,
          wallet?.nextReceiveAddress,
        );

        if (!cancelled && loadVersion === loadVersionRef.current) {
          setReceiveAddress(nextReceiveAddress);
          updateWalletReceiveAddress(walletId, nextReceiveAddress);
        }
      } catch {
        if (!cancelled) {
          setReceiveAddress(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReceiveAddress();

    return () => {
      cancelled = true;
    };
  }, [
    addressService,
    networkId,
    services,
    updateWalletReceiveAddress,
    wallet?.nextReceiveAddress,
    walletId,
  ]);

  const copyAddress = useCallback(async () => {
    if (!receiveAddress) {
      return;
    }

    await ports.clipboard.setString(receiveAddress);
    setCopyLabel("Copied!");
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      copyTimerRef.current = null;
      setCopyLabel("Copy");
    }, 1500);
  }, [ports, receiveAddress]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const shareAddress = useCallback(async () => {
    if (!receiveAddress) {
      return;
    }

    await ports.sharing.share(receiveAddress);
  }, [ports, receiveAddress]);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const generateAnotherAddress = useCallback(async () => {
    if (!networkId) {
      return;
    }

    setIsGeneratingAnother(true);
    loadVersionRef.current += 1;

    try {
      const walletType = await services.secrets.getWalletType(walletId);
      if (!walletType) {
        return;
      }

      const discovery = await addressService.discoverAddresses({
        wallet: toWalletReference({ id: walletId, networkId }, walletType),
      });
      const currentIndex = discovery.derivedAddresses.findIndex(
        (entry) => entry.address === receiveAddress,
      );
      const nextIndex =
        currentIndex >= 0
          ? Math.min(currentIndex + 1, discovery.derivedAddresses.length - 1)
          : Math.min(
              discovery.receiveAddressIndex + 1,
              discovery.derivedAddresses.length - 1,
            );
      const nextAddress = discovery.derivedAddresses[nextIndex]?.address;

      if (nextAddress) {
        setReceiveAddress(nextAddress);
        updateWalletReceiveAddress(walletId, nextAddress);
      }
    } finally {
      setIsGeneratingAnother(false);
    }
  }, [
    addressService,
    networkId,
    services,
    receiveAddress,
    updateWalletReceiveAddress,
    walletId,
  ]);

  return {
    copyAddress,
    copyLabel,
    generateAnotherAddress,
    goBack,
    isGeneratingAnother,
    isLoading,
    receiveAddress,
    shareAddress,
  };
}
