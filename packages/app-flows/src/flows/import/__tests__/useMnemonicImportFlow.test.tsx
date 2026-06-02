import { act, renderHook } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import { isValidMnemonic } from "@prl-wallet/core";
import { useMnemonicImportFlow } from "../useMnemonicImportFlow.js";
import { createPortWrapper } from "../../../test-utils/createPortWrapper.js";

const isValidMnemonicMock = isValidMnemonic as jest.MockedFunction<
  typeof isValidMnemonic
>;

function createMockPorts() {
  return {
    secrets: {
      storeMnemonic: jest.fn(),
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
        { index: 0, address: "bc1-used", hasTransactions: true },
        { index: 1, address: "bc1-receive", hasTransactions: false },
      ],
      receiveAddress: "bc1-receive",
      receiveAddressIndex: 1,
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

describe("useMnemonicImportFlow", () => {
  let wrapper: ReturnType<typeof createPortWrapper>;

  beforeEach(() => {
    jest.clearAllMocks();
    wrapper = createPortWrapper(buildBundle());
  });

  it("imports a mnemonic wallet and navigates to WalletName via intent callback", async () => {
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useMnemonicImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
        }),
      { wrapper },
    );

    act(() => {
      for (let i = 0; i < 11; i++) result.current.setWord(i, "abandon");
      result.current.setWord(11, "about");
    });

    await act(async () => {
      await result.current.importWallet();
    });

    expect(ports.secrets.storeMnemonic).toHaveBeenCalledWith(
      "wallet-123",
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    );
    expect(ports.secrets.storeWalletType).toHaveBeenCalledWith(
      "wallet-123",
      "mnemonic",
    );
    expect(addressService.discoverAddresses).toHaveBeenCalledWith({
      wallet: {
        walletId: "wallet-123",
        networkId: "btc-mainnet",
        walletType: "mnemonic",
        capability: "signing",
      },
    });
    expect(navigation.goToWalletName).toHaveBeenCalledWith(
      "wallet-123",
      "bc1-receive",
      "mnemonic",
    );
  });

  it("surfaces validation error when words are empty", async () => {
    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useMnemonicImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.importWallet();
    });

    expect(result.current.error).toBe(
      "Please fill in all word fields before importing.",
    );
    expect(ports.secrets.storeMnemonic).not.toHaveBeenCalled();
  });

  it("rejects mnemonics that fail BIP39 checksum and stores no secrets", async () => {
    isValidMnemonicMock.mockReturnValueOnce(false);

    const navigation = { goToWalletName: jest.fn() };
    const ports = createMockPorts();
    const addressService = createMockAddressService();

    const { result } = renderHook(
      () =>
        useMnemonicImportFlow({
          navigation,
          addressService: addressService as never,
          ports: ports as never,
          networkId: "btc-mainnet",
        }),
      { wrapper },
    );

    act(() => {
      for (let i = 0; i < 12; i++) result.current.setWord(i, "abandon");
    });

    await act(async () => {
      await result.current.importWallet();
    });

    expect(result.current.error).toMatch(/Invalid mnemonic/i);
    expect(ports.secrets.storeMnemonic).not.toHaveBeenCalled();
    expect(ports.secrets.storeWalletType).not.toHaveBeenCalled();
    expect(addressService.discoverAddresses).not.toHaveBeenCalled();
    expect(navigation.goToWalletName).not.toHaveBeenCalled();
  });
});
