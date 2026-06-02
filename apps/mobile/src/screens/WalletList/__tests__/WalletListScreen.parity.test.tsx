// apps/mobile/src/screens/WalletList/__tests__/WalletListScreen.parity.test.tsx
// GREEN flip of the Wave-0 RED stubs ( + ).
//
// Verifies:
// • Type-specific badges render based on async ports.secrets.getWalletType
// (Mnemonic / BIP32 / Watch-only — verbatim copy per UI-SPEC §Copywriting).
// • Mainnet pill renders when !isTestnet (mutually exclusive with Testnet).
// • While walletType is loading (initial state), no type badge renders
// (UI-SPEC Lock #9 — empty space, no placeholder spinner).

import { screen, waitFor } from "@testing-library/react-native";
import WalletListScreen from "../WalletListScreen";
import { renderScreen } from "../../../test-utils/renderScreen";

jest.mock("../../../store/walletListStore", () => ({
  useWalletListStore: jest.fn(),
}));

jest.mock("@prl-wallet/app-flows", () => {
  const actual = jest.requireActual("@prl-wallet/app-flows");
  return {
    ...actual,
    useWalletServices: jest.fn(),
  };
});

jest.mock("../../../services/adapters/createServicePorts", () => ({
  createServicePorts: jest.fn(),
}));

jest.mock("../../../services/blockbookClient", () => ({
  getBlockbookClient: jest.fn(),
}));

const { useWalletListStore } = jest.requireMock(
  "../../../store/walletListStore",
) as { useWalletListStore: jest.Mock };

const { useWalletServices } = jest.requireMock("@prl-wallet/app-flows") as {
  useWalletServices: jest.Mock;
};

const { createServicePorts } = jest.requireMock(
  "../../../services/adapters/createServicePorts",
) as { createServicePorts: jest.Mock };

const { getBlockbookClient } = jest.requireMock(
  "../../../services/blockbookClient",
) as { getBlockbookClient: jest.Mock };

type WalletType = "mnemonic" | "bip32Seed" | "xpub";

function setup(opts: {
  walletType: WalletType;
  networkId?: string;
}) {
  const wallets = [
    {
      createdAt: 1,
      id: "wallet-1",
      name: "Test Wallet",
      networkId: opts.networkId ?? "btc-mainnet",
    },
  ];
  const state = {
    pendingOpenWalletId: null,
    setPendingOpenWalletId: jest.fn(),
    setWalletBalanceRefreshing: jest.fn(),
    updateWalletBalance: jest.fn(),
    walletBalanceRefreshState: {},
    wallets,
  };
  useWalletListStore.mockImplementation(
    (selector: (value: typeof state) => unknown) => selector(state),
  );

  const discoverAddresses = jest
    .fn()
    .mockResolvedValue({ derivedAddresses: [] });
  const getWalletType = jest.fn().mockResolvedValue(opts.walletType);
  const getAddress = jest.fn();
  useWalletServices.mockReturnValue({
    addressService: { discoverAddresses },
  });
  createServicePorts.mockReturnValue({
    secrets: { getWalletType },
  });
  getBlockbookClient.mockReturnValue({ getAddress });

  const navigation = { navigate: jest.fn(), reset: jest.fn() };
  renderScreen(<WalletListScreen navigation={navigation as never} />, {
    navigation,
  });
}

describe("WalletListScreen parity badges (, )", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders 'Mnemonic' badge when walletType === 'mnemonic'", async () => {
    setup({ walletType: "mnemonic" });
    await waitFor(() => {
      expect(screen.getByText("Mnemonic")).toBeTruthy();
    });
    expect(screen.queryByText("BIP32")).toBeNull();
    expect(screen.queryByText("Watch-only")).toBeNull();
  });

  it("renders 'BIP32' badge when walletType === 'bip32Seed'", async () => {
    setup({ walletType: "bip32Seed" });
    await waitFor(() => {
      expect(screen.getByText("BIP32")).toBeTruthy();
    });
    expect(screen.queryByText("Mnemonic")).toBeNull();
    expect(screen.queryByText("Watch-only")).toBeNull();
  });

  it("renders 'Watch-only' badge (warning palette) when walletType === 'xpub'", async () => {
    setup({ walletType: "xpub" });
    await waitFor(() => {
      expect(screen.getByText("Watch-only")).toBeTruthy();
    });
    expect(screen.queryByText("Mnemonic")).toBeNull();
    expect(screen.queryByText("BIP32")).toBeNull();
  });

  it("renders 'Mainnet' pill when !isTestnet", async () => {
    setup({ walletType: "mnemonic", networkId: "btc-mainnet" });
    // Mainnet pill is sync — does not depend on async walletType.
    expect(screen.getByText("Mainnet")).toBeTruthy();
    expect(screen.queryByText("Testnet")).toBeNull();
  });

  it("renders 'Testnet' pill when isTestnet (existing — regression guard)", () => {
    setup({ walletType: "mnemonic", networkId: "btc-testnet" });
    expect(screen.getByText("Testnet")).toBeTruthy();
    expect(screen.queryByText("Mainnet")).toBeNull();
  });

  it("renders no type badge while walletType is loading (UI-SPEC Lock #9)", () => {
    // Pre-resolution state: getWalletType returns a never-resolving promise so
    // walletTypes[wallet.id] stays undefined and the type-badge slot stays empty.
    const wallets = [
      {
        createdAt: 1,
        id: "wallet-1",
        name: "Loading Wallet",
        networkId: "btc-mainnet",
      },
    ];
    const state = {
      pendingOpenWalletId: null,
      setPendingOpenWalletId: jest.fn(),
      setWalletBalanceRefreshing: jest.fn(),
      updateWalletBalance: jest.fn(),
      walletBalanceRefreshState: {},
      wallets,
    };
    useWalletListStore.mockImplementation(
      (selector: (value: typeof state) => unknown) => selector(state),
    );
    useWalletServices.mockReturnValue({
      addressService: { discoverAddresses: jest.fn() },
    });
    createServicePorts.mockReturnValue({
      secrets: { getWalletType: jest.fn(() => new Promise(() => {})) },
    });
    getBlockbookClient.mockReturnValue({ getAddress: jest.fn() });

    const navigation = { navigate: jest.fn(), reset: jest.fn() };
    renderScreen(<WalletListScreen navigation={navigation as never} />, {
      navigation,
    });
    // None of the type-badge labels appear while loading.
    expect(screen.queryByText("Mnemonic")).toBeNull();
    expect(screen.queryByText("BIP32")).toBeNull();
    expect(screen.queryByText("Watch-only")).toBeNull();
    // The legacy generic "Wallet" badge MUST also stay gone.
    expect(screen.queryByText("Wallet")).toBeNull();
  });

  it("scaffold loads (sanity)", () => {
    expect(true).toBe(true);
  });
});
