// apps/desktop/src/__tests__/walletListScreen.test.tsx
//
// Task 3 — WalletListScreen contract tests.
// W-11: every wallet seeded via the type-safe `seedWallet` factory — NO `as never`.
// Covers empty state + non-empty rendering + click navigation + cached balance display.

import { describe, test, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletListScreen } from "@/screens/WalletList/WalletListScreen";
import { renderUnderHarness } from "./_harness/TestHarness";
import { seedWallet } from "./_harness/factories"; // W-11

describe("WalletListScreen", () => {
  test("empty state shows locked copy + CTA navigates to /wallet/new", async () => {
    renderUnderHarness({
      routes: [
        { path: "/wallets", element: <WalletListScreen /> },
        { path: "/wallet/new", element: <div data-testid="new-marker" /> },
      ],
      initialEntries: ["/wallets"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "No wallets yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create your first wallet or import an existing one to get started.",
      ),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ New wallet" }));
    expect(await screen.findByTestId("new-marker")).toBeInTheDocument();
  });

  test("renders one card per seeded wallet with cached balance", () => {
    renderUnderHarness({
      routes: [{ path: "/wallets", element: <WalletListScreen /> }],
      initialEntries: ["/wallets"],
      prepopulate: (b) => {
        b.stores.walletList.getState().addWallet(
          seedWallet({
            id: "w1",
            name: "First BTC",
            networkId: "btc-testnet",
            lastKnownBalance: "100000000",
          }),
        );
        b.stores.walletList.getState().addWallet(
          seedWallet({
            id: "w2",
            name: "Second BTC",
            networkId: "btc-testnet",
            lastKnownBalance: "41234",
          }),
        );
      },
    });
    expect(screen.getByText("First BTC")).toBeInTheDocument();
    expect(screen.getByText("Second BTC")).toBeInTheDocument();
    // satoshisToDisplay strips trailing zeros: "100000000" → "1"
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0.00041234")).toBeInTheDocument();
  });

  test("clicking a wallet card navigates to /wallet/:id", async () => {
    renderUnderHarness({
      routes: [
        { path: "/wallets", element: <WalletListScreen /> },
        { path: "/wallet/:id", element: <div data-testid="detail-marker" /> },
      ],
      initialEntries: ["/wallets"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", name: "ClickMe" }));
      },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /ClickMe/ }));
    expect(await screen.findByTestId("detail-marker")).toBeInTheDocument();
  });
});
