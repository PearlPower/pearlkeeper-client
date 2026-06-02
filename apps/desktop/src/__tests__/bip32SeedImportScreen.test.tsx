// apps/desktop/src/__tests__/bip32SeedImportScreen.test.tsx
//
// Task 2 — BIP32SeedImportScreen contract tests.
// Renders under NewWalletProvider so useBip32SeedImportFlow gets ports +
// addressService from the real context. NO flow mock ().

import { describe, test, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BIP32SeedImportScreen } from "@/screens/NewWallet/ImportWallet/BIP32SeedImportScreen";
import { NewWalletProvider } from "@/screens/NewWallet/NewWalletProvider";
import { renderUnderHarness } from "./_harness/TestHarness";

describe("BIP32SeedImportScreen", () => {
  test("renders locked copy + Continue disabled when empty", () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/import/bip32",
          element: (
            <NewWalletProvider>
              <BIP32SeedImportScreen />
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/import/bip32"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Import from BIP32 seed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Hex seed or extended private key (xprv)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("typing enables Continue", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/wallet/import/bip32",
          element: (
            <NewWalletProvider>
              <BIP32SeedImportScreen />
            </NewWalletProvider>
          ),
        },
      ],
      initialEntries: ["/wallet/import/bip32"],
    });
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Hex seed or extended private key (xprv)"),
      "deadbeef",
    );
    expect(screen.getByRole("button", { name: "Continue" })).not.toBeDisabled();
  });
});
