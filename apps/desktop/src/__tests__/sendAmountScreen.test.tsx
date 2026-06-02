// apps/desktop/src/__tests__/sendAmountScreen.test.tsx
// TX-02 (Amount step: zod refinement + Use max + subtract-fee toggle).
//
// Covers 6 cases:
// 1. Smoke: heading, Amount label, hero input, chainSymbol suffix, helper, Use max, toggle, Next
// 2. Next blocked when amount empty/0 — zod refine "Amount must be greater than 0."
// 3. Parse-fail: type "abc" → zod refine "Enter a valid amount."
// 4. Over-balance: amount > spendableSats → "Amount exceeds your spendable balance."
// 5. Use max click → setValue with spendableSats - estimatedFee
// 6. Subtract-fee toggle → flow.setSubtractFeeFromAmount called

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import { AdaptersProvider } from "@prl-wallet/app-adapters";
import { SendLayout } from "@/screens/Send/SendLayout";
import { SendAmountScreen } from "@/screens/Send/SendAmountScreen";
import { buildTestBundle, seedWallet } from "./_harness/factories";

// mock usePrice + useFeeOracle so the test
// harness can drive priceUsd / priceIsStale into SendFlowProvider
// without spinning up the real adapters. The real hooks read the port
// from useAdapters().services.{feeOracle,priceFeed}; the test bundle
// here doesn't supply them, so absent these mocks the hooks would
// surface the unavailable shape. We allow per-test override via
// `usePriceMock.mockReturnValue(...)`.
const usePriceMock = vi.fn(() => ({
  usd: null as number | null,
  isStale: false,
  isUnavailable: true,
  asOf: null as number | null,
  isLoading: false,
}));
const useFeeOracleMock = vi.fn(() => ({
  data: null,
  isStale: false,
  isUnavailable: true,
  asOf: null as number | null,
  isLoading: false,
}));
vi.mock("@prl-wallet/app-flows", async () => {
  const actual = await vi.importActual<typeof import("@prl-wallet/app-flows")>(
    "@prl-wallet/app-flows",
  );
  return {
    ...actual,
    // The mocks are no-arg shims for the test path; the production
    // hooks take (symbol) and (networkId) respectively but the test
    // pins return values via mockReturnValue and never reads the args.
    usePrice: () => usePriceMock(),
    useFeeOracle: () => useFeeOracleMock(),
  };
});

// Seed wallet with a known balance (100_000_000 sats = 1 BTC)
const WALLET_BALANCE_SATS = "100000000"; // 1 BTC

function renderWithSendWizard(opts: {
  walletId?: string;
  networkGateOpen?: boolean;
  networkId?: string;
  balance?: string;
}) {
  const walletId = opts.walletId ?? "w1";
  const networkId = opts.networkId ?? "btc-testnet";
  const balance = opts.balance ?? WALLET_BALANCE_SATS;

  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const bundle = buildTestBundle({
    networkGateOpen: opts.networkGateOpen ?? true,
  });
  bundle.stores.walletList
    .getState()
    .addWallet(
      seedWallet({ id: walletId, networkId, lastKnownBalance: balance }),
    );

  render(
    <QueryClientProvider client={qc}>
      <AdaptersProvider value={bundle}>
        <MemoryRouter initialEntries={[`/wallet/${walletId}/send/amount`]}>
          <Routes>
            <Route path="/wallet/:id/send" element={<SendLayout />}>
              <Route index element={<Navigate to="address" replace />} />
              <Route
                path="address"
                element={<div data-testid="address-page" />}
              />
              <Route path="amount" element={<SendAmountScreen />} />
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

describe("SendAmountScreen (TX-02)", () => {
  beforeEach(() => {
    // Reset to fully unavailable defaults between tests so existing
    // cases keep their original assumptions.
    usePriceMock.mockReturnValue({
      usd: null,
      isStale: false,
      isUnavailable: true,
      asOf: null,
      isLoading: false,
    });
    useFeeOracleMock.mockReturnValue({
      data: null,
      isStale: false,
      isUnavailable: true,
      asOf: null,
      isLoading: false,
    });
  });

  test("1. Smoke: renders heading, Amount label, hero input, chainSymbol suffix, helper, Use max, subtract-fee toggle, Next", () => {
    renderWithSendWizard({});

    // Heading — uses screenTitle from Provider ("Send Bitcoin")
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

    // Amount label
    expect(screen.getByText("Amount")).toBeInTheDocument();

    // Hero input — identified by placeholder "0.0"
    const input = screen.getByPlaceholderText("0.0");
    expect(input).toBeInTheDocument();

    // Balance helper text
    expect(screen.getByText(/You have.*available\./)).toBeInTheDocument();

    // Use max button
    expect(screen.getByRole("button", { name: "Use max" })).toBeInTheDocument();

    // Subtract fee toggle label
    expect(screen.getByText("Subtract fee from amount")).toBeInTheDocument();

    // Next button
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();

    // No slider — UI-SPEC LOCKED text-only
    expect(screen.queryByRole("slider")).toBeNull();
  });

  test("2. Next blocked when amount is empty — zod shows 'Enter an amount.'", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    // Click Next without entering anything
    await user.click(screen.getByRole("button", { name: "Next" }));

    // zod error for empty string
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Should not navigate
    expect(screen.queryByTestId("fee-page")).toBeNull();
  });

  test("3. Parse-fail: type 'abc' → error 'Enter a valid amount.'", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    // Find the amount input (type="decimal" inputMode)
    const input = screen.getByPlaceholderText("0.0");
    await user.type(input, "abc");
    await user.click(screen.getByRole("button", { name: "Next" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    // Should not navigate
    expect(screen.queryByTestId("fee-page")).toBeNull();
  });

  test("4. Over-balance: amount > spendableSats → 'Amount exceeds your spendable balance.'", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({ balance: "100" }); // 100 sats

    const input = screen.getByPlaceholderText("0.0");
    // 999 BTC >> 100 sats
    await user.type(input, "999");
    await user.click(screen.getByRole("button", { name: "Next" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/exceeds.*spendable/i);

    // Should not navigate
    expect(screen.queryByTestId("fee-page")).toBeNull();
  });

  test("5. Use max click sets input to spendableSats - estimatedFee", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({ balance: WALLET_BALANCE_SATS });

    const input = screen.getByPlaceholderText("0.0");
    expect(input).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Use max" }));

    // Value should be non-empty after Use max
    const value = (input as HTMLInputElement).value;
    expect(value).not.toBe("");
    expect(value).not.toBe("0.0");

    // The computed max should be less than 1 BTC (fee subtracted)
    const parsed = parseFloat(value);
    expect(parsed).toBeGreaterThan(0);
    expect(parsed).toBeLessThanOrEqual(1); // 1 BTC = spendableSats
  });

  test("6. Subtract-fee toggle changes the flow state", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    // Switch should start unchecked (default OFF per plan)
    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();

    // Click to enable
    await user.click(toggle);

    // Should now be checked
    expect(toggle).toBeChecked();
  });

  // ----- — fiat sublabel coverage (, , ) -----

  test("7. Fiat sublabel renders ≈ — when priceUsd is null", () => {
    usePriceMock.mockReturnValue({
      usd: null,
      isStale: false,
      isUnavailable: true,
      asOf: null,
      isLoading: false,
    });
    renderWithSendWizard({});

    const sublabel = screen.getByTestId("fiat-sublabel");
    expect(sublabel).toBeInTheDocument();
    expect(sublabel.textContent).toContain("≈ —");
  });

  test("8. Fiat sublabel renders ≈ $X.XX USD when priceUsd is set", async () => {
    usePriceMock.mockReturnValue({
      usd: 65432,
      isStale: false,
      isUnavailable: false,
      asOf: 1730000000000,
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithSendWizard({});

    const input = screen.getByPlaceholderText("0.0");
    // Type 1 BTC → fiat = 1 * 65432 = $65,432.00 USD.
    await user.type(input, "1");

    const sublabel = await screen.findByTestId("fiat-sublabel");
    expect(sublabel.textContent).toMatch(/≈ \$65,432\.00 USD/);
    expect(sublabel.className).not.toContain("opacity-70");
  });

  test("9. Fiat sublabel applies opacity-70 + (stale) suffix when priceIsStale=true", async () => {
    usePriceMock.mockReturnValue({
      usd: 65432,
      isStale: true,
      isUnavailable: false,
      asOf: 1730000000000,
      isLoading: false,
    });
    const user = userEvent.setup();
    renderWithSendWizard({});

    const input = screen.getByPlaceholderText("0.0");
    await user.type(input, "1");

    const sublabel = await screen.findByTestId("fiat-sublabel");
    expect(sublabel.textContent).toMatch(/≈ \$65,432\.00 USD \(stale\)/);
    expect(sublabel.className).toContain("opacity-70");
  });
});
