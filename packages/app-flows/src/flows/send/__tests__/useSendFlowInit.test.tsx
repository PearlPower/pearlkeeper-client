import { renderHook, waitFor } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { useSendFlowInit } from "../useSendFlowInit.js";
import { createPortWrapper } from "../../../test-utils/createPortWrapper.js";

describe("useSendFlowInit", () => {
  const secrets = {
    getWalletType: jest.fn(),
  };
  const blockbookEstimateFee = jest.fn();
  const blockbookFactory = jest.fn(() => ({
    estimateFee: blockbookEstimateFee,
  }));
  const discoverAddresses = jest.fn();

  const addressService = {
    discoverAddresses,
    getReceiveAddress: jest.fn(),
  } as unknown as import("@prl-wallet/services").AddressService;

  function buildBundle(): AdaptersBundle {
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
        registry: {},
        blockbook: blockbookFactory,
        runtime: { now: () => 0, createId: () => "stub-id" },
      } as unknown as AdaptersBundle["services"],
      stores: {
        walletList: {} as unknown as AdaptersBundle["stores"]["walletList"],
        pin: {} as unknown as AdaptersBundle["stores"]["pin"],
        lock: {} as unknown as AdaptersBundle["stores"]["lock"],
      },
    };
  }

  let wrapper: ReturnType<typeof createPortWrapper>;

  beforeEach(() => {
    jest.clearAllMocks();
    secrets.getWalletType.mockResolvedValue("mnemonic");
    discoverAddresses.mockResolvedValue({
      derivedAddresses: [
        { index: 0, address: "bc1-addr-0", hasTransactions: true },
        { index: 1, address: "bc1-addr-1", hasTransactions: false },
      ],
      receiveAddress: "bc1-change",
      receiveAddressIndex: 0,
      warnings: [],
    });
    blockbookEstimateFee
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(8);
    wrapper = createPortWrapper(buildBundle());
  });

  it("reads walletType via services.secrets (not getWalletType from mobile secureStorage)", async () => {
    const wallet = { id: "wallet-1", networkId: "btc-mainnet" };

    const { result } = renderHook(
      () => useSendFlowInit(wallet, addressService),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.walletType).toBe("mnemonic");
    });

    expect(secrets.getWalletType).toHaveBeenCalledWith("wallet-1");
  });

  it("loads live fee rates via services.blockbook(networkId).estimateFee (not getBlockbookClient)", async () => {
    const wallet = { id: "wallet-1", networkId: "btc-mainnet" };

    const { result } = renderHook(
      () => useSendFlowInit(wallet, addressService),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loadingRates).toBe(false);
    });

    expect(blockbookFactory).toHaveBeenCalledWith("btc-mainnet");
    expect(result.current.liveRates).toEqual({
      slow: 2n,
      medium: 4n,
      fast: 8n,
    });
  });

  it("discovers addresses through addressService and derives signing reference", async () => {
    const wallet = { id: "wallet-1", networkId: "btc-mainnet" };

    const { result } = renderHook(
      () => useSendFlowInit(wallet, addressService),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    expect(discoverAddresses).toHaveBeenCalledWith({
      wallet: {
        walletId: "wallet-1",
        networkId: "btc-mainnet",
        walletType: "mnemonic",
        capability: "signing",
      },
    });
    expect(result.current.walletAddresses).toEqual([
      "bc1-addr-0",
      "bc1-addr-1",
    ]);
    expect(result.current.changeAddress).toBe("bc1-change");
    expect(result.current.signingWallet).toEqual({
      walletId: "wallet-1",
      networkId: "btc-mainnet",
      walletType: "mnemonic",
      capability: "signing",
    });
    expect(result.current.initError).toBeNull();
  });

  it("short-circuits for watch-only (xpub) wallets without calling addressService", async () => {
    secrets.getWalletType.mockResolvedValue("xpub");
    const wallet = { id: "wallet-2", networkId: "btc-mainnet" };

    const { result } = renderHook(
      () => useSendFlowInit(wallet, addressService),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    expect(discoverAddresses).not.toHaveBeenCalled();
    expect(result.current.walletType).toBe("xpub");
    expect(result.current.signingWallet).toBeNull();
  });

  it("reports an init error when services.secrets.getWalletType returns null", async () => {
    secrets.getWalletType.mockResolvedValue(null);
    const wallet = { id: "wallet-3", networkId: "btc-mainnet" };

    const { result } = renderHook(
      () => useSendFlowInit(wallet, addressService),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    expect(result.current.initError).toBe("Wallet type not found");
  });

  it("sets null liveRates when estimateFee fails", async () => {
    blockbookEstimateFee.mockReset();
    blockbookEstimateFee.mockRejectedValue(new Error("offline"));
    const wallet = { id: "wallet-1", networkId: "btc-mainnet" };

    const { result } = renderHook(
      () => useSendFlowInit(wallet, addressService),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loadingRates).toBe(false);
    });

    expect(result.current.liveRates).toBeNull();
  });

  it("flags No active wallet when wallet is null", async () => {
    const { result } = renderHook(() => useSendFlowInit(null, addressService), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });

    expect(result.current.initError).toBe("No active wallet");
  });
});
