// apps/desktop/src/__tests__/keychainUnavailableScreen.test.tsx
//
// Wave 3 — fail-fast UX regression test.
// Locked copy from
// §"Copywriting Contract" — exact string match below.
//
// @testing-library/user-event is not installed in this workspace; we use
// fireEvent.click from RTL which is sufficient for synchronous click
// handlers. The handlers themselves return promises which we await via
// findBy* / waitFor.

import { describe, it, vi, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the Tauri window module BEFORE importing the component.
// The mock surface exposes the close vi.fn() so tests can assert call counts.
const closeMock = vi.fn(async () => {});
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ close: closeMock }),
}));

import { KeychainUnavailableScreen } from "../KeychainUnavailableScreen";

const mockErr = { kind: "NoBackend" };

describe("KeychainUnavailableScreen — ", () => {
  it("renders the locked title 'Pearl Keeper cannot start safely'", () => {
    render(
      <KeychainUnavailableScreen err={mockErr} onRetry={async () => {}} />,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Pearl Keeper cannot start safely",
      }),
    ).toBeInTheDocument();
  });

  it("renders the literal security claim 'We never write secrets to plaintext files.'", () => {
    render(
      <KeychainUnavailableScreen err={mockErr} onRetry={async () => {}} />,
    );
    // Exact string match (no regex, no rephrasing).
    expect(
      screen.getByText("We never write secrets to plaintext files."),
    ).toBeInTheDocument();
  });

  it("renders four distro install command blocks (Ubuntu, Fedora, Arch, KDE)", () => {
    render(
      <KeychainUnavailableScreen err={mockErr} onRetry={async () => {}} />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Ubuntu / Debian" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Fedora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Arch / Manjaro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "KDE Plasma" }),
    ).toBeInTheDocument();
    // Spot-check at least one distro's command body.
    expect(
      screen.getByText(
        /sudo apt install gnome-keyring && gnome-keyring-daemon --start --components=secrets/,
      ),
    ).toBeInTheDocument();
  });

  it("invokes onRetry when [Retry] is clicked", async () => {
    const onRetry = vi.fn(async () => {});
    render(<KeychainUnavailableScreen err={mockErr} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  it("invokes getCurrentWindow().close() when [Quit] is clicked", async () => {
    closeMock.mockClear();
    render(
      <KeychainUnavailableScreen err={mockErr} onRetry={async () => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /quit/i }));
    await waitFor(() => {
      expect(closeMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does NOT import from @prl-wallet/app-adapters or zustand (static-screen invariant)", async () => {
    // Read the source file and verify forbidden imports are absent.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../KeychainUnavailableScreen.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["']@prl-wallet\/app-adapters["']/);
    expect(source).not.toMatch(/from\s+["']zustand["']/);
    expect(source).not.toMatch(/useStore\b/);
    expect(source).not.toMatch(/useAdapters\b/);
  });
});
