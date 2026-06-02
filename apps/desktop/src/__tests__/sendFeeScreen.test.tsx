// apps/desktop/src/__tests__/sendFeeScreen.test.tsx
// TX-02 (Fee step: 4 RadioGroup cards, custom-rate validation,
// live-rates fallback hint).
//
// Covers 4 cases:
// 1. Renders 4 RadioGroupItem cards with locked tier names (Slow / Normal (recommended) / Fast / Custom)
// 2. Selecting a tier flips border-primary 1.5px on the chosen card
// 3. Custom card expands inline Input; rate "0" shows validation error; "8" passes
// 4. networkGate.isOpen=false AND liveRates=null → hint "Live rates unavailable — using defaults."

import { describe, test, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, Navigate } from "react-router-dom";
import { AdaptersProvider } from "@prl-wallet/app-adapters";
import { SendLayout } from "@/screens/Send/SendLayout";
import { SendFeeScreen } from "@/screens/Send/SendFeeScreen";
import { buildTestBundle, seedWallet } from "./_harness/factories";

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
        <MemoryRouter initialEntries={[`/wallet/${walletId}/send/fee`]}>
          <Routes>
            <Route path="/wallet/:id/send" element={<SendLayout />}>
              <Route index element={<Navigate to="address" replace />} />
              <Route
                path="address"
                element={<div data-testid="address-page" />}
              />
              <Route
                path="amount"
                element={<div data-testid="amount-page" />}
              />
              <Route path="fee" element={<SendFeeScreen />} />
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

describe("SendFeeScreen (TX-02)", () => {
  test("1. Renders 4 RadioGroupItem cards with locked tier names", () => {
    renderWithSendWizard({});

    // All 4 UI-SPEC LOCKED tier names must be visible
    expect(screen.getByText("Slow")).toBeInTheDocument();
    expect(screen.getByText("Normal (recommended)")).toBeInTheDocument();
    expect(screen.getByText("Fast")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();

    // Network fee section label
    expect(screen.getByText("Network fee")).toBeInTheDocument();

    // 4 RadioGroupItem inputs (role="radio")
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);

    // Next button
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  test("2. Default tier is Normal (medium) — card has border-primary; selecting Custom also shows border-primary", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    // Default: Normal (medium) is selected — its card has border-primary accent
    const normalLabel = screen.getByText("Normal (recommended)");
    const normalCard = normalLabel.closest("[data-slot='card']");
    expect(normalCard).toHaveClass("border-primary");

    // Slow card does NOT have border-primary by default
    const slowLabel = screen.getByText("Slow");
    const slowCard = slowLabel.closest("[data-slot='card']") as Element;
    expect(slowCard).not.toHaveClass("border-primary");

    // Select Custom tier (verified to trigger onValueChange in jsdom via Radix)
    await user.click(screen.getByRole("radio", { name: /custom/i }));

    // Custom card now has border-primary; Normal card lost it
    await waitFor(() => {
      const customLabel = screen.getByText("Custom");
      const customCard = customLabel.closest("[data-slot='card']");
      expect(customCard).toHaveClass("border-primary");
    });
    expect(normalCard).not.toHaveClass("border-primary");
  });

  test("3. Custom card expands inline Input; '0' shows validation error; '8' passes and Next navigates", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    // Custom input should NOT be visible yet
    expect(screen.queryByLabelText(/Enter sat\/vB:/i)).toBeNull();

    // Click Custom tier
    await user.click(screen.getByRole("radio", { name: /custom/i }));

    // Custom inline input should now appear
    const customInput = screen.getByLabelText(/Enter sat\/vB:/i);
    expect(customInput).toBeInTheDocument();

    // Type "0" — invalid (must be positive whole number)
    await user.clear(customInput);
    await user.type(customInput, "0");
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Validation error should appear
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/positive whole number/i);

    // Should NOT have navigated
    expect(screen.queryByTestId("review-page")).toBeNull();

    // Type "8" — valid
    await user.clear(customInput);
    await user.type(customInput, "8");
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Should navigate to review
    expect(await screen.findByTestId("review-page")).toBeInTheDocument();
  });

  test("5. Custom → Normal: clicking Normal radio after Custom flips selection back (regression: Bug 2)", async () => {
    const user = userEvent.setup();
    renderWithSendWizard({});

    const customRadio = screen.getByRole("radio", { name: /custom/i });
    const normalRadio = screen.getByRole("radio", { name: /normal/i });

    // Click Custom: Custom now selected
    await user.click(customRadio);
    await waitFor(() => {
      expect(customRadio).toHaveAttribute("aria-checked", "true");
    });

    // Click Normal: Normal must take selection, Custom must release it
    await user.click(normalRadio);
    await waitFor(() => {
      expect(normalRadio).toHaveAttribute("aria-checked", "true");
    });
    expect(customRadio).toHaveAttribute("aria-checked", "false");

    // The expanded Custom Input should be gone now
    expect(screen.queryByLabelText(/Enter sat\/vB:/i)).toBeNull();
  });

  test("4. networkGate.isOpen=false AND liveRates=null → fallback hint renders", () => {
    // networkGateOpen: false — gate is closed, liveRates will be null
    // (fee rate fetch fails → liveRates stays null in Provider)
    renderWithSendWizard({ networkGateOpen: false });

    // Fallback hint must be visible
    expect(
      screen.getByText("Live rates unavailable — using defaults."),
    ).toBeInTheDocument();
  });
});
