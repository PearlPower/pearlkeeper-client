// apps/mobile/src/screens/Send/__tests__/SendAddressScreen.bip21.test.tsx
// GREEN flip of the Wave-0 RED stubs ().
//
// Verifies:
// • Pasting a BIP21 URI strips the prefix and pre-fills amount via
// handleAmountTextChange (mobile equivalent of desktop's setAmountSats).
// • Permanent helper caption "Paste an address or BIP21 URI. Amounts
// pre-fill on the next step." is always visible.
// • Ephemeral "Pasted amount: 0.1 BTC." auto-dismisses after 3000ms.
// • Pasting a bare address passes through unchanged (no helper hint).

import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";

// Mock useNavigation to a stable stub so the screen renders without a real stack.
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  };
});

// Mock the SendFlowContext hook with a mutable state held on a `mock`-prefixed
// object so jest's babel-jest hoister allows the closure capture.
const mockSendFlowState = {
  recipientAddress: "",
  setRecipientAddress: jest.fn(),
  handleAmountTextChange: jest.fn(),
};

// analytics flow stub. SendAddressScreen reads
// `analyticsFlow` from useSendFlow() and emits start + step events.
const mockAnalyticsFlow = {
  start: jest.fn(),
  step: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
};

jest.mock("../SendFlowContext", () => ({
  useSendFlow: () => ({
    addressError: null,
    analyticsFlow: mockAnalyticsFlow,
    closeScanner: jest.fn(),
    handleAmountTextChange: mockSendFlowState.handleAmountTextChange,
    handleQRScanned: jest.fn(),
    isWatchOnly: false,
    openScanner: jest.fn(),
    recipientAddress: mockSendFlowState.recipientAddress,
    scannerVisible: false,
    scanned: false,
    screenTitle: "Send Bitcoin",
    setRecipientAddress: mockSendFlowState.setRecipientAddress,
    validateAddress: jest.fn(() => true),
    walletId: "wallet-1",
  }),
}));

// Mock the wallet store so wallet lookup returns btc-mainnet for `wallet-1`.
jest.mock("../../../store/walletListStore", () => ({
  useWalletListStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({
      wallets: [
        { id: "wallet-1", networkId: "btc-mainnet", name: "Test" },
      ],
    }),
  ),
}));

// Mock the camera modal — it's irrelevant to the BIP21 paste flow and
// instantiating it pulls expo-camera at import time.
jest.mock("../components/SendScannerModal", () => ({
  SendScannerModal: () => null,
}));

import SendAddressScreen from "../SendAddressScreen";

beforeEach(() => {
  jest.clearAllMocks();
  mockSendFlowState.recipientAddress = "";
});

function renderScreen() {
  return render(
    <SafeAreaProvider>
      <NavigationContainer>
        <SendAddressScreen />
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

describe("SendAddressScreen BIP21 paste ()", () => {
  it("pasting 'bitcoin:bc1q...?amount=0.1' strips prefix, fills address, stores amount in SendFlowContext", () => {
    renderScreen();
    const input = screen.getByPlaceholderText("Enter recipient address");
    fireEvent.changeText(input, "bitcoin:bc1qexample?amount=0.1");
    expect(mockSendFlowState.setRecipientAddress).toHaveBeenCalledWith("bc1qexample");
    expect(mockSendFlowState.handleAmountTextChange).toHaveBeenCalledWith("0.1");
  });

  it("pasting bare address passes through unmodified (no amount handler call)", () => {
    renderScreen();
    const input = screen.getByPlaceholderText("Enter recipient address");
    fireEvent.changeText(input, "bc1qbare");
    expect(mockSendFlowState.setRecipientAddress).toHaveBeenCalledWith("bc1qbare");
    expect(mockSendFlowState.handleAmountTextChange).not.toHaveBeenCalled();
  });

  it("permanent helper caption 'Paste an address or BIP21 URI. Amounts pre-fill on the next step.' is always visible", () => {
    renderScreen();
    expect(
      screen.getByText(
        "Paste an address or BIP21 URI. Amounts pre-fill on the next step.",
      ),
    ).toBeTruthy();
  });

  it("ephemeral 'Pasted amount: 0.1 BTC.' hint auto-dismisses after 3000ms (jest fake timers)", () => {
    jest.useFakeTimers();
    try {
      renderScreen();
      const input = screen.getByPlaceholderText("Enter recipient address");
      act(() => {
        fireEvent.changeText(input, "bitcoin:bc1qx?amount=0.1");
      });
      expect(screen.getByText("Pasted amount: 0.1 BTC.")).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(3001);
      });
      expect(screen.queryByText("Pasted amount: 0.1 BTC.")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("scaffold loads (sanity)", () => {
    expect(true).toBe(true);
  });
});
