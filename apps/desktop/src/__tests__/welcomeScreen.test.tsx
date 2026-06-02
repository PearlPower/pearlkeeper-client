// apps/desktop/src/__tests__/welcomeScreen.test.tsx
//
// Task 4 — WelcomeScreen contract verification.
//
// Smoke render of locked copy + click navigates to /pin/create. No
// @prl-wallet/app-flows mocking ().

import { describe, test, expect, beforeAll } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeScreen } from "@/screens/Welcome/WelcomeScreen";
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

describe("WelcomeScreen", () => {
  test("renders locked copy verbatim", () => {
    renderUnderHarness({
      routes: [{ path: "/", element: <WelcomeScreen /> }],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to PRL" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Securely manage your Taproot wallets across blockchains.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Get started" }),
    ).toBeInTheDocument();
  });

  test("Get started navigates to /pin/create", async () => {
    renderUnderHarness({
      routes: [
        { path: "/", element: <WelcomeScreen /> },
        {
          path: "/pin/create",
          element: <div data-testid="pin-create-marker" />,
        },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(
      await screen.findByTestId("pin-create-marker"),
    ).toBeInTheDocument();
  });
});
