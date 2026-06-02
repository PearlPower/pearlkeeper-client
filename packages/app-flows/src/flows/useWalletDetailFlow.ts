import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { WalletType } from "@prl-wallet/app-state";
import type { DerivedAddress } from "@prl-wallet/services";
import { useWalletServices } from "./useWalletServices.js";
import { getAddressQueryKey } from "./queryKeys.js";
import { resolveMaintainedReceiveAddress } from "./receiveAddress.js";
import { toWalletReference } from "./walletReferences.js";
import { getActiveAddressCount } from "./walletDetail/getActiveAddressCount.js";

type WalletDetailNavigation = {
  goToSend: (walletId: string) => void;
  goToReceive: (walletId: string) => void;
  goToTransactionList: (addresses: string[]) => void;
  goToAddressList: (derivedAddresses: DerivedAddress[]) => void;
  goBack: () => void;
  popToTop: () => void;
  resetToRoot: () => void;
};

type UseWalletDetailFlowArgs = {
  walletId: string;
  navigation: WalletDetailNavigation;
};

export function useWalletDetailFlow({
  walletId,
  navigation,
}: UseWalletDetailFlowArgs) {
  const { services, stores } = useAdapters();
  const walletListStore = stores.walletList;
  const wallet = walletListStore(
    (state) => state.wallets.find((item) => item.id === walletId) ?? null,
  );
  const setActiveWalletId = walletListStore((state) => state.setActiveWalletId);
  const updateWalletBalance = walletListStore(
    (state) => state.updateWalletBalance ?? (() => undefined),
  );
  const updateWalletReceiveAddress = walletListStore(
    (state) => state.updateWalletReceiveAddress ?? (() => undefined),
  );
  const queryClient = useQueryClient();
  const { addressService, walletService } = useWalletServices();
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [derivedAddresses, setDerivedAddresses] = useState<DerivedAddress[]>(
    [],
  );
  const [isDiscovering, setIsDiscovering] = useState(Boolean(wallet));
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setActiveWalletId(walletId);
  }, [setActiveWalletId, walletId]);

  const loadWalletState = useCallback(async () => {
    if (!wallet) {
      setWalletType(null);
      setDerivedAddresses([]);
      setIsDiscovering(false);
      return;
    }

    setIsDiscovering(true);

    try {
      const nextWalletType = await services.secrets.getWalletType(wallet.id);
      setWalletType(nextWalletType);

      if (!nextWalletType) {
        setDerivedAddresses([]);
        return;
      }

      const discovery = await addressService.discoverAddresses({
        wallet: toWalletReference(wallet, nextWalletType),
      });

      setDerivedAddresses(discovery.derivedAddresses);
      const maintainedReceiveAddress = resolveMaintainedReceiveAddress(
        discovery.derivedAddresses,
        discovery.receiveAddress,
        wallet.nextReceiveAddress,
      );
      if (wallet.nextReceiveAddress !== maintainedReceiveAddress) {
        updateWalletReceiveAddress(wallet.id, maintainedReceiveAddress);
      }
    } catch {
      setWalletType(null);
      setDerivedAddresses([]);
    } finally {
      setIsDiscovering(false);
    }
  }, [
    addressService,
    services,
    updateWalletReceiveAddress,
    wallet?.id,
    wallet?.networkId,
    wallet?.nextReceiveAddress,
  ]);

  useEffect(() => {
    void loadWalletState();
  }, [loadWalletState]);

  const addresses = derivedAddresses.map((address) => address.address);
  // drop the lastUsedIndex+1 calculation in favor of
  // the canonical filter (AddressList's pre-existing definition wins).
  const usedAddressCount = getActiveAddressCount(derivedAddresses);
  const hasMultipleAddresses = usedAddressCount > 1;

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await queryClient.invalidateQueries({ queryKey: getAddressQueryKey() });
      await loadWalletState();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadWalletState, queryClient]);

  const openSend = useCallback(() => {
    navigation.goToSend(walletId);
  }, [navigation, walletId]);

  const openReceive = useCallback(() => {
    navigation.goToReceive(walletId);
  }, [navigation, walletId]);

  const openTransactionHistory = useCallback(() => {
    navigation.goToTransactionList(addresses);
  }, [addresses, navigation]);

  const openAddressList = useCallback(() => {
    navigation.goToAddressList(derivedAddresses);
  }, [derivedAddresses, navigation]);

  const persistBalance = useCallback(
    (confirmedSats: string) => {
      if (!wallet || wallet.lastKnownBalance === confirmedSats) {
        return;
      }

      updateWalletBalance(wallet.id, confirmedSats);
    },
    [updateWalletBalance, wallet],
  );

  const deleteWallet = useCallback(async () => {
    await walletService.deleteWallet(walletId);

    const remainingWallets = walletListStore.getState().wallets;
    if (remainingWallets.length > 0) {
      navigation.popToTop();
      return;
    }

    navigation.resetToRoot();
  }, [navigation, walletId, walletListStore, walletService]);

  return {
    addresses,
    deleteWallet,
    derivedAddresses,
    hasMultipleAddresses,
    isDiscovering,
    isRefreshing,
    // null while the wallet hasn't resolved — consumers handle that case
    // (passing null to data hooks disables them). No hardcoded fallback to
    // a specific network id (which could be disabled in blockchains.json).
    networkId: wallet?.networkId ?? null,
    openAddressList,
    openReceive,
    openSend,
    openTransactionHistory,
    persistBalance,
    refresh,
    usedAddressCount,
    wallet,
    walletType,
  };
}
