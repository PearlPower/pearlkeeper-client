// apps/desktop/src/__tests__/seedVerifyScreen.test.tsx
//
// Task 1 — SeedVerifyScreen contract tests.
// Renders against the canonical mnemonic and exercises the locked-copy +
// disabled-CTA contracts. Per "Specific Ideas" + : do NOT
// mock useSeedVerifyFlow. Defer the deeper happy-path test to v1.3.x once
// a deterministic challenge fixture API exists.
//
// -11 (UAT-7, 2026-04-28): mnemonic now sourced from
// NewWalletProvider (not location.state). Tests use a SeedSetter helper
// that calls setMnemonic via useNewWalletContext on mount so the screen
// sees the seeded value instead of redirecting on null. Two new tests
// cover the new Back button (rendered + navigates to /wallet/new/seed).

import { describe, test, expect } from "vitest";
import { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AdaptersProvider } from "@prl-wallet/app-adapters";
import { SeedVerifyScreen } from "@/screens/NewWallet/CreateWallet/SeedVerifyScreen";
import {
  NewWalletProvider,
  useNewWalletContext,
} from "@/screens/NewWallet/NewWalletProvider";
import { renderUnderHarness } from "./_harness/TestHarness";
import { buildTestBundle } from "./_harness/factories";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// SeedSetter — writes a mnemonic to the NewWalletProvider before rendering
// children so the SeedVerifyScreen sees the seeded value on its first
// render (avoids the null-mnemonic redirect that would fire if we deferred
// setMnemonic to a useEffect after mount).
function SeedSetter({
  mnemonic,
  children,
}: {
  mnemonic: string;
  children: ReactNode;
}) {
  const { mnemonic: current, setMnemonic } = useNewWalletContext();
  if (current !== mnemonic) {
    setMnemonic(mnemonic);
    return null;
  }
  return <>{children}</>;
}

describe("SeedVerifyScreen", () => {
  test("renders locked copy", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/new/verify",
          element: (
            <NewWalletProvider>
              <SeedSetter mnemonic={TEST_MNEMONIC}>
                <SeedVerifyScreen />
              </SeedSetter>
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/new/verify"],
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Verify your seed phrase",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tap each word in the order it appears in your seed phrase.",
      ),
    ).toBeInTheDocument();
  });

  test("Continue button disabled until allSelected", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/new/verify",
          element: (
            <NewWalletProvider>
              <SeedSetter mnemonic={TEST_MNEMONIC}>
                <SeedVerifyScreen />
              </SeedSetter>
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/new/verify"],
    });
    expect(
      await screen.findByRole("button", { name: "Continue" }),
    ).toBeDisabled();
  });

  test("renders a Back button with label 'Back'", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/new/verify",
          element: (
            <NewWalletProvider>
              <SeedSetter mnemonic={TEST_MNEMONIC}>
                <SeedVerifyScreen />
              </SeedSetter>
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/new/verify"],
    });
    const back = await screen.findByRole("button", { name: "Back" });
    expect(back).toBeInTheDocument();
  });

  test("click Back navigates to /wallet/new/seed", async () => {
    // Cross-route navigation requires a single provider mounted above
    // <Routes> (W-8). We inline the harness shape here for that reason —
    // see seedPhraseScreen.test.tsx for the same pattern.
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    const bundle = buildTestBundle({ networkGateOpen: true });
    render(
      <QueryClientProvider client={queryClient}>
        <AdaptersProvider value={bundle}>
          <MemoryRouter
            initialEntries={["/wallet/new/seed", "/wallet/new/verify"]}
          >
            <NewWalletProvider>
              <SeedSetter mnemonic={TEST_MNEMONIC}>
                <Routes>
                  <Route
                    path="/wallet/new/verify"
                    element={<SeedVerifyScreen />}
                  />
                  <Route
                    path="/wallet/new/seed"
                    element={<div data-testid="seed-route">seed</div>}
                  />
                </Routes>
              </SeedSetter>
            </NewWalletProvider>
          </MemoryRouter>
        </AdaptersProvider>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    const back = await screen.findByRole("button", { name: "Back" });
    await user.click(back);
    expect(await screen.findByTestId("seed-route")).toBeInTheDocument();
  });
});
