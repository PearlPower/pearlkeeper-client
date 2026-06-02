import { act, renderHook } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { useSetupSuccessFlow } from "../useSetupSuccessFlow.js";
import { createPortWrapper } from "../../../test-utils/createPortWrapper.js";

type WalletListSelectorState = {
  wallets: Array<{
    id: string;
    name: string;
    networkId: string;
    createdAt: number;
  }>;
  setPendingOpenWalletId: jest.Mock;
  setActiveWalletId: jest.Mock;
};

type LockSelectorState = {
  unlock: jest.Mock;
};

function createMockPorts() {
  return {
    secrets: {
      getWalletType: jest.fn(),
      storeMnemonic: jest.fn(),
      storeBIP32Seed: jest.fn(),
      storeWalletType: jest.fn(),
      storeXpub: jest.fn(),
      getMnemonic: jest.fn(),
      getBIP32Seed: jest.fn(),
      getXpub: jest.fn(),
      deleteWalletSecrets: jest.fn(),
    },
    registry: {
      addWallet: jest.fn(),
      listWallets: jest.fn(),
      getWallet: jest.fn(),
      getActiveWalletId: jest.fn(),
      removeWallet: jest.fn(),
      setActiveWalletId: jest.fn(),
      updateWalletBalance: jest.fn(),
    },
    blockbook: jest.fn(),
    runtime: {
      createId: jest.fn().mockReturnValue("wallet-123"),
      now: jest.fn().mockReturnValue(1710000000000),
    },
  };
}

function buildBundle(
  walletListState: WalletListSelectorState,
  lockState: LockSelectorState,
): AdaptersBundle {
  const walletListStore = Object.assign(
    (sel: (s: WalletListSelectorState) => unknown) => sel(walletListState),
    {
      getState: () => walletListState,
    },
  );
  const lockStore = Object.assign(
    (sel: (s: LockSelectorState) => unknown) => sel(lockState),
    {
      getState: () => lockState,
    },
  );
  return {
    ports: {
      clipboard: { setString: jest.fn() },
      sharing: { share: jest.fn() },
      storage: {
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      },
      networkGate: { isOpen: () => true, subscribe: () => () => {} },
      clock: { now: () => 0 },
    },
    services: {
      secrets: {},
      registry: {},
      blockbook: () => ({}),
      runtime: { now: () => 0, createId: () => "stub-id" },
    } as unknown as AdaptersBundle["services"],
    stores: {
      walletList:
        walletListStore as unknown as AdaptersBundle["stores"]["walletList"],
      pin: {} as unknown as AdaptersBundle["stores"]["pin"],
      lock: lockStore as unknown as AdaptersBundle["stores"]["lock"],
    },
  };
}

describe("useSetupSuccessFlow", () => {
  const unlock = jest.fn();
  const setPendingOpenWalletId = jest.fn();
  const setActiveWalletId = jest.fn();
  const resetToRoot = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves and opens the first wallet from setup success", async () => {
    const ports = createMockPorts();
    const walletListState: WalletListSelectorState = {
      wallets: [],
      setPendingOpenWalletId,
      setActiveWalletId,
    };
    const wrapper = createPortWrapper(buildBundle(walletListState, { unlock }));

    const { result } = renderHook(
      () =>
        useSetupSuccessFlow({
          ports: ports as never,
          walletId: "wallet-123",
          walletName: "Travel wallet",
          address: "bc1-receive",
          networkId: "btc-mainnet",
          navigation: { resetToRoot },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.createWallet();
    });

    expect(ports.registry.addWallet).toHaveBeenCalledWith({
      id: "wallet-123",
      name: "Travel wallet",
      networkId: "btc-mainnet",
      createdAt: 1710000000000,
    });
    expect(setPendingOpenWalletId).not.toHaveBeenCalled();
    expect(setActiveWalletId).toHaveBeenCalledWith("wallet-123");
    expect(unlock).toHaveBeenCalled();
    expect(resetToRoot).toHaveBeenCalledWith("wallet-123");
  });

  it("sets pending wallet id and resets navigation for additional wallets", async () => {
    const ports = createMockPorts();
    const walletListState: WalletListSelectorState = {
      wallets: [
        {
          id: "existing",
          name: "Existing",
          networkId: "btc-mainnet",
          createdAt: 1,
        },
      ],
      setPendingOpenWalletId,
      setActiveWalletId,
    };
    const wrapper = createPortWrapper(buildBundle(walletListState, { unlock }));

    const { result } = renderHook(
      () =>
        useSetupSuccessFlow({
          ports: ports as never,
          walletId: "wallet-123",
          walletName: "Travel wallet",
          address: "bc1-receive",
          networkId: "btc-mainnet",
          navigation: { resetToRoot },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.createWallet();
    });

    expect(setPendingOpenWalletId).toHaveBeenCalledWith("wallet-123");
    expect(resetToRoot).toHaveBeenCalledWith("wallet-123");
  });
});
