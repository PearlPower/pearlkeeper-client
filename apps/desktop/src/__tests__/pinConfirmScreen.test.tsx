// apps/desktop/src/__tests__/pinConfirmScreen.test.tsx
//
// Task 4 — PINConfirmScreen contract verification.
//
// Locks T-20-19/T-20-23: confirmation match path calls
// services.secrets.storePinHash with a record that verifies for "123456"
// before navigating to /wallet/new. Mismatch path shows "Those PINs don't
// match. Start over." No @prl-wallet/app-flows mocking ().
//
// S-CRITICAL-1 — storePinHash now receives an Argon2id record with a fresh
// random salt, so we verify the CONTRACT (record verifies for the right
// PIN) rather than exact bytes.

import { describe, test, expect, vi, beforeAll } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PINConfirmScreen } from "@/screens/PIN/PINConfirmScreen";
import { renderUnderHarness } from "./_harness/TestHarness";
import { verifyPin } from "@/lib/hashPIN";

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

describe("PINConfirmScreen", () => {
  test("renders locked copy verbatim", () => {
    renderUnderHarness({
      routes: [{ path: "/pin/confirm", element: <PINConfirmScreen /> }],
      // Pass a PIN in location state so the redirect-on-missing effect doesn't fire.
      initialEntries: [
        { pathname: "/pin/confirm", state: { pin: "123456" } },
      ] as never as string[],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Confirm your PIN" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter the same 6 digits again."),
    ).toBeInTheDocument();
  });

  test("mismatched PIN shows 'Those PINs don't match. Start over.'", async () => {
    renderUnderHarness({
      routes: [{ path: "/pin/confirm", element: <PINConfirmScreen /> }],
      initialEntries: [
        { pathname: "/pin/confirm", state: { pin: "123456" } },
      ] as never as string[],
    });
    const user = userEvent.setup();
    await user.keyboard("999999");
    expect(
      await screen.findByText("Those PINs don't match. Start over."),
    ).toBeInTheDocument();
  });

  test("matching PIN calls storePinHash with a record that verifies for '123456' and navigates", async () => {
    const { bundle } = renderUnderHarness({
      routes: [
        { path: "/pin/confirm", element: <PINConfirmScreen /> },
        {
          path: "/wallet/new",
          element: <div data-testid="new-wallet-marker" />,
        },
      ],
      initialEntries: [
        { pathname: "/pin/confirm", state: { pin: "123456" } },
      ] as never as string[],
    });
    const storeSpy = vi.spyOn(bundle.services.secrets, "storePinHash");

    const user = userEvent.setup();
    await user.keyboard("123456");

    expect(await screen.findByTestId("new-wallet-marker")).toBeInTheDocument();
    expect(storeSpy).toHaveBeenCalledTimes(1);
    const storedRecord = storeSpy.mock.calls[0][0];
    // S-CRITICAL-1: salted hashing means we can't compare bytes — verify the
    // contract (record shape + verifies for the right PIN).
    expect(storedRecord).toMatch(/^argon2id-v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPin("123456", storedRecord)).toBe(true);
    expect(await verifyPin("000000", storedRecord)).toBe(false);
    expect(bundle.stores.pin.getState().hasPIN).toBe(true);
  });
});
