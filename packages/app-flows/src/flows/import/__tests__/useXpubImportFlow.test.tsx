import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { useXpubImportFlow } from "../useXpubImportFlow.js";
import { createPortWrapper } from "../../../test-utils/createPortWrapper.js";

jest.mock("@prl-wallet/core", () => ({
  BIP32: {
    fromBase58: jest.fn(() => ({
      derive: jest.fn(() => ({
        derive: jest.fn(() => ({
          publicKey: Buffer.concat([Buffer.from([2]), Buffer.alloc(32, 1)]),
        })),
      })),
    })),
  },
  p2trAddress: jest.fn(() => "bc1-preview"),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createMockPorts() {
  return {
    secrets: {
      storeXpub: jest.fn(),
      storeWalletType: jest.fn(),
      deleteWalletSecrets: jest.fn().mockResolvedValue(undefined),
    },
    registry: { addWallet: jest.fn() },
    runtime: { createId: jest.fn().mockReturnValue("wallet-123") },
  };
}

function createMockAddressService() {
  return {
    discoverAddresses: jest.fn().mockResolvedValue({
      derivedAddresses: [
        { index: 0, address: "bc1-preview", hasTransactions: false },
      ],
      receiveAddress: "bc1-preview",
      receiveAddressIndex: 0,
      warnings: [],
    }),
  };
}

function buildBundle(): AdaptersBundle {
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
      walletList: {} as unknown as AdaptersBundle["stores"]["walletList"],
      pin: {} as unknown as AdaptersBundle["stores"]["pin"],
      lock: {} as unknown as AdaptersBundle["stores"]["lock"],
    },
  };
}

describe("useXpubImportFlow", () => {
  let wrapper: ReturnType<typeof createPortWrapper>;
  const network = { bech32: "bc" } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    wrapper = createPortWrapper(buildBundle());
  });

  it("derives preview and submits as watch-only", async () => {
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useXpubImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          network,
          extendedPubKeyPrefix: "xpub",
        }),
      { wrapper },
    );

    act(() => {
      result.current.setXpub("xpub6example");
    });

    await waitFor(() => {
      expect(result.current.previewAddress).toBe("bc1-preview");
    });

    await act(async () => {
      await result.current.importWallet();
    });

    expect(ports.secrets.storeXpub).toHaveBeenCalledWith(
      "wallet-123",
      "xpub6example",
    );
    expect(ports.secrets.storeWalletType).toHaveBeenCalledWith(
      "wallet-123",
      "xpub",
    );
    expect(addressService.discoverAddresses).toHaveBeenCalledWith({
      wallet: {
        walletId: "wallet-123",
        networkId: "btc-mainnet",
        walletType: "xpub",
        capability: "watchOnly",
      },
    });
    expect(navigation.goToWalletName).toHaveBeenCalledWith(
      "wallet-123",
      "bc1-preview",
      "xpub",
    );
  });

  it("shows error for invalid xpub", async () => {
    // CR-1: prefix-string guard rejects cross-network/garbage input BEFORE
    // it ever reaches secure storage. Pasting `xpubMalformedAfterPrefix`
    // bypasses the prefix check (right prefix) so we still exercise the
    // post-storage "could not derive" path for malformed-but-prefixed input.
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();
    addressService.discoverAddresses.mockRejectedValueOnce(
      new Error("invalid"),
    );

    const { result } = renderHook(
      () =>
        useXpubImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          network,
          extendedPubKeyPrefix: "xpub",
        }),
      { wrapper },
    );

    act(() => {
      result.current.setXpub("xpubMalformedAfterPrefix");
    });

    await act(async () => {
      await result.current.importWallet();
    });

    expect(result.current.error).toBe(
      "Invalid extended public key — must be a valid extended public key in base58 format.",
    );
  });

  it("rejects a cross-network paste (tpub on btc-mainnet xpub flow) BEFORE storage", async () => {
    // CR-1 regression test: a wrong-network paste must never reach the
    // keychain.
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useXpubImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          network,
          extendedPubKeyPrefix: "xpub",
        }),
      { wrapper },
    );

    act(() => {
      result.current.setXpub("tpubD6NzVbkrYhZ4WaY9CrossNetworkPasteShouldFail");
    });
    await act(async () => {
      await result.current.importWallet();
    });

    expect(result.current.error).toMatch(/isn't for btc-mainnet/);
    expect(result.current.error).toMatch(/"xpub"/);
    expect(ports.secrets.storeXpub).not.toHaveBeenCalled();
    expect(addressService.discoverAddresses).not.toHaveBeenCalled();
  });

  it("tracks isImporting state", async () => {
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();
    const disc = deferred<{
      derivedAddresses: unknown[];
      receiveAddress: string;
      receiveAddressIndex: number;
      warnings: string[];
    }>();
    addressService.discoverAddresses.mockReturnValueOnce(disc.promise);

    const { result } = renderHook(
      () =>
        useXpubImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          network,
          extendedPubKeyPrefix: "xpub",
        }),
      { wrapper },
    );

    act(() => {
      result.current.setXpub("xpub6example");
    });
    expect(result.current.isImporting).toBe(false);

    let importPromise!: Promise<void>;
    await act(async () => {
      importPromise = result.current.importWallet();
    });
    expect(result.current.isImporting).toBe(true);

    disc.resolve({
      derivedAddresses: [],
      receiveAddress: "bc1-xpub-addr",
      receiveAddressIndex: 0,
      warnings: [],
    });
    await act(async () => {
      await importPromise;
    });
    expect(result.current.isImporting).toBe(false);
  });
});
