import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { useWalletDetailFlow } from "../useWalletDetailFlow.js";
import { createPortWrapper } from "../../test-utils/createPortWrapper.js";

jest.mock("../useWalletServices", () => ({
  useWalletServices: jest.fn(),
}));

const { useWalletServices } = jest.requireMock("../useWalletServices") as {
  useWalletServices: jest.Mock;
};

type MockNavigation = {
  goToSend: jest.Mock;
  goToReceive: jest.Mock;
  goToTransactionList: jest.Mock;
  goToAddressList: jest.Mock;
  goBack: jest.Mock;
  popToTop: jest.Mock;
  resetToRoot: jest.Mock;
};

type WalletListState = {
  wallets: Array<{
    id: string;
    name: string;
    networkId: string;
    createdAt: number;
    lastKnownBalance?: string;
    nextReceiveAddress?: string;
  }>;
  setActiveWalletId: jest.Mock;
  updateWalletReceiveAddress: jest.Mock;
};

function createNavigation(): MockNavigation {
  return {
    goToSend: jest.fn(),
    goToReceive: jest.fn(),
    goToTransactionList: jest.fn(),
    goToAddressList: jest.fn(),
    goBack: jest.fn(),
    popToTop: jest.fn(),
    resetToRoot: jest.fn(),
  };
}

describe("useWalletDetailFlow", () => {
  const addressService = {
    discoverAddresses: jest.fn(),
  };
  const walletService = {
    deleteWallet: jest.fn(),
  };
  const secrets = {
    getWalletType: jest.fn(),
  };
  const setActiveWalletId = jest.fn();
  const updateWalletReceiveAddress = jest.fn();

  let walletListState: WalletListState;
  let wrapper: ReturnType<typeof createPortWrapper>;

  function buildBundle(): AdaptersBundle {
    const walletListStore = Object.assign(
      (sel: (s: WalletListState) => unknown) => sel(walletListState),
      {
        getState: () => walletListState,
      },
    );
    return {
      ports: {
        clipboard: { setString: async () => undefined },
        sharing: { share: async () => undefined },
        storage: {
          getItem: async () => null,
          setItem: async () => undefined,
          removeItem: async () => undefined,
        },
        networkGate: { isOpen: () => true, subscribe: () => () => {} },
        clock: { now: () => 0 },
      },
      services: {
        secrets,
        addressService,
        walletService,
      } as unknown as AdaptersBundle["services"],
      stores: {
        walletList:
          walletListStore as unknown as AdaptersBundle["stores"]["walletList"],
        pin: {} as unknown as AdaptersBundle["stores"]["pin"],
        lock: {} as unknown as AdaptersBundle["stores"]["lock"],
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    useWalletServices.mockReturnValue({
      addressService,
      walletService,
    });

    walletListState = {
      wallets: [
        {
          id: "wallet-1",
          name: "Primary Wallet",
          networkId: "btc-mainnet",
          createdAt: 1710000000000,
          lastKnownBalance: "1234",
          nextReceiveAddress: "bc1-cached",
        },
        {
          id: "wallet-2",
          name: "Backup Wallet",
          networkId: "btc-mainnet",
          createdAt: 1710000001000,
        },
      ],
      setActiveWalletId,
      updateWalletReceiveAddress,
    };

    secrets.getWalletType.mockResolvedValue("mnemonic");
    addressService.discoverAddresses.mockResolvedValue({
      derivedAddresses: [
        { index: 0, address: "bc1-used", hasTransactions: true },
        { index: 1, address: "bc1-receive", hasTransactions: false },
      ],
      receiveAddress: "bc1-receive",
      receiveAddressIndex: 1,
      warnings: [],
    });
    walletService.deleteWallet.mockImplementation(async (walletId: string) => {
      walletListState.wallets = walletListState.wallets.filter(
        (wallet) => wallet.id !== walletId,
      );
    });

    wrapper = createPortWrapper(buildBundle());
  });

  it("loads wallet truth, discovers addresses, and exposes navigation handlers", async () => {
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useWalletDetailFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    expect(result.current.wallet?.id).toBe("wallet-1");
    expect(result.current.isDiscovering).toBe(true);

    await waitFor(() => {
      expect(result.current.walletType).toBe("mnemonic");
      expect(result.current.derivedAddresses).toHaveLength(2);
    });

    expect(setActiveWalletId).toHaveBeenCalledWith("wallet-1");
    expect(secrets.getWalletType).toHaveBeenCalledWith("wallet-1");
    expect(addressService.discoverAddresses).toHaveBeenCalledWith({
      wallet: {
        walletId: "wallet-1",
        networkId: "btc-mainnet",
        walletType: "mnemonic",
        capability: "signing",
      },
    });
    expect(updateWalletReceiveAddress).toHaveBeenCalledWith(
      "wallet-1",
      "bc1-receive",
    );
    expect(result.current.addresses).toEqual(["bc1-used", "bc1-receive"]);
    expect(result.current.usedAddressCount).toBe(1);
    expect(result.current.hasMultipleAddresses).toBe(false);

    act(() => {
      result.current.openSend();
      result.current.openReceive();
      result.current.openTransactionHistory();
    });

    expect(navigation.goToSend).toHaveBeenNthCalledWith(1, "wallet-1");
    expect(navigation.goToReceive).toHaveBeenNthCalledWith(1, "wallet-1");
    expect(navigation.goToTransactionList).toHaveBeenNthCalledWith(1, [
      "bc1-used",
      "bc1-receive",
    ]);
  });

  it("invalidates address queries and reloads discovery on refresh", async () => {
    const invalidateQueries = jest.spyOn(
      QueryClient.prototype,
      "invalidateQueries",
    );
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useWalletDetailFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.derivedAddresses).toHaveLength(2);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["address"] });
    expect(addressService.discoverAddresses).toHaveBeenCalledTimes(2);

    invalidateQueries.mockRestore();
  });

  it("navigates back to the wallet list when deleting with remaining wallets", async () => {
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useWalletDetailFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.walletType).toBe("mnemonic");
    });

    await act(async () => {
      await result.current.deleteWallet();
    });

    expect(walletService.deleteWallet).toHaveBeenCalledWith("wallet-1");
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    expect(navigation.resetToRoot).not.toHaveBeenCalled();
  });

  it("resets to welcome when deleting the last wallet", async () => {
    walletListState.wallets = [walletListState.wallets[0]];
    walletService.deleteWallet.mockImplementation(async (walletId: string) => {
      walletListState.wallets = walletListState.wallets.filter(
        (wallet) => wallet.id !== walletId,
      );
    });

    const navigation = createNavigation();

    const { result } = renderHook(
      () => useWalletDetailFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.walletType).toBe("mnemonic");
    });

    await act(async () => {
      await result.current.deleteWallet();
    });

    expect(navigation.popToTop).not.toHaveBeenCalled();
    expect(navigation.resetToRoot).toHaveBeenCalledTimes(1);
  });
});
