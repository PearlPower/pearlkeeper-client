// apps/desktop/src/__tests__/themeProvider.test.tsx
//
// Task 2 — ThemeProvider smoke test ( / ).
//
// Validates the integration shape that main.tsx mounts: <ThemeProvider
// attribute="class" defaultTheme="system" enableSystem> writes a
// `light` or `dark` class onto <html> on first paint, and useTheme()'s
// setTheme() flips the class accordingly. next-themes itself is well-
// tested upstream — these tests assert the contract our boot code relies
// on, not the library internals.
//
// jsdom does not reliably simulate prefers-color-scheme media-query
// change events; that case is in Manual UAT per VALIDATION.md.

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "next-themes";

function ThemeProbe({ next }: { next: "light" | "dark" | "system" }) {
  const { setTheme } = useTheme();
  return (
    <button data-testid="probe" onClick={() => setTheme(next)}>
      flip
    </button>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    // Reset <html> classes between tests so prior theme writes don't leak.
    document.documentElement.classList.remove("light", "dark");
  });

  it("mounts cleanly and adds light/dark class to <html> on first paint", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div data-testid="child">x</div>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    const cls = document.documentElement.classList;
    expect(cls.contains("light") || cls.contains("dark")).toBe(true);
  });

  it("setTheme('dark') writes .dark class on <html>", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeProbe next="dark" />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByTestId("probe").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme('light') removes .dark and writes .light", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeProbe next="light" />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByTestId("probe").click();
    });
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
