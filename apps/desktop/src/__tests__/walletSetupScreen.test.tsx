// apps/desktop/src/__tests__/walletSetupScreen.test.tsx
//
// Task 1 — WalletSetupScreen contract tests.
// Verifies (combined first step) and the Create-new / Import-existing
// navigation paths. NO mock of @prl-wallet/app-flows ().
//
// -11 (UAT-7, 2026-04-28): "Create new" now writes the
// mnemonic to NewWalletProvider via setMnemonic BEFORE navigating, instead
// of passing it via location.state. The "Create new" test uses a
// CaptureProbe to read the provider's mnemonic field after the click.

import { describe, test, expect } from "vitest";
import { useEffect, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AdaptersProvider } from "@prl-wallet/app-adapters";
import {
  NewWalletProvider,
  useNewWalletContext,
} from "@/screens/NewWallet/NewWalletProvider";
import { WalletSetupScreen } from "@/screens/NewWallet/WalletSetupScreen";
import { renderUnderHarness } from "./_harness/TestHarness";
import { buildTestBundle } from "./_harness/factories";

function PathMarker({ id }: { id: string }) {
  const loc = useLocation();
  return <div data-testid={id}>{loc.pathname}</div>;
}

describe("WalletSetupScreen", () => {
  test("renders locked copy + action cards", () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/new",
          element: (
            <NewWalletProvider>
              <WalletSetupScreen />
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/new"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Create a new wallet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Generate a fresh seed phrase on this device."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Restore from a mnemonic, BIP32 seed, or xpub."),
    ).toBeInTheDocument();
  });

  test("Create new navigates to /wallet/new/seed", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/new",
          element: (
            <NewWalletProvider>
              <WalletSetupScreen />
            </NewWalletProvider>
          ),
        },
        { path: "/wallet/new/seed", element: <PathMarker id="seed-marker" /> },
      ],
      initialEntries: ["/wallet/new"],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Create new/ }));
    const marker = await screen.findByTestId("seed-marker");
    expect(marker).toHaveTextContent("/wallet/new/seed");
  });

  test("Import existing navigates to /wallet/import", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/new",
          element: (
            <NewWalletProvider>
              <WalletSetupScreen />
            </NewWalletProvider>
          ),
        },
        {
          path: "/wallet/import",
          element: <div data-testid="import-marker" />,
        },
      ],
      initialEntries: ["/wallet/new"],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Import existing/ }));
    expect(await screen.findByTestId("import-marker")).toBeInTheDocument();
  });

  test(": clicking 'Create new' writes a 12-word mnemonic to the provider before navigating", async () => {
    // CaptureProbe reads the provider's mnemonic after the click. We host
    // the provider OUTSIDE the route tree (above <Routes>) so the
    // mnemonic written by WalletSetup survives the route change to /seed.
    let capturedMnemonic: string | null = null;
    function CaptureProbe(): ReactNode {
      const { mnemonic } = useNewWalletContext();
      useEffect(() => {
        capturedMnemonic = mnemonic;
      }, [mnemonic]);
      return null;
    }

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
          <MemoryRouter initialEntries={["/wallet/new"]}>
            <NewWalletProvider>
              <CaptureProbe />
              <Routes>
                <Route path="/wallet/new" element={<WalletSetupScreen />} />
                <Route
                  path="/wallet/new/seed"
                  element={<PathMarker id="seed-marker" />}
                />
              </Routes>
            </NewWalletProvider>
          </MemoryRouter>
        </AdaptersProvider>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    const createBtn = await screen.findByRole("button", { name: /Create new/i });
    await user.click(createBtn);

    // After click: navigated to /seed AND provider holds a 12-word mnemonic.
    const marker = await screen.findByTestId("seed-marker");
    expect(marker).toHaveTextContent("/wallet/new/seed");
    expect(capturedMnemonic).not.toBeNull();
    expect(capturedMnemonic!.split(" ")).toHaveLength(12);
  });
});
