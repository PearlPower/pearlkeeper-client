// apps/desktop/src/__tests__/xpubImportScreen.test.tsx
//
// Task 2 — XpubImportScreen contract tests.
// Renders under NewWalletProvider so useXpubImportFlow gets ports +
// addressService + network from the real context. NO flow mock ().

import { describe, test, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { XpubImportScreen } from "@/screens/NewWallet/ImportWallet/XpubImportScreen";
import { NewWalletProvider } from "@/screens/NewWallet/NewWalletProvider";
import { renderUnderHarness } from "./_harness/TestHarness";

describe("XpubImportScreen", () => {
  test("renders locked copy + Continue disabled when empty", () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/import/xpub",
          element: (
            <NewWalletProvider>
              <XpubImportScreen />
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/import/xpub"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Import as watch-only" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Paste an xpub to track balance and history. You won't be able to send from this wallet.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("xpub")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("typing enables Continue", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/import/xpub",
          element: (
            <NewWalletProvider>
              <XpubImportScreen />
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/import/xpub"],
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("xpub"), "xpub6CUGRUo");
    expect(screen.getByRole("button", { name: "Continue" })).not.toBeDisabled();
  });
});
