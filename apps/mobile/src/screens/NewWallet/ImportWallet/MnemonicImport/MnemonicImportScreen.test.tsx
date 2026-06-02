import { fireEvent, screen } from "@testing-library/react-native";
import MnemonicImportScreen from "./MnemonicImportScreen";
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
  useMnemonicImportFlow: jest.fn(),
}));

// analytics port stub. MnemonicImportScreen
// instruments the wallet.import flow via useAnalyticsFlow + useAdapters.
jest.mock("@prl-wallet/app-adapters", () => ({
  useAdapters: () => ({ services: {} }),
}));

const { useMnemonicImportFlow } = jest.requireMock("@prl-wallet/app-flows") as {
  useMnemonicImportFlow: jest.Mock;
};

function createNavigation() {
  return { goBack: jest.fn(), navigate: jest.fn() };
}

describe("MnemonicImportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMnemonicImportFlow.mockReturnValue({
      error: "Invalid mnemonic - check each word and try again.",
      importWallet: jest.fn(),
      isImporting: false,
      setSelectedWordCount: jest.fn(),
      setWord: jest.fn(),
      wordCount: 24,
      words: Array.from({ length: 24 }, (_, index) =>
        index === 0 ? "abandon" : "",
      ),
    });
  });

  it("renders word-count controls, error state, and import action from hook state", () => {
    const navigation = createNavigation();

    renderScreen(<MnemonicImportScreen navigation={navigation as never} />, {
      navigation,
    });

    expect(screen.getByLabelText("12 words")).toBeTruthy();
    expect(screen.getByLabelText("24 words")).toBeTruthy();
    expect(
      screen.getByText("Invalid mnemonic - check each word and try again."),
    ).toBeTruthy();
    expect(screen.getByText("Import")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("12 words"));
    fireEvent.changeText(screen.getAllByDisplayValue("")[0], "legal");
    fireEvent.press(screen.getByLabelText("Import wallet"));

    expect(
      useMnemonicImportFlow.mock.results[0]?.value.setSelectedWordCount,
    ).toHaveBeenCalledWith(12);
    expect(
      useMnemonicImportFlow.mock.results[0]?.value.setWord,
    ).toHaveBeenCalledWith(1, "legal");
    expect(
      useMnemonicImportFlow.mock.results[0]?.value.importWallet,
    ).toHaveBeenCalledTimes(1);
  });
});
