// apps/desktop/src/__tests__/pinCreateScreen.test.tsx
//
// Task 4 — PINCreateScreen contract verification.
//
// Smoke render of locked copy + typing 6 digits navigates to /pin/confirm.
// No @prl-wallet/app-flows mocking ().

import { describe, test, expect, beforeAll } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { PINCreateScreen } from "@/screens/PIN/PINCreateScreen";
import { renderUnderHarness } from "./_harness/TestHarness";

beforeAll(() => {
  if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
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

// Probe component captures location.state at /pin/confirm so we can assert the
// PIN was passed through React Router state (T-20-17 pattern).
function ConfirmProbe() {
  const location = useLocation();
  const pin = (location.state as { pin?: string } | null)?.pin ?? "";
  return <div data-testid="confirm-marker">pin:{pin}</div>;
}

describe("PINCreateScreen", () => {
  test("renders locked copy verbatim", () => {
    renderUnderHarness({
      routes: [{ path: "/pin/create", element: <PINCreateScreen /> }],
      initialEntries: ["/pin/create"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Create your PIN" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This 6-digit PIN unlocks every wallet on this device.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("PINs are stored as a hash, never as plain text."),
    ).toBeInTheDocument();
  });

  test("typing 6 digits navigates to /pin/confirm with state.pin", async () => {
    renderUnderHarness({
      routes: [
        { path: "/pin/create", element: <PINCreateScreen /> },
        { path: "/pin/confirm", element: <ConfirmProbe /> },
      ],
      initialEntries: ["/pin/create"],
    });
    const user = userEvent.setup();
    await user.keyboard("123456");
    const probe = await screen.findByTestId("confirm-marker");
    expect(probe.textContent).toBe("pin:123456");
  });
});
