import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { useReceiveFlow } from "../useReceiveFlow.js";
import { createPortWrapper } from "../../test-utils/createPortWrapper.js";

jest.mock("../useWalletServices", () => ({
  useWalletServices: jest.fn(),
}));

const { useWalletServices } = jest.requireMock("../useWalletServices") as {
  useWalletServices: jest.Mock;
};

type MockNavigation = {
  goBack: jest.Mock;
};

type WalletListState = {
  wallets: Array<{
    id: string;
    name: string;
    networkId: string;
    createdAt: number;
    nextReceiveAddress?: string;
  }>;
  updateWalletReceiveAddress: jest.Mock;
};

function createNavigation(): MockNavigation {
  return { goBack: jest.fn() };
}

describe("useReceiveFlow", () => {
  const addressService = {
    discoverAddresses: jest.fn(),
    getReceiveAddress: jest.fn(),
  };
  const secrets = {
    getWalletType: jest.fn(),
  };
  const clipboardSetString = jest.fn(async () => undefined);
  const shareShare = jest.fn(async () => undefined);
  const updateWalletReceiveAddress = jest.fn();

  let walletListSelector: (
    selector: (state: WalletListState) => unknown,
  ) => unknown;
  let wrapper: ReturnType<typeof createPortWrapper>;

  function buildBundle(
    state: WalletListState,
    overrides: { sharing?: { share: jest.Mock } } = {},
  ): AdaptersBundle {
    walletListSelector = (selector) => selector(state);
    const walletListStore = Object.assign(
      (sel: (s: WalletListState) => unknown) => walletListSelector(sel),
      {
        getState: () => state,
      },
    );
    return {
      ports: {
        clipboard: { setString: clipboardSetString },
        sharing: overrides.sharing ?? { share: shareShare },
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
        registry: {},
        blockbook: () => ({}),
        runtime: { now: () => 0, createId: () => "stub-id" },
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
    jest.useFakeTimers();

    useWalletServices.mockReturnValue({
      addressService,
    });
    secrets.getWalletType.mockResolvedValue("mnemonic");
    addressService.discoverAddresses.mockReset();
    addressService.discoverAddresses.mockResolvedValue({
      derivedAddresses: [
        { index: 4, address: "bc1-current-receive", hasTransactions: false },
      ],
      receiveAddress: "bc1-current-receive",
      receiveAddressIndex: 0,
      warnings: [],
    });
    addressService.getReceiveAddress.mockResolvedValue({
      index: 4,
      address: "bc1-current-receive",
      hasTransactions: false,
    });

    const defaultState: WalletListState = {
      wallets: [
        {
          id: "wallet-1",
          name: "Primary Wallet",
          networkId: "btc-mainnet",
          createdAt: 1710000000000,
          nextReceiveAddress: "bc1-cached-receive",
        },
      ],
      updateWalletReceiveAddress,
    };
    wrapper = createPortWrapper(buildBundle(defaultState));
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("loads the current receive address from wallet truth by walletId", async () => {
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useReceiveFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.receiveAddress).toBe("bc1-cached-receive");

    await waitFor(() => {
      expect(result.current.receiveAddress).toBe("bc1-current-receive");
    });

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
      "bc1-current-receive",
    );
    expect(result.current.copyLabel).toBe("Copy");
  });

  it("shows the cached receive address immediately while refreshing", async () => {
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useReceiveFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    expect(result.current.receiveAddress).toBe("bc1-cached-receive");
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.receiveAddress).toBe("bc1-current-receive");
    });
  });

  it("keeps a manually advanced cached address when discovery still reports it unused", async () => {
    const state: WalletListState = {
      wallets: [
        {
          id: "wallet-1",
          name: "Primary Wallet",
          networkId: "btc-mainnet",
          createdAt: 1710000000000,
          nextReceiveAddress: "bc1-next-receive",
        },
      ],
      updateWalletReceiveAddress,
    };
    wrapper = createPortWrapper(buildBundle(state));

    addressService.discoverAddresses.mockResolvedValue({
      derivedAddresses: [
        { index: 4, address: "bc1-current-receive", hasTransactions: false },
        { index: 5, address: "bc1-next-receive", hasTransactions: false },
      ],
      receiveAddress: "bc1-current-receive",
      receiveAddressIndex: 0,
      warnings: [],
    });
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useReceiveFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    expect(result.current.receiveAddress).toBe("bc1-next-receive");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.receiveAddress).toBe("bc1-next-receive");
    expect(updateWalletReceiveAddress).toHaveBeenCalledWith(
      "wallet-1",
      "bc1-next-receive",
    );
  });

  it("copies and shares the resolved receive address", async () => {
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useReceiveFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.receiveAddress).toBe("bc1-current-receive");
    });

    await act(async () => {
      await result.current.copyAddress();
    });

    expect(clipboardSetString).toHaveBeenCalledWith("bc1-current-receive");
    expect(result.current.copyLabel).toBe("Copied!");

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(result.current.copyLabel).toBe("Copy");

    await act(async () => {
      await result.current.shareAddress();
    });

    expect(shareShare).toHaveBeenCalledWith("bc1-current-receive");
  });

  it("generates another receive address and stores it", async () => {
    addressService.discoverAddresses = jest.fn().mockResolvedValue({
      derivedAddresses: [
        { index: 4, address: "bc1-current-receive", hasTransactions: false },
        { index: 5, address: "bc1-next-receive", hasTransactions: false },
      ],
      receiveAddress: "bc1-current-receive",
      receiveAddressIndex: 0,
      warnings: [],
    });
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useReceiveFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.receiveAddress).toBe("bc1-current-receive");
    });

    await act(async () => {
      await result.current.generateAnotherAddress();
    });

    expect(addressService.discoverAddresses).toHaveBeenCalledWith({
      wallet: {
        walletId: "wallet-1",
        networkId: "btc-mainnet",
        walletType: "mnemonic",
        capability: "signing",
      },
    });
    expect(result.current.receiveAddress).toBe("bc1-next-receive");
    expect(updateWalletReceiveAddress).toHaveBeenCalledWith(
      "wallet-1",
      "bc1-next-receive",
    );
  });

  it("keeps fallback state and no-op handlers when no receive address resolves", async () => {
    addressService.discoverAddresses.mockRejectedValue(
      new Error("unavailable"),
    );
    const navigation = createNavigation();

    const { result } = renderHook(
      () => useReceiveFlow({ walletId: "wallet-1", navigation }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.copyAddress();
      await result.current.shareAddress();
    });

    expect(result.current.receiveAddress).toBeNull();
    expect(result.current.copyLabel).toBe("Copy");
    expect(clipboardSetString).not.toHaveBeenCalled();
    expect(shareShare).not.toHaveBeenCalled();
  });
});
