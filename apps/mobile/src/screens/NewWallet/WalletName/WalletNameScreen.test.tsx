import { fireEvent, screen } from "@testing-library/react-native";
import WalletNameScreen from "./WalletNameScreen";
import { renderScreen } from "../../../test-utils/renderScreen";

jest.mock("@prl-wallet/app-flows", () => ({
  ...jest.requireActual("@prl-wallet/app-flows"),
  useWalletNameFlow: jest.fn(),
}));

// analytics port stub. WalletNameScreen instruments
// the wallet.create flow via useAnalyticsFlow + useAdapters; tests do not
// stand up an <AdaptersProvider>, so mock useAdapters with a stub
// services bundle (analytics undefined → screen falls back to
// NOOP_ANALYTICS_PORT internally).
jest.mock("@prl-wallet/app-adapters", () => ({
  useAdapters: () => ({ services: {} }),
}));

const { useWalletNameFlow } = jest.requireMock("@prl-wallet/app-flows") as {
  useWalletNameFlow: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
  };
}

describe("WalletNameScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWalletNameFlow.mockReturnValue({
      continueToSetupSuccess: jest.fn(),
      error: '"Wallet 1" is already in use. Please choose a different name.',
      setWalletName: jest.fn(),
      walletName: "Wallet 2",
    });
  });

  it("shows the default wallet name and duplicate-name error state", () => {
    const navigation = createNavigation();
    const route = {
      key: "wallet-name",
      name: "WalletName",
      params: {
        walletId: "wallet-1",
        address: "bc1qexample",
        walletType: "mnemonic",
      },
    };

    renderScreen(
      <WalletNameScreen
        navigation={navigation as never}
        route={route as never}
      />,
      {
        navigation,
        route,
      },
    );

    const input = screen.getByDisplayValue("Wallet 2");
    expect(input).toBeTruthy();
    expect(
      screen.getByText(
        '"Wallet 1" is already in use. Please choose a different name.',
      ),
    ).toBeTruthy();

    fireEvent.changeText(input, "Travel Wallet");
    fireEvent.press(screen.getByLabelText("Continue"));

    expect(
      useWalletNameFlow.mock.results[0]?.value.setWalletName,
    ).toHaveBeenCalledWith("Travel Wallet");
    expect(
      useWalletNameFlow.mock.results[0]?.value.continueToSetupSuccess,
    ).toHaveBeenCalledTimes(1);
  });
});
