import { fireEvent, screen } from "@testing-library/react-native";
import SendFeeScreen from "./SendFeeScreen";
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

describe("SendFeeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSendFlow.mockReturnValue({
      analyticsFlow: mockAnalyticsFlow,
      customError: "Please enter a valid sat/vbyte value (minimum 1).",
      customSatVbyte: "5",
      feeTierOptions: [
        {
          id: "slow",
          label: "Slow",
          eta: "~60 min",
          etaDisplay: "~60 min",
          estimatedFeeDisplay: "0.000001",
          satVbDisplay: "2 sat/vB",
        },
        {
          id: "fast",
          label: "Fast",
          eta: "~5 min",
          etaDisplay: "~5 min",
          estimatedFeeDisplay: "0.000004",
          satVbDisplay: "8 sat/vB",
        },
        {
          id: "custom",
          label: "Custom",
          eta: null,
          etaDisplay: "5 sat/vB",
          estimatedFeeDisplay: "0.000003",
          satVbDisplay: null,
        },
      ],
      liveRates: { slow: 2n, medium: 4n, fast: 8n },
      loadingRates: false,
      selectTier: jest.fn(),
      selectedTier: "custom",
      setCustomSatVbyte: jest.fn(),
      setSubtractFeeFromAmount: jest.fn(),
      subtractFeeFromAmount: true,
      validateFee: jest.fn().mockReturnValue(true),
    });
  });

  it("renders fee tiers, custom fee entry, and review action from context state", () => {
    renderScreen(<SendFeeScreen />);

    expect(screen.getByText("Send PRL")).toBeTruthy();
    expect(screen.getByText("Select Fee Tier")).toBeTruthy();
    expect(screen.getByText("Slow")).toBeTruthy();
    expect(screen.getByText("Fast")).toBeTruthy();
    expect(screen.getByText("Custom Fee Rate (sat/vbyte)")).toBeTruthy();
    expect(screen.getByDisplayValue("5")).toBeTruthy();
    expect(
      screen.getByText("Please enter a valid sat/vbyte value (minimum 1)."),
    ).toBeTruthy();
    expect(screen.getByText("Subtract fee from amount")).toBeTruthy();

    const flowState = useSendFlow.mock.results[0]?.value;

    fireEvent.press(screen.getByLabelText("Select Fast fee"));
    fireEvent.changeText(screen.getByDisplayValue("5"), "7");
    fireEvent.press(screen.getByLabelText("Review transaction"));

    expect(flowState.selectTier).toHaveBeenCalledWith("fast");
    expect(flowState.setCustomSatVbyte).toHaveBeenCalledWith("7");
    expect(flowState.validateFee).toHaveBeenCalledTimes(1);
  });
});
