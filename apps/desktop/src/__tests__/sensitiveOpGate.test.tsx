// apps/desktop/src/__tests__/sensitiveOpGate.test.tsx
//
// Task 3 — GREEN tests for <SensitiveOpGate> state machine.
// Activates the 5 RED stubs from + 3 onCancel contract tests (8 total).

import { describe, test, expect, vi } from "vitest";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SensitiveOpGate } from "@/security/SensitiveOpGate";
import { renderUnderHarness } from "@/__tests__/_harness/TestHarness";
import { createPinRecord } from "@/lib/hashPIN";
import { SensitiveOp, SENSITIVE_OP_COPY } from "@/security/sensitiveOps";

const CORRECT_PIN = "123456";
const WRONG_PIN = "111111";

function makeGate(
  onConfirm: () => void,
  onCancel?: () => void,
  op: (typeof SensitiveOp)[keyof typeof SensitiveOp] = SensitiveOp.RevealMnemonic,
) {
  return (
    <SensitiveOpGate op={op} onConfirm={onConfirm} onCancel={onCancel}>
      {(trigger) => (
        <button onClick={trigger} data-testid="trigger-btn">
          fire
        </button>
      )}
    </SensitiveOpGate>
  );
}

async function typePin(pin: string) {
  const input = document.querySelector(
    'input[type="password"]',
  ) as HTMLInputElement;
  const user = userEvent.setup();
  await user.type(input, pin);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("SensitiveOpGate", () => {
  test("offline path: trigger → rePin → idle on PIN match (calls onConfirm; onCancel NOT called)", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: makeGate(onConfirm, onCancel) }],
      networkGateOpen: false,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    // RePinDialog should be open
    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });

    await typePin(CORRECT_PIN);

    // onConfirm should fire; no warning dialog shown; no onCancel
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    // No warning dialog shown (offline path)
    expect(
      screen.queryByRole("heading", {
        name: SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic].title,
      }),
    ).not.toBeInTheDocument();
  });

  test("online path (type-to-confirm tier): trigger → rePin → idle on PIN match — warning is bypassed; onConfirm fires; onCancel NOT called", async () => {
    // 2026-05-08: type-to-confirm tier ops no longer trigger the SensitiveOpWarning
    // step. PIN is the sole gate; online behaves identically to offline for these ops.
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const copy = SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic];

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: makeGate(onConfirm, onCancel) }],
      networkGateOpen: true,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });

    await typePin(CORRECT_PIN);

    // No rAF transition to "warning" — confirm fires synchronously after PIN match.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    // Warning dialog must NOT have appeared.
    expect(
      screen.queryByRole("heading", { name: copy.title }),
    ).not.toBeInTheDocument();
  });

  test("online path (explain tier — sign_tx): trigger → rePin → warning → idle on warning confirm", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const copy = SENSITIVE_OP_COPY[SensitiveOp.SignTx];

    const { bundle } = renderUnderHarness({
      routes: [
        {
          path: "/",
          element: makeGate(onConfirm, onCancel, SensitiveOp.SignTx),
        },
      ],
      networkGateOpen: true,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });
    await typePin(CORRECT_PIN);

    // Wait for rAF to flush — explain-tier warning dialog should open
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await screen.findByRole("heading", { name: copy.title });

    // No type-to-confirm input on explain tier — Continue is enabled immediately.
    const continueBtn = screen.getByRole("button", {
      name: copy.continueAnywayLabel,
    });
    await user.click(continueBtn);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("PIN mismatch: stays in rePin (no warning ever rendered)", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const copy = SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic];

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: makeGate(onConfirm, onCancel) }],
      networkGateOpen: true,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    // RePinDialog should be open
    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });

    // Type wrong PIN
    await typePin(WRONG_PIN);

    // Warning dialog should NOT be rendered
    expect(
      screen.queryByRole("heading", { name: copy.title }),
    ).not.toBeInTheDocument();

    // onConfirm should NOT have been called
    expect(onConfirm).not.toHaveBeenCalled();
    // onCancel NOT called yet (still in rePin)
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("Cancel on warning (explain tier — sign_tx): returns to idle, onConfirm NOT called, onCancel IS called exactly once", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const copy = SENSITIVE_OP_COPY[SensitiveOp.SignTx];

    const { bundle } = renderUnderHarness({
      routes: [
        {
          path: "/",
          element: makeGate(onConfirm, onCancel, SensitiveOp.SignTx),
        },
      ],
      networkGateOpen: true,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });
    await typePin(CORRECT_PIN);

    // Wait for rAF
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Warning dialog should be open (explain tier)
    await screen.findByRole("heading", { name: copy.title });

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: copy.cancelLabel });
    await user.click(cancelBtn);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("no two dialogs open at the same time (mutual exclusion)", async () => {
    const onConfirm = vi.fn();

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: makeGate(onConfirm) }],
      networkGateOpen: true,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    // During and after PIN entry, assert at most one alertdialog open at a time
    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });
    let dialogs = screen.queryAllByRole("alertdialog");
    expect(dialogs.length).toBeLessThanOrEqual(1);

    await typePin(CORRECT_PIN);

    // Immediately after PIN match (before rAF fires), still only one dialog
    dialogs = screen.queryAllByRole("alertdialog");
    expect(dialogs.length).toBeLessThanOrEqual(1);

    // After rAF, warning dialog opens
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    dialogs = screen.queryAllByRole("alertdialog");
    expect(dialogs.length).toBeLessThanOrEqual(1);
  });

  test("onCancel: dismiss rePin (Escape) → onCancel called exactly once; onConfirm NOT called", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: makeGate(onConfirm, onCancel) }],
      networkGateOpen: false,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    // RePinDialog open
    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });

    // Dismiss via Escape
    await user.keyboard("{Escape}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("onCancel: open warning then dismiss (Cancel button) → onCancel called exactly once", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const copy = SENSITIVE_OP_COPY[SensitiveOp.SignTx];

    const { bundle } = renderUnderHarness({
      routes: [
        {
          path: "/",
          element: makeGate(onConfirm, onCancel, SensitiveOp.SignTx),
        },
      ],
      networkGateOpen: true,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });
    await typePin(CORRECT_PIN);

    // Wait for rAF
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Warning dialog open
    await screen.findByRole("heading", { name: copy.title });

    // Cancel
    const cancelBtn = screen.getByRole("button", { name: copy.cancelLabel });
    await user.click(cancelBtn);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("onCancel: omitted (undefined) → no error on dismissal (safe no-op)", async () => {
    const onConfirm = vi.fn();
    // No onCancel provided

    const { bundle } = renderUnderHarness({
      routes: [
        {
          path: "/",
          element: (
            <SensitiveOpGate
              op={SensitiveOp.RevealMnemonic}
              onConfirm={onConfirm}
            >
              {(trigger) => (
                <button onClick={trigger} data-testid="trigger-btn">
                  fire
                </button>
              )}
            </SensitiveOpGate>
          ),
        },
      ],
      networkGateOpen: false,
    });

    vi.spyOn(bundle.services.secrets, "getPinHash").mockResolvedValue(
      await createPinRecord(CORRECT_PIN),
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("trigger-btn"));

    await screen.findByRole("heading", {
      name: "Enter PIN to reveal seed phrase",
    });

    // Dismiss without onCancel — should not throw
    await expect(async () => {
      await user.keyboard("{Escape}");
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }).not.toThrow();

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
