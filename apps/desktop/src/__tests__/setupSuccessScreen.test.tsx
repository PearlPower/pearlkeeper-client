// apps/desktop/src/__tests__/setupSuccessScreen.test.tsx
//
// Task 2 — SetupSuccessScreen contract tests.
// Covers BOTH branches (create vs import) and the locked H1 strings.

import { describe, test, expect } from "vitest";
import { screen } from "@testing-library/react";
import { SetupSuccessScreen } from "@/screens/NewWallet/SetupSuccessScreen";
import { NewWalletProvider } from "@/screens/NewWallet/NewWalletProvider";
import { renderUnderHarness } from "./_harness/TestHarness";

const STATE = {
  walletId: "w1",
  walletName: "Test BTC",
  address: "tb1q0000000000000000000000000000000000000",
};

describe("SetupSuccessScreen", () => {
  test("create branch shows 'Wallet created'", () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/new/done",
          element: (
            <NewWalletProvider>
              <SetupSuccessScreen />
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: [
        { pathname: "/wallet/new/done", state: STATE },
      ] as never,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Wallet created" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Test BTC.*is ready/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open wallet" }),
    ).toBeInTheDocument();
  });

  test("import branch shows 'Wallet imported'", () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/import/done",
          element: (
            <NewWalletProvider>
              <SetupSuccessScreen />
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: [
        { pathname: "/wallet/import/done", state: STATE },
      ] as never,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Wallet imported" }),
    ).toBeInTheDocument();
  });
});
