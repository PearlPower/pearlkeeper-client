import { fireEvent, screen } from "@testing-library/react-native";
import XpubImportScreen from "./XpubImportScreen";
import { renderScreen } from "../../../../test-utils/renderScreen";

jest.mock("../../NewWalletContext", () => ({
  useNewWalletContext: jest.fn(() => ({
    ports: {},
    addressService: {},
    blockchainConfig: {},
    networkConfig: {},
    network: {},
    bip86Path: jest.fn(),
    blockbookUrl: "",
    setChain: jest.fn(),
  })),
}));

jest.mock("@prl-wallet/app-flows", () => ({
  ...jest.requireActual("@prl-wallet/app-flows"),
  useXpubImportFlow: jest.fn(),
}));

// analytics port stub. XpubImportScreen instruments
// the wallet.import flow via useAnalyticsFlow + useAdapters.
jest.mock("@prl-wallet/app-adapters", () => ({
  useAdapters: () => ({ services: {} }),
}));

const { useXpubImportFlow } = jest.requireMock("@prl-wallet/app-flows") as {
  useXpubImportFlow: jest.Mock;
};

function createNavigation() {
  return { goBack: jest.fn(), navigate: jest.fn() };
}

describe("XpubImportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useXpubImportFlow.mockReturnValue({
      error:
        "Invalid extended public key - must be a valid extended public key in base58 format.",
      extendedPubKeyPrefix: "xpub",
      importWallet: jest.fn(),
      isImporting: false,
      previewAddress: "bc1ppreviewaddress",
      setXpub: jest.fn(),
      xpub: "xpub6example",
    });
  });

  it("renders preview, warning, error state, and add-wallet action from hook state", () => {
    const navigation = createNavigation();

    renderScreen(<XpubImportScreen navigation={navigation as never} />, {
      navigation,
    });

    expect(screen.getByText("Watch-only Wallet")).toBeTruthy();
    expect(screen.getByDisplayValue("xpub6example")).toBeTruthy();
    expect(
      screen.getByText(/This app only supports Taproot addresses/),
    ).toBeTruthy();
    expect(screen.getByText("First receive address:")).toBeTruthy();
    expect(screen.getByText("bc1ppreviewaddress")).toBeTruthy();
    expect(
      screen.getByText(
        "Invalid extended public key - must be a valid extended public key in base58 format.",
      ),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue("xpub6example"), "xpub6next");
    fireEvent.press(screen.getByLabelText("Add watch-only wallet"));

    expect(
      useXpubImportFlow.mock.results[0]?.value.setXpub,
    ).toHaveBeenCalledWith("xpub6next");
    expect(
      useXpubImportFlow.mock.results[0]?.value.importWallet,
    ).toHaveBeenCalledTimes(1);
  });

  it("disables import button and shows scanning text while importing", () => {
    const navigation = createNavigation();

    useXpubImportFlow.mockReturnValue({
      error: null,
      extendedPubKeyPrefix: "xpub",
      importWallet: jest.fn(),
      isImporting: true,
      previewAddress: null,
      setXpub: jest.fn(),
      xpub: "xpub6example",
    });

    renderScreen(<XpubImportScreen navigation={navigation as never} />, {
      navigation,
    });

    expect(screen.getByText("Scanning addresses...")).toBeTruthy();
    const button = screen.getByLabelText("Add watch-only wallet");
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });
});
