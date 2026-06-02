// apps/desktop/src/__tests__/importTypePickerScreen.test.tsx
//
// Task 2 — ImportTypePickerScreen contract tests.
// Smoke + 3-card click navigation via test.each ().

import { describe, test, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportTypePickerScreen } from "@/screens/NewWallet/ImportWallet/ImportTypePickerScreen";
import { renderUnderHarness } from "./_harness/TestHarness";

describe("ImportTypePickerScreen", () => {
  test("renders 3 import options with locked copy", () => {
    renderUnderHarness({
      routes: [{ path: "/wallet/import", element: <ImportTypePickerScreen /> }],
      initialEntries: ["/wallet/import"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Import a wallet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mnemonic")).toBeInTheDocument();
    expect(screen.getByText("BIP32 seed")).toBeInTheDocument();
    expect(screen.getByText("Watch-only (xpub)")).toBeInTheDocument();
  });

  test.each([
    [/Mnemonic/, "/wallet/import/mnemonic"],
    [/BIP32 seed/, "/wallet/import/bip32"],
    [/Watch-only/, "/wallet/import/xpub"],
  ] as const)("clicking %s navigates to %s", async (label, route) => {
    renderUnderHarness({
      routes: [
        { path: "/wallet/import", element: <ImportTypePickerScreen /> },
        { path: route, element: <div data-testid={`marker-${route}`} /> },
      ],
      initialEntries: ["/wallet/import"],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: label }));
    expect(await screen.findByTestId(`marker-${route}`)).toBeInTheDocument();
  });
});
