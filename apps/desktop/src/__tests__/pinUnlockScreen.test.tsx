// apps/desktop/src/__tests__/pinUnlockScreen.test.tsx
//
// Task 4 — PINUnlockScreen contract verification.
//
// Locks B-3 + W-10 wipe path: with failedAttempts seeded to 9 and the 10th
// wrong PIN typed, services.secrets.deleteAllSecrets MUST fire and the
// hydrated wallet list MUST be removed. Also covers the unlock happy path
// and the "Incorrect PIN. {N} attempts remaining." error copy.
//
// MAX_ATTEMPTS = 10 is locked from packages/app-state/src/lockStore.ts —
// see the screen source (apps/desktop/src/screens/PIN/PINUnlockScreen.tsx)
// for the full rationale on why 10 is the wipe threshold (NOT 5 or 8).
//
// No @prl-wallet/app-flows mocking ().

import { describe, test, expect, vi, beforeAll } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PINUnlockScreen } from "@/screens/PIN/PINUnlockScreen";
import { createPinRecord } from "@/lib/hashPIN";
import { renderUnderHarness } from "./_harness/TestHarness";
import { seedWallet } from "./_harness/factories";

beforeAll(() => {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia !== "function"
  ) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

describe("PINUnlockScreen", () => {
  test("renders locked H1 + body verbatim", () => {
    renderUnderHarness({
      routes: [{ path: "/", element: <PINUnlockScreen /> }],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Enter your PIN" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unlock to continue.")).toBeInTheDocument();
  });

  test("matching PIN calls lockStore.unlock", async () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <PINUnlockScreen /> }],
    });
    // The fake makeFakeSecrets is a stub (storePinHash does nothing),
    // so override getPinHash directly to return the seeded hash.
    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord("123456"),
    );
    // lockStore.isLocked starts true by default.
    expect(bundle.stores.lock.getState().isLocked).toBe(true);

    const user = userEvent.setup();
    await user.keyboard("123456");

    // unlock() flips isLocked → false synchronously after the await flushes.
    await new Promise((r) => setTimeout(r, 0));
    expect(bundle.stores.lock.getState().isLocked).toBe(false);
  });

  test("wrong PIN shows 'Incorrect PIN. 9 attempts remaining.' and increments failedAttempts", async () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <PINUnlockScreen /> }],
    });
    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord("123456"),
    );

    const user = userEvent.setup();
    await user.keyboard("999999");

    expect(
      await screen.findByText(/Incorrect PIN\. 9 attempts remaining\./),
    ).toBeInTheDocument();
    expect(bundle.stores.lock.getState().failedAttempts).toBe(1);
  });

  test("B-3 wipe path: at the 10th failed attempt deleteAllSecrets fires and walletList is cleared (W-10)", async () => {
    const wallet1 = seedWallet({ name: "Alpha" });
    const wallet2 = seedWallet({ name: "Beta" });

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <PINUnlockScreen /> }],
    });
    // Override getPinHash to return the seeded hash (real secrets stub
    // returns null, which would silently match a typed wrong-PIN's
    // null === null comparison — defeating the test).
    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord("123456"),
    );
    // Seed 2 wallets so deleteAllSecrets has something to walk.
    bundle.stores.walletList.getState().addWallet(wallet1);
    bundle.stores.walletList.getState().addWallet(wallet2);
    // Seed failedAttempts directly via setState — using recordFailedAttempt
    // would also set lockUntil at >= 5 attempts, which makes the screen
    // early-return on isLockedOut and never reach the wipe branch.
    bundle.stores.lock.setState({ failedAttempts: 9, lockUntil: null });

    expect(bundle.stores.lock.getState().failedAttempts).toBe(9);
    expect(bundle.stores.walletList.getState().wallets.length).toBe(2);

    // deleteAllSecrets is a top-level export from @prl-wallet/services that
    // walks the hydrated wallet list and calls services.secrets.deleteWalletSecrets
    // (per-wallet) plus services.secrets.deletePinHash (global). Observe its
    // execution via these per-wallet spies — works without module-level mocking.
    const deleteWalletSpy = vi.spyOn(
      bundle.services.secrets,
      "deleteWalletSecrets",
    );
    const deletePinSpy = vi.spyOn(bundle.services.secrets, "deletePinHash");

    const user = userEvent.setup();
    await user.keyboard("999999");

    // Allow the async wipe path (await deleteAllSecrets + state mutations).
    await new Promise((r) => setTimeout(r, 0));

    // 2 wallets → 2 per-wallet deletes; 1 global PIN-hash delete.
    expect(deleteWalletSpy).toHaveBeenCalledTimes(2);
    expect(deletePinSpy).toHaveBeenCalledTimes(1);
    expect(bundle.stores.walletList.getState().wallets).toHaveLength(0);
    expect(bundle.stores.walletList.getState().activeWalletId).toBeNull();
    expect(bundle.stores.lock.getState().lockUntil).toBeNull();
  });
});
