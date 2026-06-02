// apps/desktop/src/__tests__/changePinScreen.test.tsx
//
// Task 4 — ChangePINScreen 3-step wizard contract.
//
// Locks : verify → enter-new → confirm-new. Verifies that
// services.secrets.storePinHash receives an Argon2id record that verifies
// for the new PIN on the success path, that mismatch on confirm-new resets
// to enter-new with locked copy, and that wrong current PIN at the verify
// step shows "That's not your current PIN."
//
// S-CRITICAL-1 — salted hashing means we can't compare bytes anymore; the
// success-path test checks the CONTRACT (storePinHash called with a record
// that verifies for the new PIN) rather than exact-value match.
//
// No @prl-wallet/app-flows mocking ().

import { describe, test, expect, vi, beforeAll } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "@/components/ui/sonner";
import { ChangePINScreen } from "@/screens/PIN/ChangePINScreen";
import { createPinRecord, verifyPin } from "@/lib/hashPIN";
import { renderUnderHarness } from "./_harness/TestHarness";

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

describe("ChangePINScreen", () => {
  test("step 1 shows 'Enter your current PIN'", () => {
    renderUnderHarness({
      routes: [{ path: "/settings/change-pin", element: <ChangePINScreen /> }],
      initialEntries: ["/settings/change-pin"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Enter your current PIN" }),
    ).toBeInTheDocument();
  });

  test("wrong current PIN shows 'That's not your current PIN.'", async () => {
    renderUnderHarness({
      routes: [{ path: "/settings/change-pin", element: <ChangePINScreen /> }],
      initialEntries: ["/settings/change-pin"],
      prepopulate: async (b) => {
        await b.services.secrets.storePinHash(await createPinRecord("123456"));
      },
    });
    const user = userEvent.setup();
    await user.keyboard("999999");
    expect(
      await screen.findByText("That's not your current PIN."),
    ).toBeInTheDocument();
    // Step did not advance.
    expect(
      screen.getByRole("heading", { level: 1, name: "Enter your current PIN" }),
    ).toBeInTheDocument();
  });

  test("confirm-new mismatch shows 'PINs do not match. Start over.' and resets to enter-new", async () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/settings/change-pin", element: <ChangePINScreen /> }],
      initialEntries: ["/settings/change-pin"],
    });
    // makeFakeSecrets is a stub (storePinHash is a no-op, getPinHash returns null);
    // override getPinHash to advance the verify step.
    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord("123456"),
    );
    const user = userEvent.setup();
    // Step 1: verify
    await user.keyboard("123456");
    // Step 2: enter-new
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Enter your new PIN",
      }),
    ).toBeInTheDocument();
    await user.keyboard("222222");
    // Step 3: confirm-new (mismatch)
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Confirm your new PIN",
      }),
    ).toBeInTheDocument();
    await user.keyboard("333333");

    expect(
      await screen.findByText("PINs do not match. Start over."),
    ).toBeInTheDocument();
    // Reset to enter-new
    expect(
      screen.getByRole("heading", { level: 1, name: "Enter your new PIN" }),
    ).toBeInTheDocument();
  });

  test("success path persists an Argon2id record for newPin and navigates to /settings", async () => {
    const { bundle } = renderUnderHarness({
      routes: [
        {
          path: "/settings/change-pin",
          element: (
            <>
              <ChangePINScreen />
              <Toaster />
            </>
          ),
        },
        {
          path: "/settings",
          element: <div data-testid="settings-marker" />,
        },
      ],
      initialEntries: ["/settings/change-pin"],
    });
    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord("123456"),
    );
    const storeSpy = vi.spyOn(bundle.services.secrets, "storePinHash");

    const user = userEvent.setup();
    await user.keyboard("123456"); // verify
    await user.keyboard("999999"); // enter-new
    await user.keyboard("999999"); // confirm-new (match)

    expect(await screen.findByTestId("settings-marker")).toBeInTheDocument();
    // S-CRITICAL-1: stored record carries a random salt — verify by contract
    expect(storeSpy).toHaveBeenCalledTimes(1);
    const storedRecord = storeSpy.mock.calls[0][0];
    expect(storedRecord).toMatch(/^argon2id-v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPin("999999", storedRecord)).toBe(true);
    expect(await verifyPin("123456", storedRecord)).toBe(false);
  });
});
