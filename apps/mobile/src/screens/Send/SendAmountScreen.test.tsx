// apps/mobile/src/screens/Send/SendAmountScreen.test.tsx
// Wave-3 fiat sublabel UI tests for , , .
//
// Coverage:
// 1. Renders fiat sublabel `≈ $X.XX USD` when priceUsd != null ().
// 2. Renders `≈ —` when priceUsd == null ( em-dash unavailable token).
// 3. Renders `(stale)` suffix when priceIsStale = true ().
//
// The mobile send wizard's amount step pairs the native PRL/BTC amount
// with a fiat annotation (per FEE-PRICE-04). The annotation is purely
// advisory (FEE-PRICE-05) — the actual send still uses the native unit.

import { screen } from "@testing-library/react-native";
import SendAmountScreen from "./SendAmountScreen";
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

// 1 BTC = 100_000_000 sats. With a price of $65,432 / BTC the fiat value
// is $65,432.00 — used in the live + stale tests.
const ONE_BTC_SATS = 100_000_000n;
const BTC_USD = 65432;

// analytics flow stub.
const mockAnalyticsFlow = {
  start: jest.fn(),
  step: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
};

function baseFlowState(overrides: Record<string, unknown> = {}) {
  return {
    amountError: null,
    amountSats: ONE_BTC_SATS,
    amountText: "1.0",
    analyticsFlow: mockAnalyticsFlow,
    handleAmountTextChange: jest.fn(),
    handleSliderChange: jest.fn(),
    isBalanceLoading: false,
    sliderPercent: 100,
    spendableDisplay: "1.0",
    validateAmount: jest.fn().mockReturnValue(true),
    // defaults: fully unavailable. Tests opt in to
    // live / stale states by overriding.
    priceUsd: null,
    priceIsStale: false,
    priceIsUnavailable: true,
    feeIsStale: false,
    feeIsUnavailable: true,
    ...overrides,
  };
}

describe("SendAmountScreen — fiat sublabel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders fiat sublabel ≈ $X.XX USD when priceUsd is set", () => {
    useSendFlow.mockReturnValue(
      baseFlowState({
        priceUsd: BTC_USD,
        priceIsStale: false,
        priceIsUnavailable: false,
      }),
    );

    renderScreen(<SendAmountScreen />);

    // Locked format: "≈ $65,432.00 USD" (Intl.NumberFormat en-US,
    // currency: USD, maximumFractionDigits: 2).
    expect(screen.getByText(/≈ \$65,432\.00 USD/)).toBeTruthy();
  });

  it("renders `≈ —` when priceUsd is null ( em-dash unavailable token)", () => {
    useSendFlow.mockReturnValue(
      baseFlowState({
        priceUsd: null,
        priceIsStale: false,
        priceIsUnavailable: true,
      }),
    );

    renderScreen(<SendAmountScreen />);

    // Em-dash is U+2014. The locked unavailable token is "≈ —".
    expect(screen.getByText("≈ —")).toBeTruthy();
  });

  it("renders `(stale)` suffix when priceIsStale=true", () => {
    useSendFlow.mockReturnValue(
      baseFlowState({
        priceUsd: BTC_USD,
        priceIsStale: true,
        priceIsUnavailable: false,
      }),
    );

    renderScreen(<SendAmountScreen />);

    // Mobile stale variant per : opacity
    // 0.7 + (stale) suffix appended to the formatted fiat string.
    expect(screen.getByText(/≈ \$65,432\.00 USD \(stale\)/)).toBeTruthy();
  });
});
