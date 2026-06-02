// apps/desktop/src/__tests__/pinGrid.test.tsx
//
// Task 2 — PINGrid contract verification.
//
// Locks: Pitfall 2 (auto-submit dedup), T-20-05 password-manager suppression,
// shake animation class, autoFocus, disabled-during-lockout. Real PINGrid
// from apps/desktop/src/components/PINGrid.tsx — no harness needed (atom-level).

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PINGrid } from "@/components/PINGrid";

function ControlledPIN({
  onComplete,
  autoFocus = true,
}: {
  onComplete: (pin: string) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <PINGrid
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      autoFocus={autoFocus}
    />
  );
}

describe("PINGrid", () => {
  test("renders 6 empty cells initially", () => {
    const onComplete = vi.fn();
    render(<ControlledPIN onComplete={onComplete} />);
    expect(screen.getAllByText("_").length).toBe(6);
    expect(screen.queryByText("•")).toBeNull();
  });

  test("typing one digit fills exactly one cell", async () => {
    const onComplete = vi.fn();
    render(<ControlledPIN onComplete={onComplete} />);
    const user = userEvent.setup();
    await user.keyboard("1");
    expect(screen.getAllByText("•").length).toBe(1);
    expect(screen.getAllByText("_").length).toBe(5);
  });

  test("Pitfall 2: auto-submits exactly ONCE on the 6th digit", async () => {
    const onComplete = vi.fn();
    render(<ControlledPIN onComplete={onComplete} />);
    const user = userEvent.setup();
    await user.keyboard("123456");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  test("re-renders with same 6-digit value do NOT re-trigger onComplete", () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <PINGrid
        value="123456"
        onChange={() => {}}
        onComplete={onComplete}
      />,
    );
    rerender(
      <PINGrid
        value="123456"
        onChange={() => {}}
        onComplete={onComplete}
      />,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("disabled blocks input — onChange is not called", async () => {
    const onChange = vi.fn();
    render(
      <PINGrid
        value=""
        onChange={onChange}
        onComplete={() => {}}
        disabled
      />,
    );
    const user = userEvent.setup();
    await user.keyboard("1");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("shake adds animate-shake class to the wrapper", () => {
    render(
      <PINGrid value="" onChange={() => {}} onComplete={() => {}} shake />,
    );
    const group = screen.getByRole("group");
    expect(group.className).toMatch(/animate-shake/);
  });

  test("autoFocus places focus on the hidden input", () => {
    const { container } = render(<ControlledPIN onComplete={() => {}} />);
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  test("T-20-05: hidden input has autoComplete=off, no name attribute, aria-hidden=true", () => {
    const { container } = render(
      <PINGrid value="" onChange={() => {}} onComplete={() => {}} />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input!.getAttribute("autocomplete")).toBe("off");
    expect(input!.hasAttribute("name")).toBe(false);
    expect(input!.getAttribute("aria-hidden")).toBe("true");
  });

  test("group has role='group' and accessible label 'PIN entry — 6 digits'", () => {
    render(<PINGrid value="" onChange={() => {}} onComplete={() => {}} />);
    const group = screen.getByRole("group", { name: "PIN entry — 6 digits" });
    expect(group).toBeInTheDocument();
  });
});
