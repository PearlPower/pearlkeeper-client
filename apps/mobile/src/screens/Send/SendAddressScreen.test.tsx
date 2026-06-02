import { fireEvent, screen } from "@testing-library/react-native";
import SendAddressScreen from "./SendAddressScreen";
import { renderScreen } from "../../test-utils/renderScreen";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
  };
});

jest.mock("./SendFlowContext", () => ({
  useSendFlow: jest.fn(),
}));

jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
}));

const { useSendFlow } = jest.requireMock("./SendFlowContext") as {
  useSendFlow: jest.Mock;
};

// analytics flow stub. SendAddressScreen reads
// `analyticsFlow` from useSendFlow() and emits start + step events;
// stub the four callbacks so the screen renders without crashing.
const mockAnalyticsFlow = {
  start: jest.fn(),
  step: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
};

function createFlowState(overrides: Record<string, unknown> = {}) {
  return {
    walletId: "wallet-1",
    addressError: null,
    analyticsFlow: mockAnalyticsFlow,
    closeScanner: jest.fn(),
    handleQRScanned: jest.fn(),
    isWatchOnly: false,
    openScanner: jest.fn().mockResolvedValue(undefined),
    recipientAddress: "",
    scannerVisible: false,
    scanned: false,
    screenTitle: "Send Bitcoin",
    setRecipientAddress: jest.fn(),
    validateAddress: jest.fn().mockReturnValue(true),
    ...overrides,
  };
}

describe("SendAddressScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSendFlow.mockReturnValue(createFlowState());
  });

  it("shows the watch-only guard when the send flow is blocked", () => {
    useSendFlow.mockReturnValue(createFlowState({ isWatchOnly: true }));

    renderScreen(<SendAddressScreen />);

    expect(screen.getByText("Watch-only Wallet")).toBeTruthy();
    expect(
      screen.getByText(
        "This is a watch-only wallet. Sending is not supported.",
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Next")).toBeNull();
  });

  it("renders the extracted recipient form state and actions", async () => {
    const flowState = createFlowState({
      addressError: "Invalid Bitcoin address. Please check and try again.",
      recipientAddress: "bad-address",
    });

    useSendFlow.mockReturnValue(flowState);

    renderScreen(<SendAddressScreen />);

    expect(screen.getByTestId("send-address-form")).toBeTruthy();
    expect(screen.getByText("Send Bitcoin")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3 — Recipient Address")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter recipient address")).toBeTruthy();
    expect(
      screen.getByText("Invalid Bitcoin address. Please check and try again."),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Scan QR code"));
    fireEvent.press(screen.getByLabelText("Next"));

    await screen.findByText("Send Bitcoin");
    expect(flowState.openScanner).toHaveBeenCalledTimes(1);
    expect(flowState.validateAddress).toHaveBeenCalledTimes(1);
  });

  it("renders the extracted QR scanner modal and closes it from hook handlers", () => {
    const flowState = createFlowState({ scannerVisible: true });

    useSendFlow.mockReturnValue(flowState);

    renderScreen(<SendAddressScreen />);

    expect(screen.getByTestId("send-scanner-modal")).toBeTruthy();
    expect(
      screen.getByText("Point at a recipient address QR code"),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Cancel QR scan"));

    expect(flowState.closeScanner).toHaveBeenCalledTimes(1);
  });
});
