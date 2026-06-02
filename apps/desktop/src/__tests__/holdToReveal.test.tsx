// apps/desktop/src/__tests__/holdToReveal.test.tsx
//
// Round-2 regression tests (UAT Test 6, 2026-04-30).
// HoldToReveal is now a shadcn `<Switch>` paired with a `<Label>`. The
// previous role="button" / aria-pressed contract is replaced with the
// switch primitive's role="switch" / aria-checked contract, which is what
// AT users actually expect from a "show / hide" toggle.

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HoldToReveal } from "@/components/HoldToReveal";

describe("HoldToReveal — Switch toggle ( Round-2)", () => {
  test("click reveals: onRevealStart + onReveal fire; aria-checked=true", () => {
    const onRevealStart = vi.fn();
    const onReveal = vi.fn();
    render(
      <HoldToReveal onRevealStart={onRevealStart} onReveal={onReveal}>
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    expect(onRevealStart).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  test("second click hides: onHide fires; aria-checked=false", () => {
    const onHide = vi.fn();
    render(
      <HoldToReveal onHide={onHide}>
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    fireEvent.click(sw); // reveal
    fireEvent.click(sw); // hide
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  test("Space key reveals; second Space hides (handled by Radix Switch)", () => {
    const onReveal = vi.fn();
    const onHide = vi.fn();
    render(
      <HoldToReveal onReveal={onReveal} onHide={onHide}>
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    fireEvent.keyDown(sw, { key: " ", code: "Space" });
    fireEvent.keyUp(sw, { key: " ", code: "Space" });
    expect(onReveal).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(sw, { key: " ", code: "Space" });
    fireEvent.keyUp(sw, { key: " ", code: "Space" });
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  test("Enter key reveals; second Enter hides (custom onKeyDown)", () => {
    const onReveal = vi.fn();
    const onHide = vi.fn();
    render(
      <HoldToReveal onReveal={onReveal} onHide={onHide}>
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    fireEvent.keyDown(sw, { key: "Enter" });
    expect(onReveal).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(sw, { key: "Enter" });
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  test("Escape while revealed hides; Escape while hidden is a no-op", () => {
    const onReveal = vi.fn();
    const onHide = vi.fn();
    render(
      <HoldToReveal onReveal={onReveal} onHide={onHide}>
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");

    // Esc while hidden → no-op
    fireEvent.keyDown(sw, { key: "Escape" });
    expect(onHide).not.toHaveBeenCalled();
    expect(onReveal).not.toHaveBeenCalled();

    // Reveal then Esc → hide
    fireEvent.click(sw);
    fireEvent.keyDown(sw, { key: "Escape" });
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  test("disabled blocks the interaction (no callbacks fire)", () => {
    const onRevealStart = vi.fn();
    const onReveal = vi.fn();
    render(
      <HoldToReveal disabled onRevealStart={onRevealStart} onReveal={onReveal}>
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    fireEvent.keyDown(sw, { key: " ", code: "Space" });
    fireEvent.keyDown(sw, { key: "Enter" });
    expect(onRevealStart).not.toHaveBeenCalled();
    expect(onReveal).not.toHaveBeenCalled();
    // Radix Switch reflects HTML5 `disabled` (not aria-disabled) on the underlying button.
    expect(sw).toBeDisabled();
  });

  test("disabled-flip mid-reveal: secret hides + onHide fires once", () => {
    const onReveal = vi.fn();
    const onHide = vi.fn();
    const { rerender } = render(
      <HoldToReveal onReveal={onReveal} onHide={onHide}>
        <span>secret</span>
      </HoldToReveal>,
    );
    fireEvent.click(screen.getByRole("switch")); // reveal
    expect(onReveal).toHaveBeenCalledTimes(1);
    rerender(
      <HoldToReveal disabled onReveal={onReveal} onHide={onHide}>
        <span>secret</span>
      </HoldToReveal>,
    );
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  test("unmount while revealed: no callbacks fire (consumer is gone)", () => {
    const onHide = vi.fn();
    const { unmount } = render(
      <HoldToReveal onHide={onHide}>
        <span>secret</span>
      </HoldToReveal>,
    );
    fireEvent.click(screen.getByRole("switch")); // reveal
    act(() => {
      unmount();
    });
    expect(onHide).not.toHaveBeenCalled();
  });

  test("holdMs prop is accepted but ignored (backward compat)", () => {
    const onReveal = vi.fn();
    render(
      <HoldToReveal holdMs={2500} onReveal={onReveal}>
        <span>secret</span>
      </HoldToReveal>,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  test(" composability: a wrapper can revoke access via disabled", () => {
    // Simulates a wrapper that toggles `disabled` based on a re-PIN
    // / type-to-confirm / window-blur policy. While disabled is true, the
    // toggle never fires onReveal — the wrapper's policy is honored.
    const onReveal = vi.fn();
    const { rerender } = render(
      <HoldToReveal disabled onReveal={onReveal}>
        <span>secret</span>
      </HoldToReveal>,
    );
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.keyDown(screen.getByRole("switch"), { key: " ", code: "Space" });
    expect(onReveal).not.toHaveBeenCalled();

    // Wrapper grants access by setting disabled=false; user can now toggle.
    rerender(
      <HoldToReveal onReveal={onReveal}>
        <span>secret</span>
      </HoldToReveal>,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  test("label flips Show/Hide based on revealed state", () => {
    render(
      <HoldToReveal label="Show seed phrase">
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-label", "Show seed phrase");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-label", "Hide seed phrase");
  });

  // : additive `gate` prop — Pitfall 1 race mitigation.
  // When gate is provided, setRevealed(true) MUST NOT fire until gate() resolves true.
  test(" gate=false: clicking Switch does NOT reveal content and onReveal never fires", async () => {
    const onReveal = vi.fn();
    const gate = vi.fn().mockResolvedValue(false);
    render(
      <HoldToReveal gate={gate} onReveal={onReveal}>
        <span data-testid="secret-content">secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    // Allow async gate() to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // Switch should remain unchecked (not revealed)
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(onReveal).not.toHaveBeenCalled();
    // Content area should still be blurred / hidden (aria-hidden=true)
    expect(screen.getByTestId("hold-to-reveal-content")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test(" gate=true: content reveals after gate promise resolves and onReveal fires", async () => {
    const onReveal = vi.fn();
    const gate = vi.fn().mockResolvedValue(true);
    render(
      <HoldToReveal gate={gate} onReveal={onReveal}>
        <span>secret</span>
      </HoldToReveal>,
    );
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    // Allow async gate() to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});
