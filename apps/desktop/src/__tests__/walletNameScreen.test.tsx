// apps/desktop/src/__tests__/walletNameScreen.test.tsx
//
// Task 2 — WalletNameScreen contract tests.
// Covers BOTH branches (create + import) — branch detection is via
// location.pathname per 's branch-detection pattern.

import { describe, test, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletNameScreen } from "@/screens/NewWallet/WalletNameScreen";
import { renderUnderHarness } from "./_harness/TestHarness";

const STATE = {
  walletId: "w1",
  address: "tb1q0000000000000000000000000000000000000",
  walletType: "mnemonic" as const,
};

describe("WalletNameScreen", () => {
  test("renders locked copy", () => {
    renderUnderHarness({
      routes: [{ path: "/wallet/new/name", element: <WalletNameScreen /> }],
      initialEntries: [
        { pathname: "/wallet/new/name", state: STATE },
      ] as never,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Name your wallet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pick a name you'll recognize. This is just a label."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Wallet name")).toBeInTheDocument();
  });

  test("create branch routes to /wallet/new/done", async () => {
    renderUnderHarness({
      routes: [
        { path: "/wallet/new/name", element: <WalletNameScreen /> },
        { path: "/wallet/new/done", element: <div data-testid="create-done" /> },
        {
          path: "/wallet/import/done",
          element: <div data-testid="import-done" />,
        },
      ],
      initialEntries: [
        { pathname: "/wallet/new/name", state: STATE },
      ] as never,
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Wallet name"), "My new BTC");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByTestId("create-done")).toBeInTheDocument();
  });

  test("import branch routes to /wallet/import/done", async () => {
    renderUnderHarness({
      routes: [
        { path: "/wallet/import/name", element: <WalletNameScreen /> },
        { path: "/wallet/new/done", element: <div data-testid="create-done" /> },
        {
          path: "/wallet/import/done",
          element: <div data-testid="import-done" />,
        },
      ],
      initialEntries: [
        { pathname: "/wallet/import/name", state: STATE },
      ] as never,
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Wallet name"), "Imported xpub");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByTestId("import-done")).toBeInTheDocument();
  });

  test("missing state redirects to /wallet/new", async () => {
    renderUnderHarness({
      routes: [
        { path: "/wallet/new/name", element: <WalletNameScreen /> },
        { path: "/wallet/new", element: <div data-testid="setup" /> },
      ],
      initialEntries: ["/wallet/new/name"], // no state
    });
    expect(await screen.findByTestId("setup")).toBeInTheDocument();
  });
});
