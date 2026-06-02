import { act, renderHook } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { useWalletNameFlow } from "../useWalletNameFlow.js";
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

function createNavigation() {
  return {
    goToSetupSuccess: jest.fn(),
  };
}

function buildBundle(state: WalletListSelectorState): AdaptersBundle {
  const walletListStore = Object.assign(
    (sel: (s: WalletListSelectorState) => unknown) => sel(state),
    {
      getState: () => state,
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
      lock: {} as unknown as AdaptersBundle["stores"]["lock"],
    },
  };
}

describe("useWalletNameFlow", () => {
  const setPendingOpenWalletId = jest.fn();
  const setActiveWalletId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validates duplicate wallet names and continues with slim SetupSuccess params", async () => {
    const navigation = createNavigation();
    const state: WalletListSelectorState = {
      wallets: [
        {
          id: "wallet-1",
          name: "Wallet 1",
          networkId: "btc-mainnet",
          createdAt: 1,
        },
      ],
      setPendingOpenWalletId,
      setActiveWalletId,
    };
    const wrapper = createPortWrapper(buildBundle(state));

    const { result } = renderHook(
      () =>
        useWalletNameFlow({
          navigation,
          walletId: "wallet-123",
          address: "bc1-receive",
          walletType: "mnemonic",
        }),
      { wrapper },
    );

    act(() => {
      result.current.setWalletName("Wallet 1");
    });

    act(() => {
      result.current.continueToSetupSuccess();
    });

    expect(result.current.error).toBe(
      '"Wallet 1" is already in use. Please choose a different name.',
    );

    act(() => {
      result.current.setWalletName("Travel wallet");
    });

    act(() => {
      result.current.continueToSetupSuccess();
    });

    expect(navigation.goToSetupSuccess).toHaveBeenCalledWith(
      "wallet-123",
      "Travel wallet",
      "bc1-receive",
    );
  });
});
