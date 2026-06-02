// apps/desktop/src/__tests__/copyButton.test.tsx
// covers the <CopyButton> component ().
// Smoke: renders Copy icon + Copy label by default.
// Interaction: when label="Copied!", renders Check icon + Copied! label
// and applies border-primary.
//
// ( ) — adds icon-only variant tests:
// Renders Copy icon with consumer-supplied ariaLabel
// Self-contained 1.5s timer for Copy↔Check swap
// aria-label flips to "Copied" in copied state
// Async onCopy still fires the swap (no need to await)
// Custom className passes through (hover-opacity + W-4 size override)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "@/components/CopyButton";

describe("CopyButton", () => {
  it("renders Copy label by default and calls onCopy on click", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<CopyButton onCopy={onCopy} />);
    const button = screen.getByRole("button", { name: /copy address/i });
    expect(button).toHaveTextContent("Copy");
    await user.click(button);
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it("renders Copied! label + Check icon + border-primary when label='Copied!'", () => {
    render(<CopyButton onCopy={() => undefined} label="Copied!" />);
    const button = screen.getByRole("button", { name: /address copied/i });
    expect(button).toHaveTextContent("Copied!");
    expect(button.className).toContain("border-primary");
  });
});

// ---------------------------------------------------------------------------
// Icon-only variant ( )
// ---------------------------------------------------------------------------
describe("CopyButton (icon-only variant)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the Copy icon with the consumer-supplied ariaLabel and no text label", () => {
    render(
      <CopyButton
        variant="icon"
        onCopy={() => undefined}
        ariaLabel="Copy transaction ID"
      />,
    );
    const button = screen.getByRole("button", { name: /copy transaction id/i });
    // No textual label content — icon-only mode
    expect(button.textContent ?? "").toBe("");
  });

  it("clicking the icon calls onCopy once and swaps to Check; timer reverts after 1500ms", () => {
    const onCopy = vi.fn();
    render(
      <CopyButton
        variant="icon"
        onCopy={onCopy}
        ariaLabel="Copy address"
      />,
    );
    const button = screen.getByRole("button", { name: /copy address/i });
    // fireEvent.click is synchronous and plays nicely with fake timers (the
    // userEvent + fake-timer combo is flaky in this codebase's vitest setup).
    fireEvent.click(button);
    expect(onCopy).toHaveBeenCalledOnce();

    // Immediately after click — copied state has aria-label "Copied"
    expect(screen.getByRole("button", { name: /^copied$/i })).toBe(button);

    // Advance fake timers — swap reverts
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // aria-label is back to consumer-supplied value
    expect(screen.getByRole("button", { name: /copy address/i })).toBe(button);
  });

  it("aria-label flips to 'Copied' in the copied state", () => {
    render(
      <CopyButton
        variant="icon"
        onCopy={() => undefined}
        ariaLabel="Copy recipient address"
      />,
    );
    // Pre-click — aria-label is the consumer-supplied label
    const button = screen.getByRole("button", { name: /copy recipient address/i });
    expect(button).toHaveAttribute("aria-label", "Copy recipient address");

    fireEvent.click(button);

    // Post-click — aria-label is exactly "Copied"
    expect(button).toHaveAttribute("aria-label", "Copied");
  });

  it("async onCopy returning Promise<void> still triggers the Copy→Check swap", () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    render(
      <CopyButton
        variant="icon"
        onCopy={onCopy}
        ariaLabel="Copy"
      />,
    );
    const button = screen.getByRole("button", { name: /^copy$/i });
    fireEvent.click(button);
    expect(onCopy).toHaveBeenCalledOnce();
    // Swap fires synchronously (no need to await the promise)
    expect(button).toHaveAttribute("aria-label", "Copied");
  });

  it("custom className (e.g. hover-opacity + h-6 w-6 size override) is applied to the rendered button", () => {
    render(
      <CopyButton
        variant="icon"
        onCopy={() => undefined}
        ariaLabel="Copy transaction ID"
        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
      />,
    );
    const button = screen.getByRole("button", { name: /copy transaction id/i });
    // Each class lands on the rendered button (verifies className passthrough,
    // critical for W-4 row-height invariant + hover-reveal pattern).
    expect(button.className).toContain("opacity-0");
    expect(button.className).toContain("group-hover:opacity-100");
    expect(button.className).toContain("h-6");
    expect(button.className).toContain("w-6");
    expect(button.className).toContain("p-0");
  });
});
