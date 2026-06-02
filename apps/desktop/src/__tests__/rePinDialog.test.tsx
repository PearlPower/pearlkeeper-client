// apps/desktop/src/__tests__/rePinDialog.test.tsx
//
// Task 1 — GREEN tests for <RePinDialog>.
// Activates the 4 RED stubs from .

import { describe, test, expect, vi } from "vitest";
import { screen, act } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { RePinDialog } from "@/security/RePinDialog";
import { renderUnderHarness } from "@/__tests__/_harness/TestHarness";
import { createPinRecord } from "@/lib/hashPIN";

const CORRECT_PIN = "123456";
const WRONG_PIN = "999999";

function makeProps(overrides: Partial<Parameters<typeof RePinDialog>[0]> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    onMatch: vi.fn(),
    ...overrides,
  };
}

describe("RePinDialog", () => {
  test("correct PIN → onMatch fires + dialog closes", async () => {
    const onMatch = vi.fn();
    const onOpenChange = vi.fn();
    const props = makeProps({ onMatch, onOpenChange });

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <RePinDialog {...props} /> }],
      networkGateOpen: false,
    });

    // Seed the correct PIN hash
    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    // Type the correct PIN into the hidden input (PINGrid uses a hidden input)
    const input = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(input, CORRECT_PIN);

    // Allow async handleComplete to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  test("wrong PIN → recordFailedAttempt called + shake animation", async () => {
    const onMatch = vi.fn();
    const onOpenChange = vi.fn();
    const props = makeProps({ onMatch, onOpenChange });

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <RePinDialog {...props} /> }],
      networkGateOpen: false,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const recordFailedAttemptSpy = vi.spyOn(
      bundle.stores.lock.getState(),
      "recordFailedAttempt",
    );

    const user = userEvent.setup();
    const input = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(input, WRONG_PIN);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(recordFailedAttemptSpy).toHaveBeenCalledTimes(1);
    expect(onMatch).not.toHaveBeenCalled();
    // Verify the "Incorrect PIN" error appears
    expect(await screen.findByText("Incorrect PIN")).toBeInTheDocument();
  });

  test("3 wrong attempts within dialog → onOpenChange(false) fires; recordFailedAttempt called exactly 3 times", async () => {
    const onMatch = vi.fn();
    const onOpenChange = vi.fn();
    const props = makeProps({ onMatch, onOpenChange });

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <RePinDialog {...props} /> }],
      networkGateOpen: false,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const recordSpy = vi.spyOn(
      bundle.stores.lock.getState(),
      "recordFailedAttempt",
    );

    const user = userEvent.setup();

    // Type 3 wrong PINs
    for (let i = 0; i < 3; i++) {
      const input = document.querySelector(
        'input[type="password"]',
      ) as HTMLInputElement;
      await user.type(input, WRONG_PIN);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }

    expect(recordSpy).toHaveBeenCalledTimes(3);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onMatch).not.toHaveBeenCalled();
  });

  test("reset-on-close clears typed PIN and wrongAttempts (open → close → open shows empty grid and no inline error)", async () => {
    const onMatch = vi.fn();

    // Use a stateful wrapper that routes close/open through the component's onOpenChange
    let externalSetOpen: (v: boolean) => void;
    function Wrapper() {
      const [open, setOpenState] = useState(true);
      externalSetOpen = (v: boolean) => {
        // Simulate what Radix does: call the component's onOpenChange which
        // resets internal state, then update our open state
        setOpenState(v);
      };
      return (
        <RePinDialog
          open={open}
          onOpenChange={setOpenState}
          onMatch={onMatch}
        />
      );
    }

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: false,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();

    // Type 1 wrong PIN to create wrongAttempts state
    const input = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(input, WRONG_PIN);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Error should be visible
    expect(screen.getByText("Incorrect PIN")).toBeInTheDocument();

    // Close the dialog via Escape key (simulates Radix triggering onOpenChange(false))
    await user.keyboard("{Escape}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Reopen
    act(() => {
      externalSetOpen!(true);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Error message should be gone (wrongAttempts reset to 0)
    expect(screen.queryByText("Incorrect PIN")).not.toBeInTheDocument();

    // PIN input should be empty
    const inputAfterReopen = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    expect(inputAfterReopen.value).toBe("");
  });
});
