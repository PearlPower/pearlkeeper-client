// apps/desktop/src/screens/WalletDetail/components/__tests__/dangerZone.test.tsx
//
// Task 3 — DangerZone contract tests.
// W-11: every wallet seeded via the type-safe `seedWallet` factory — NO `as never`.
// Threat T-20-44: type-name confirm is case-sensitive — verified explicitly.
// Pitfall 4: onOpenChange resets confirmText on close.
//
// sonner is mocked at module level so we can assert toast invocation. The
// `toast` function is also assigned an `error` method (matching the real
// sonner API) so DangerZone's `toast.error(...)` path resolves at runtime
// even though we don't exercise it in this file.

import { describe, test, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DangerZone } from "@/screens/WalletDetail/components/DangerZone";
import { renderUnderHarness } from "@/__tests__/_harness/TestHarness";
import { seedWallet } from "@/__tests__/_harness/factories"; // W-11

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  Toaster: () => null,
}));
import { toast } from "sonner";

describe("DangerZone", () => {
  test("renders heading + body + Delete wallet trigger", () => {
    renderUnderHarness({
      routes: [
        {
          path: "/",
          element: <DangerZone walletId="w1" walletName="MyBTC" />,
        },
      ],
    });
    expect(
      screen.getByRole("heading", { name: /Danger zone/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Permanently delete this wallet and wipe its OS keychain entries.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete wallet" }),
    ).toBeInTheDocument();
  });

  test("opening dialog: Delete forever is initially disabled", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/",
          element: <DangerZone walletId="w1" walletName="MyBTC" />,
        },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete wallet" }));
    expect(
      await screen.findByRole("button", { name: "Delete forever" }),
    ).toBeDisabled();
  });

  test("type partial name: Delete forever stays disabled", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/",
          element: <DangerZone walletId="w1" walletName="MyBTC" />,
        },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete wallet" }));
    await user.type(
      screen.getByLabelText("Type the wallet name to confirm:"),
      "MyBT",
    );
    expect(
      screen.getByRole("button", { name: "Delete forever" }),
    ).toBeDisabled();
  });

  test("T-20-44: case mismatch keeps Delete forever disabled", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/",
          element: <DangerZone walletId="w1" walletName="MyBTC" />,
        },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete wallet" }));
    await user.type(
      screen.getByLabelText("Type the wallet name to confirm:"),
      "mybtc",
    );
    expect(
      screen.getByRole("button", { name: "Delete forever" }),
    ).toBeDisabled();
  });

  test("exact match enables Delete forever; click fires deleteWalletSecrets + toast + nav", async () => {
    vi.mocked(toast).mockClear();
    const { bundle } = renderUnderHarness({
      routes: [
        {
          path: "/",
          element: <DangerZone walletId="w1" walletName="MyBTC" />,
        },
        { path: "/wallets", element: <div data-testid="list-marker" /> },
      ],
      prepopulate: (b) => {
        b.stores.walletList.getState().addWallet(
          seedWallet({
            id: "w1",
            name: "MyBTC",
            networkId: "btc-testnet",
          }),
        );
      },
    });
    const deleteSpy = vi.spyOn(bundle.services.secrets, "deleteWalletSecrets");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete wallet" }));
    await user.type(
      screen.getByLabelText("Type the wallet name to confirm:"),
      "MyBTC",
    );
    const confirmBtn = screen.getByRole("button", { name: "Delete forever" });
    expect(confirmBtn).not.toBeDisabled();
    await user.click(confirmBtn);
    expect(deleteSpy).toHaveBeenCalledWith("w1");
    expect(toast).toHaveBeenCalledWith("Wallet deleted");
    // Wallet was removed from the store as part of the delete flow.
    expect(bundle.stores.walletList.getState().wallets).toHaveLength(0);
    expect(await screen.findByTestId("list-marker")).toBeInTheDocument();
  });

  test("Cancel resets confirmText on re-open (Pitfall 4)", async () => {
    renderUnderHarness({
      routes: [
        {
          path: "/",
          element: <DangerZone walletId="w1" walletName="MyBTC" />,
        },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete wallet" }));
    await user.type(
      screen.getByLabelText("Type the wallet name to confirm:"),
      "MyB",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    // Re-open
    await user.click(screen.getByRole("button", { name: "Delete wallet" }));
    const input = (await screen.findByLabelText(
      "Type the wallet name to confirm:",
    )) as HTMLInputElement;
    expect(input.value).toBe(""); // reset on close (Pitfall 4)
  });
});
