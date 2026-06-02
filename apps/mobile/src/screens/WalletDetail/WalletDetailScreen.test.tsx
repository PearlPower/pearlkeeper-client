import { fireEvent, screen } from "@testing-library/react-native";
import WalletDetailScreen from "./WalletDetailScreen";
import { renderScreen } from "../../test-utils/renderScreen";

const mockWalletDetailHeader = jest.fn();
const mockWalletDetailActions = jest.fn();
const mockWalletDetailOptionsSheet = jest.fn();

jest.mock("@prl-wallet/app-flows", () => {
  const actual = jest.requireActual("@prl-wallet/app-flows");
  return {
    ...actual,
    useWalletDetailFlow: jest.fn(),
  };
});

jest.mock("./components/WalletDetailHeader", () => ({
  WalletDetailHeader: (props: {
    onOpenOptionsMenu: () => void;
    walletName: string;
  }) => {
    const { Text, TouchableOpacity } = jest.requireActual("react-native");
    mockWalletDetailHeader(props);
    return (
      <>
        <Text>Mock Wallet Detail Header</Text>
        <Text>{props.walletName}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Wallet options"
          onPress={props.onOpenOptionsMenu}
        >
          <Text>Wallet options</Text>
        </TouchableOpacity>
      </>
    );
  },
}));

jest.mock("../../components/BalanceSection", () => ({
  BalanceSection: () => null,
}));

jest.mock("./components/WalletDetailActions", () => ({
  WalletDetailActions: (props: {
    onOpenAddressList: () => void;
    onOpenReceive: () => void;
    onOpenSend: () => void;
    onOpenTransactionHistory: () => void;
  }) => {
    const { Text, TouchableOpacity } = jest.requireActual("react-native");
    mockWalletDetailActions(props);
    return (
      <>
        <Text>Mock Wallet Detail Actions</Text>
        <Text>Watch-only</Text>
        <Text>Testnet</Text>
        <Text>View addresses (2) →</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="View all addresses"
          onPress={props.onOpenAddressList}
        >
          <Text>View all addresses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Transaction History"
          onPress={props.onOpenTransactionHistory}
        >
          <Text>Transaction History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Send (not available for watch-only wallets)"
          onPress={props.onOpenSend}
        >
          <Text>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Receive"
          onPress={props.onOpenReceive}
        >
          <Text>Receive</Text>
        </TouchableOpacity>
      </>
    );
  },
}));

jest.mock("./components/WalletDetailOptionsSheet", () => ({
  WalletDetailOptionsSheet: (props: {
    deleteVisible: boolean;
    onConfirmDelete: () => void;
    onOpenDeleteConfirmation: () => void;
    optionsVisible: boolean;
  }) => {
    const { Text, TouchableOpacity } = jest.requireActual("react-native");
    mockWalletDetailOptionsSheet(props);
    return props.optionsVisible || props.deleteVisible ? (
      <>
        <Text>Mock Wallet Detail Options</Text>
        {props.optionsVisible ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Delete wallet"
            onPress={props.onOpenDeleteConfirmation}
          >
            <Text>Delete wallet</Text>
          </TouchableOpacity>
        ) : null}
        {props.deleteVisible ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Confirm delete wallet"
            onPress={props.onConfirmDelete}
          >
            <Text>Confirm delete wallet</Text>
          </TouchableOpacity>
        ) : null}
      </>
    ) : null;
  },
}));

const { useWalletDetailFlow } = jest.requireMock("@prl-wallet/app-flows") as {
  useWalletDetailFlow: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
    dispatch: jest.fn(),
    popToTop: jest.fn(),
  };
}

describe("WalletDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWalletDetailFlow.mockReturnValue({
      addresses: ["bc1-used", "bc1-receive"],
      deleteWallet: jest.fn().mockResolvedValue(undefined),
      hasMultipleAddresses: true,
      isDiscovering: false,
      isRefreshing: false,
      networkId: "btc-testnet",
      openAddressList: jest.fn(),
      openReceive: jest.fn(),
      openSend: jest.fn(),
      openTransactionHistory: jest.fn(),
      persistBalance: jest.fn(),
      refresh: jest.fn(),
      usedAddressCount: 2,
      wallet: {
        id: "wallet-1",
        name: "Primary Wallet",
        lastKnownBalance: "1000",
      },
      walletType: "xpub",
    });
  });

  it("renders decomposed wallet detail sections and keeps hook-owned actions wired", async () => {
    const navigation = createNavigation();
    const route = {
      key: "wallet-detail",
      name: "WalletDetail",
      params: { walletId: "wallet-1" },
    };

    renderScreen(
      <WalletDetailScreen
        navigation={navigation as never}
        route={route as never}
      />,
      { navigation, route },
    );

    expect(screen.getByText("Mock Wallet Detail Header")).toBeTruthy();
    expect(screen.getByText("Mock Wallet Detail Actions")).toBeTruthy();
    expect(screen.getByText("Primary Wallet")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("View all addresses"));
    fireEvent.press(screen.getByLabelText("Transaction History"));
    fireEvent.press(screen.getByLabelText("Receive"));
    fireEvent.press(screen.getByLabelText("Wallet options"));
    fireEvent.press(screen.getByLabelText("Delete wallet"));
    fireEvent.press(screen.getByLabelText("Confirm delete wallet"));

    expect(mockWalletDetailHeader).toHaveBeenCalled();
    expect(mockWalletDetailActions).toHaveBeenCalled();
    expect(mockWalletDetailOptionsSheet).toHaveBeenCalledWith(
      expect.objectContaining({ optionsVisible: false, deleteVisible: false }),
    );
    expect(
      useWalletDetailFlow.mock.results[0]?.value.openAddressList,
    ).toHaveBeenCalledTimes(1);
    expect(
      useWalletDetailFlow.mock.results[0]?.value.openTransactionHistory,
    ).toHaveBeenCalledTimes(1);
    expect(
      useWalletDetailFlow.mock.results[0]?.value.openReceive,
    ).toHaveBeenCalledTimes(1);
    expect(
      useWalletDetailFlow.mock.results[0]?.value.deleteWallet,
    ).toHaveBeenCalledTimes(1);
  });
});
