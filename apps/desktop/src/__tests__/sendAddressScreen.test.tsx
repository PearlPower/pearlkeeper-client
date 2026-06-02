// apps/desktop/src/__tests__/sendAddressScreen.test.tsx
// TX-02 (address form) + TX-05 (no QR scan, BIP21 paste).
//
// Covers 7 cases:
// 1. Smoke: renders locked UI-SPEC copy, no QR-scan UI
// 2. Invalid address shows error (zod refine blocks submit)
// 3. Valid address → Next → navigates to /send/amount
// 4. BIP21 paste with amount: strips prefix, pre-fills amount, shows hint
// 5. Bare paste: verbatim address set, no amount, no hint
// 6. (negative) screen.queryByText(/Scan/) returns null — TX-05
// 7. BIP21 amount ephemeral hint disappears after 3 seconds

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import { AdaptersProvider } from "@prl-wallet/app-adapters";
import { SendLayout } from "@/screens/Send/SendLayout";
import { SendAddressScreen } from "@/screens/Send/SendAddressScreen";
import { buildTestBundle, seedWallet } from "./_harness/factories";

// A valid btc-testnet P2WPKH (bech32) address — verified with address.toOutputScript
// (P2WPKH doesn't require ECC, so it works in jsdom without initEccLib)
const VALID_BTC_TESTNET_ADDR = "tb1q42424242424242424242424242424242pz7vyz";

function renderWithSendWizard(opts: {
  walletId?: string;
  networkGateOpen?: boolean;
  networkId?: string;
}) {
  const walletId = opts.walletId ?? "w1";
  const networkId = opts.networkId ?? "btc-testnet";
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const bundle = buildTestBundle({
    networkGateOpen: opts.networkGateOpen ?? true,
  });
  bundle.stores.walletList.getState().addWallet(
    seedWallet({ id: walletId, networkId }),
  );

  render(
    <QueryClientProvider client={qc}>
      <AdaptersProvider value={bundle}>
        <MemoryRouter initialEntries={[`/wallet/${walletId}/send/address`]}>
          <Routes>
            <Route path="/wallet/:id/send" element={<SendLayout />}>
              <Route index element={<Navigate to="address" replace />} />
              <Route path="address" element={<SendAddressScreen />} />
              <Route
                path="amount"
                element={<div data-testid="amount-page" />}
              />
              <Route path="fee" element={<div data-testid="fee-page" />} />
              <Route
                path="review"
                element={<div data-testid="review-page" />}
              />
              <Route
                path="success"
                element={<div data-testid="success-page" />}
              />
            </Route>
            <Route
              path="/wallet/:id"
              element={<div data-testid="wallet-detail" />}
            />
          </Routes>
        </MemoryRouter>
      </AdaptersProvider>
    </QueryClientProvider>,
  );

  return { bundle };
}

describe("SendAddressScreen (TX-02 + TX-05)", () => {
  afterEach(() => {
    // Restore real timers after each test in case a test used fake timers
    vi.useRealTimers();
  });

  test("1. Smoke: renders locked UI-SPEC copy — heading, label, helper, Next; no QR scan UI", () => {
    renderWithSendWizard({});

    // Heading — renders synchronously (no loading gate in the screen)
    expect(
      screen.getByRole("heading", { level: 1, name: /Send Bitcoin/i }),
    ).toBeInTheDocument();

    // Recipient address label
    expect(screen.getByText("Recipient address")).toBeInTheDocument();

    // Input field present
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    // Helper text
    expect(
      screen.getByText(/Paste a Bitcoin address\. BIP21 URIs are supported\./),
    ).toBeInTheDocument();

    // Next button
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();

    // TX-05: No QR-scan UI
    expect(screen.queryByText(/Scan/i)).toBeNull();
  });

  test("2. Invalid address shows zod error and blocks navigation", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    const input = screen.getByRole("textbox");
    await user.type(input, "garbage-address");
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Error should appear
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Should NOT have navigated
    expect(screen.queryByTestId("amount-page")).toBeNull();
  });

  test("3. Valid address → click Next → navigates to /send/amount", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    const input = screen.getByRole("textbox");
    await user.type(input, VALID_BTC_TESTNET_ADDR);
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Should navigate to amount page
    expect(await screen.findByTestId("amount-page")).toBeInTheDocument();
  });

  test("4. BIP21 paste with ?amount= — strips prefix, pre-fills amount, shows hint", async () => {
    renderWithSendWizard({});

    const input = screen.getByRole("textbox");

    // Simulate pasting a BIP21 URI with amount via fireEvent.change (fires onChange handler)
    const bip21Uri = `bitcoin:${VALID_BTC_TESTNET_ADDR}?amount=0.001`;
    fireEvent.change(input, { target: { value: bip21Uri } });

    // Input field should be updated to the bare address (the change handler fires setValue)
    await waitFor(() => {
      expect(input).toHaveValue(VALID_BTC_TESTNET_ADDR);
    });

    // Hint should render (3s timer not fired yet)
    expect(screen.getByText(/Pasted amount:/)).toBeInTheDocument();
    // The hint includes the amount: 0.001 displayed as "0.001 tBTC"
    expect(screen.getByText(/Pasted amount:.*0\.001/)).toBeInTheDocument();
  });

  test("5. Bare address paste — verbatim set, no amount hint", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    const input = screen.getByRole("textbox");
    await user.type(input, VALID_BTC_TESTNET_ADDR);

    // No hint should appear (it's a bare address, not BIP21)
    expect(screen.queryByText(/Pasted amount:/)).toBeNull();
  });

  test("6. TX-05 negative — screen.queryByText(/Scan/) returns null", () => {
    renderWithSendWizard({});

    expect(screen.queryByText(/Scan/)).toBeNull();
    expect(screen.queryByText(/scan/)).toBeNull();
    expect(screen.queryByText(/qr/i)).toBeNull();
    expect(screen.queryByText(/camera/i)).toBeNull();
    expect(screen.queryByText(/webcam/i)).toBeNull();
  });

  test("7. BIP21 amount ephemeral hint auto-dismisses after 3 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    renderWithSendWizard({});

    const input = screen.getByRole("textbox");
    const bip21Uri = `bitcoin:${VALID_BTC_TESTNET_ADDR}?amount=0.001`;

    // Fire change event with BIP21 URI — React updates synchronously inside act()
    act(() => {
      fireEvent.change(input, { target: { value: bip21Uri } });
    });

    // Hint appears synchronously after act()
    expect(screen.getByText(/Pasted amount:/)).toBeInTheDocument();

    // Advance fake timers past the 3-second dismiss threshold
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    // Hint should be gone
    expect(screen.queryByText(/Pasted amount:/)).toBeNull();
  });
});
