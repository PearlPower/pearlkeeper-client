import { fireEvent, screen } from "@testing-library/react-native";
import WalletListScreen from "./WalletListScreen";
import { renderScreen } from "../../test-utils/renderScreen";

jest.mock("../../store/walletListStore", () => ({
  useWalletListStore: jest.fn(),
}));

jest.mock("@prl-wallet/app-flows", () => {
  const actual = jest.requireActual("@prl-wallet/app-flows");
  return {
    ...actual,
    useWalletServices: jest.fn(),
  };
});

jest.mock("../../services/adapters/createServicePorts", () => ({
  createServicePorts: jest.fn(),
}));

jest.mock("../../services/blockbookClient", () => ({
  getBlockbookClient: jest.fn(),
}));

const { useWalletListStore } = jest.requireMock(
  "../../store/walletListStore",
) as {
  useWalletListStore: jest.Mock;
};

const { useWalletServices } = jest.requireMock("@prl-wallet/app-flows") as {
  useWalletServices: jest.Mock;
};

const { createServicePorts } = jest.requireMock(
  "../../services/adapters/createServicePorts",
) as {
  createServicePorts: jest.Mock;
};

const { getBlockbookClient } = jest.requireMock(
  "../../services/blockbookClient",
) as {
  getBlockbookClient: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
    reset: jest.fn(),
  };
}

function renderWalletListScreen(options?: {
  pendingOpenWalletId?: string | null;
  walletBalanceRefreshState?: Record<string, boolean>;
  wallets?: Array<{
    createdAt: number;
    id: string;
    lastKnownBalance?: string;
    name: string;
    networkId: string;
  }>;
}) {
  const navigation = createNavigation();
  const state = {
    pendingOpenWalletId: options?.pendingOpenWalletId ?? null,
    setPendingOpenWalletId: jest.fn(),
    setWalletBalanceRefreshing: jest.fn(),
    updateWalletBalance: jest.fn(),
    walletBalanceRefreshState: options?.walletBalanceRefreshState ?? {},
    wallets: options?.wallets ?? [],
  };

  useWalletListStore.mockImplementation(
    (selector: (value: typeof state) => unknown) => selector(state),
  );

  const discoverAddresses = jest
    .fn()
    .mockResolvedValue({ derivedAddresses: [] });
  const getWalletType = jest.fn().mockResolvedValue("mnemonic");
  const getAddress = jest.fn();

  useWalletServices.mockReturnValue({
    addressService: { discoverAddresses },
  });
  createServicePorts.mockReturnValue({
    secrets: { getWalletType },
  });
  getBlockbookClient.mockReturnValue({ getAddress });

  renderScreen(<WalletListScreen navigation={navigation as never} />, {
    navigation,
  });

  return {
    discoverAddresses,
    getAddress,
    getWalletType,
    navigation,
    state,
  };
}

describe("WalletListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the empty state and keeps header actions wired", () => {
    const { navigation } = renderWalletListScreen();

    expect(screen.getByText("My Wallets")).toBeTruthy();
    expect(screen.getByText("No wallets yet")).toBeTruthy();
    expect(screen.getByText("Tap + to add your first wallet")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Settings"));
    fireEvent.press(screen.getByLabelText("Add wallet"));

    expect(navigation.navigate).toHaveBeenCalledWith("Settings");
    expect(navigation.navigate).toHaveBeenCalledWith("NewWalletFlow");
  });

  it("renders wallet cards and loading indicators from store-backed state", () => {
    const wallets = [
      {
        createdAt: 1,
        id: "wallet-1",
        lastKnownBalance: "125000000",
        name: "Primary Wallet",
        networkId: "btc-mainnet",
      },
      {
        createdAt: 2,
        id: "wallet-2",
        name: "Travel Wallet",
        networkId: "btc-testnet",
      },
    ];

    const { navigation, state } = renderWalletListScreen({
      walletBalanceRefreshState: { "wallet-1": true },
      wallets,
    });

    expect(screen.getByText("Primary Wallet")).toBeTruthy();
    expect(screen.getByText("Travel Wallet")).toBeTruthy();
    // generic "Wallet" badge replaced with type-specific
    // variants (Mnemonic / BIP32 / Watch-only). While walletType is loading
    // (initial undefined), no type badge renders — UI-SPEC Lock #9.
    expect(screen.queryByText("Wallet")).toBeNull();
    expect(screen.getByText("Bitcoin 1.25")).toBeTruthy();
    expect(screen.getAllByText("Bitcoin")).toHaveLength(2);
    expect(screen.getByText("Testnet")).toBeTruthy();
    // mainnet wallet renders the Mainnet pill.
    expect(screen.getByText("Mainnet")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(state.setWalletBalanceRefreshing).toHaveBeenCalledWith(
      "wallet-1",
      true,
    );
    expect(state.setWalletBalanceRefreshing).toHaveBeenCalledWith(
      "wallet-2",
      true,
    );

    fireEvent.press(screen.getByLabelText("Open wallet Primary Wallet"));

    expect(navigation.navigate).toHaveBeenCalledWith("WalletDetail", {
      walletId: "wallet-1",
    });
  });
});
