import { screen } from "@testing-library/react-native";
import SendReviewScreen from "./SendReviewScreen";
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

const { useSendFlow } = jest.requireMock("./SendFlowContext") as {
  useSendFlow: jest.Mock;
};

// analytics flow stub.
const mockAnalyticsFlow = {
  start: jest.fn(),
  step: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
};

function createFlowState(overrides: Record<string, unknown> = {}) {
  return {
    amountDisplay: "0.001 PRL",
    analyticsFlow: mockAnalyticsFlow,
    canRetry: true,
    canSend: true,
    confirmSend: jest.fn(),
    errorMessage: null,
    estimatedFeeDisplay: "0.000012 PRL",
    feeTierLabel: "Fast",
    isBroadcasting: false,
    isInitializing: false,
    isBalanceLoading: false,
    recipientAddress: "bc1qrecipient",
    recipientAmountDisplay: "0.001 PRL",
    remainingBalanceSats: "50000",
    remainingDisplay: "0.0005 PRL",
    retrySend: jest.fn(),
    showRecipientAmount: false,
    totalDeductedDisplay: "0.001012 PRL",
    txid: null,
    ...overrides,
  };
}

describe("SendReviewScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSendFlow.mockReturnValue(createFlowState());
  });

  it("renders summary rows and a ready confirm action from context state", () => {
    renderScreen(<SendReviewScreen />);

    expect(screen.getByText("Review Transaction")).toBeTruthy();
    expect(screen.getByText("To")).toBeTruthy();
    expect(screen.getByText("Fee tier")).toBeTruthy();
    expect(screen.getByText("Fee (est.)")).toBeTruthy();
    expect(screen.getByText("Remaining")).toBeTruthy();
    expect(screen.getByText("Fast")).toBeTruthy();
    expect(screen.getByText("0.001012 PRL")).toBeTruthy();
    expect(
      screen.getByLabelText("Confirm and broadcast transaction"),
    ).toBeTruthy();
  });

  it("renders retry and disabled or busy confirm states from context state", () => {
    useSendFlow.mockReturnValue(
      createFlowState({
        canSend: false,
        errorMessage: "broadcast failed",
      }),
    );

    const firstRender = renderScreen(<SendReviewScreen />);

    expect(screen.getByText("broadcast failed")).toBeTruthy();
    expect(screen.getByLabelText("Retry broadcast")).toBeEnabled();

    firstRender.unmount();

    useSendFlow.mockReturnValue(
      createFlowState({
        canSend: false,
        errorMessage: null,
        isBroadcasting: true,
      }),
    );

    renderScreen(<SendReviewScreen />);

    expect(
      screen.getByLabelText("Confirm and broadcast transaction"),
    ).toBeDisabled();
  });

  it("disables retry for verification errors and hides confirm button", () => {
    useSendFlow.mockReturnValue(
      createFlowState({
        canRetry: false,
        canSend: false,
        errorMessage: "Amount plus fees exceeds your available balance.",
        remainingBalanceSats: "-1200",
        remainingDisplay: "Insufficient funds",
      }),
    );

    renderScreen(<SendReviewScreen />);

    expect(
      screen.getByText("Amount plus fees exceeds your available balance."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Retry broadcast")).toBeDisabled();
    expect(
      screen.queryByLabelText("Confirm and broadcast transaction"),
    ).toBeNull();
  });
});
