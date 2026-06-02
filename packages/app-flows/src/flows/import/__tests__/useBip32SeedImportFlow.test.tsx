import { act, renderHook } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { useBip32SeedImportFlow } from "../useBip32SeedImportFlow.js";
import { createPortWrapper } from "../../../test-utils/createPortWrapper.js";

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
      storeBIP32Seed: jest.fn(),
      storeWalletType: jest.fn(),
    },
    registry: { addWallet: jest.fn() },
    runtime: { createId: jest.fn().mockReturnValue("wallet-123") },
  };
}

function createMockAddressService() {
  return {
    discoverAddresses: jest.fn().mockResolvedValue({
      derivedAddresses: [
        { index: 0, address: "bc1-root", hasTransactions: false },
      ],
      receiveAddress: "bc1-root",
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

describe("useBip32SeedImportFlow", () => {
  let wrapper: ReturnType<typeof createPortWrapper>;

  beforeEach(() => {
    jest.clearAllMocks();
    wrapper = createPortWrapper(buildBundle());
  });

  it("imports from hex, preserves loading state, and keeps scan log", async () => {
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
        useBip32SeedImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          extendedKeyPrefix: "xprv",
        }),
      { wrapper },
    );

    act(() => {
      result.current.setInput(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      );
    });

    let importPromise!: Promise<void>;
    await act(async () => {
      importPromise = result.current.importWallet();
    });

    expect(result.current.isImporting).toBe(true);
    expect(result.current.scanLog.length).toBeGreaterThan(0);
    expect(ports.secrets.storeBIP32Seed).toHaveBeenCalledWith(
      "wallet-123",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    disc.resolve({
      derivedAddresses: [
        { index: 0, address: "bc1-root", hasTransactions: false },
      ],
      receiveAddress: "bc1-root",
      receiveAddressIndex: 0,
      warnings: [],
    });
    await act(async () => {
      await importPromise;
    });

    expect(navigation.goToWalletName).toHaveBeenCalledWith(
      "wallet-123",
      "bc1-root",
      "bip32Seed",
    );
    expect(result.current.isImporting).toBe(false);
  });

  it("imports from extended private key", async () => {
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useBip32SeedImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          extendedKeyPrefix: "xprv",
        }),
      { wrapper },
    );

    act(() => {
      result.current.setInput("xprv9s21ZrQH143K3example");
    });
    await act(async () => {
      await result.current.importWallet();
    });

    expect(ports.secrets.storeBIP32Seed).toHaveBeenCalledWith(
      "wallet-123",
      "xprv9s21ZrQH143K3example",
    );
    expect(navigation.goToWalletName).toHaveBeenCalledWith(
      "wallet-123",
      "bc1-root",
      "bip32Seed",
    );
  });

  it("rejects 12-word mnemonic with friendly redirect (regression: Bug 3)", async () => {
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useBip32SeedImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          extendedKeyPrefix: "xprv",
        }),
      { wrapper },
    );

    act(() => {
      // The exact phrase that previously surfaced
      // `Unknown letter: "l". Allowed: ...` from bs58 deep in the
      // discovery path. Must now bail BEFORE storage with a friendly hint.
      result.current.setInput(
        "clump rally system click liquid album organ figure actor average visit hawk",
      );
    });
    await act(async () => {
      await result.current.importWallet();
    });

    expect(result.current.error).toMatch(/seed phrase/i);
    expect(result.current.error).toMatch(/mnemonic/i);
    expect(ports.secrets.storeBIP32Seed).not.toHaveBeenCalled();
    expect(addressService.discoverAddresses).not.toHaveBeenCalled();
  });

  it("shows validation error for empty input", async () => {
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useBip32SeedImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
          extendedKeyPrefix: "xprv",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.importWallet();
    });

    expect(result.current.error).toBe(
      "Please enter a BIP32 seed (hex) or xprv key.",
    );
    expect(ports.secrets.storeBIP32Seed).not.toHaveBeenCalled();
  });
});
