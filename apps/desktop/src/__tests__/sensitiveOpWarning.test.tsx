// apps/desktop/src/__tests__/sensitiveOpWarning.test.tsx
//
// Task 2 — GREEN tests for <SensitiveOpWarning>.
// Activates the 7 RED stubs from + adds 1 locked-error-copy test (8 total).

import { describe, test, expect, vi } from "vitest";
import { screen, act } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { SensitiveOpWarning } from "@/security/SensitiveOpWarning";
import { renderUnderHarness } from "@/__tests__/_harness/TestHarness";
import { SensitiveOp, SENSITIVE_OP_COPY } from "@/security/sensitiveOps";

// Stateful Wrapper so tests control open state
function makeWrapper(
  op: (typeof SensitiveOp)[keyof typeof SensitiveOp],
  onConfirmSpy: () => void,
  onOpenChangeSpy: (o: boolean) => void,
) {
  function Wrapper() {
    const [open, setOpen] = useState(true);
    return (
      <SensitiveOpWarning
        op={op}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          onOpenChangeSpy(o);
        }}
        onConfirm={onConfirmSpy}
      />
    );
  }
  return Wrapper;
}

describe("SensitiveOpWarning", () => {
  test("renders ShieldAlert + per-op title from SENSITIVE_OP_COPY (sign_tx)", async () => {
    const Wrapper = makeWrapper(SensitiveOp.SignTx, vi.fn(), vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    expect(
      await screen.findByRole("heading", {
        name: SENSITIVE_OP_COPY[SensitiveOp.SignTx].title,
      }),
    ).toBeInTheDocument();
    // ShieldAlert is aria-hidden — verify it exists in the DOM
    expect(
      document.querySelector('[aria-hidden="true"]'),
    ).toBeInTheDocument();
  });

  test("renders ShieldAlert + per-op title from SENSITIVE_OP_COPY (reveal_mnemonic)", async () => {
    const Wrapper = makeWrapper(SensitiveOp.RevealMnemonic, vi.fn(), vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    expect(
      await screen.findByRole("heading", {
        name: SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic].title,
      }),
    ).toBeInTheDocument();
  });

  test("type-to-confirm tier renders Input; explain tier does NOT render Input", async () => {
    // RevealMnemonic is type-to-confirm — should show input
    const WrapperTypeConfirm = makeWrapper(
      SensitiveOp.RevealMnemonic,
      vi.fn(),
      vi.fn(),
    );
    const { result: result1 } = renderUnderHarness({
      routes: [{ path: "/", element: <WrapperTypeConfirm /> }],
      networkGateOpen: true,
    });

    expect(
      await screen.findByLabelText("Type SHOW MY SEED to continue"),
    ).toBeInTheDocument();

    result1.unmount();

    // SignTx is explain tier — should NOT show input
    const WrapperExplain = makeWrapper(
      SensitiveOp.SignTx,
      vi.fn(),
      vi.fn(),
    );
    renderUnderHarness({
      routes: [{ path: "/", element: <WrapperExplain /> }],
      networkGateOpen: true,
    });

    await screen.findByRole("heading", {
      name: SENSITIVE_OP_COPY[SensitiveOp.SignTx].title,
    });
    expect(
      screen.queryByLabelText("Type SHOW MY SEED to continue"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: SENSITIVE_OP_COPY[SensitiveOp.SignTx].primaryCtaLabel,
      }),
    ).not.toBeInTheDocument();
  });

  test("Continue button disabled until phrase matches exactly (case-sensitive)", async () => {
    const copy = SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic];
    const Wrapper = makeWrapper(SensitiveOp.RevealMnemonic, vi.fn(), vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    const continueBtn = await screen.findByRole("button", {
      name: copy.continueAnywayLabel,
    });
    expect(continueBtn).toBeDisabled();

    const user = userEvent.setup();
    const input = screen.getByLabelText("Type SHOW MY SEED to continue");

    // Partial match — still disabled
    await user.type(input, "SHOW MY SEE");
    expect(continueBtn).toBeDisabled();

    // Complete match — enabled
    await user.type(input, "D");
    expect(continueBtn).not.toBeDisabled();

    // Clear and type lowercase (case mismatch) — disabled again
    await user.clear(input);
    await user.type(input, "show my seed");
    expect(continueBtn).toBeDisabled();
  });

  test("case mismatch keeps Continue disabled", async () => {
    const copy = SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic];
    const Wrapper = makeWrapper(SensitiveOp.RevealMnemonic, vi.fn(), vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    const user = userEvent.setup();
    const input = await screen.findByLabelText("Type SHOW MY SEED to continue");
    await user.type(input, "show my seed");

    const continueBtn = screen.getByRole("button", {
      name: copy.continueAnywayLabel,
    });
    expect(continueBtn).toBeDisabled();
  });

  test("mismatch shows locked error copy 'Phrase does not match — type exactly: SHOW MY SEED'", async () => {
    const copy = SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic];
    expect(copy.confirmMismatch).toBeTruthy();
    const Wrapper = makeWrapper(SensitiveOp.RevealMnemonic, vi.fn(), vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    const user = userEvent.setup();
    const input = await screen.findByLabelText("Type SHOW MY SEED to continue");

    // Type a mismatched phrase
    await user.type(input, "show my seed");

    const errorMsg = screen.getByText(
      (SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic].confirmMismatch as string),
    );
    expect(errorMsg).toBeInTheDocument();
    expect(errorMsg.tagName.toLowerCase()).toBe("p");
    expect(errorMsg.className).toContain("text-destructive");
    expect(errorMsg.className).toContain("text-xs");

    // Clear and type exact phrase — error disappears
    await user.clear(input);
    await user.type(input, copy.confirmPhrase!);
    expect(
      screen.queryByText(
        (SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic].confirmMismatch as string),
      ),
    ).not.toBeInTheDocument();
  });

  test("reset-on-close clears typed phrase (Pitfall 5)", async () => {
    const onOpenChange = vi.fn();
    let externalSetOpen: (v: boolean) => void;

    function Wrapper() {
      const [open, setOpen] = useState(true);
      externalSetOpen = (v: boolean) => setOpen(v);
      return (
        <SensitiveOpWarning
          op={SensitiveOp.RevealMnemonic}
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            onOpenChange(o);
          }}
          onConfirm={vi.fn()}
        />
      );
    }

    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    const user = userEvent.setup();
    const input = await screen.findByLabelText("Type SHOW MY SEED to continue");
    await user.type(input, "SHOW");

    // Close via Escape
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

    // Input should be empty
    const inputAfterReopen = screen.getByLabelText(
      "Type SHOW MY SEED to continue",
    ) as HTMLInputElement;
    expect(inputAfterReopen.value).toBe("");
  });

  test("Turn-off-network-first CTA calls networkGateStore.close() and dismisses modal", async () => {
    const copy = SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic];
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const Wrapper = makeWrapper(SensitiveOp.RevealMnemonic, onConfirm, onOpenChange);

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    // Gate should start open
    expect(bundle.stores.networkGate.getState().isOpen).toBe(true);

    const user = userEvent.setup();
    const turnOffBtn = await screen.findByRole("button", {
      name: copy.primaryCtaLabel,
    });
    await user.click(turnOffBtn);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(bundle.stores.networkGate.getState().isOpen).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("explain tier (sign_tx): footer renders exactly two action buttons — Broadcast anyway + Cancel; no 'Turn off network first'", async () => {
    const Wrapper = makeWrapper(SensitiveOp.SignTx, vi.fn(), vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    const heading = await screen.findByRole("heading", {
      name: SENSITIVE_OP_COPY[SensitiveOp.SignTx].title,
    });
    expect(heading).toBeInTheDocument();

    const continueBtn = screen.getByRole("button", { name: "Broadcast anyway" });
    expect(continueBtn).not.toBeDisabled();

    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /Turn off network first/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Type SHOW MY SEED to continue/),
    ).not.toBeInTheDocument();
  });

  test("explain tier: clicking continueAnywayLabel fires onConfirm immediately (no phrase required)", async () => {
    const onConfirm = vi.fn();
    const Wrapper = makeWrapper(SensitiveOp.SignTx, onConfirm, vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    const user = userEvent.setup();
    const continueBtn = await screen.findByRole("button", {
      name: "Broadcast anyway",
    });
    await user.click(continueBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("type-to-confirm tier (reveal_mnemonic): mismatch text is sourced from SENSITIVE_OP_COPY[op].confirmMismatch (not a hardcoded literal)", async () => {
    // regression test — guards against the inline literal returning to the component.
    expect(SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic].confirmMismatch).toBeTruthy();

    const Wrapper = makeWrapper(SensitiveOp.RevealMnemonic, vi.fn(), vi.fn());
    renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    const user = userEvent.setup();
    const input = await screen.findByLabelText(/Type SHOW MY SEED to continue/);
    await user.type(input, "wrong");

    const expectedMismatch = SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic]
      .confirmMismatch as string;
    const errorEl = await screen.findByText(expectedMismatch);
    expect(errorEl).toBeInTheDocument();
    // DOM regression guard: the element is the destructive paragraph.
    expect(errorEl.tagName).toBe("P");
    expect(errorEl.className).toMatch(/text-destructive/);
  });

  test("auto-dismiss when networkGate.isOpen flips to false externally", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const Wrapper = makeWrapper(SensitiveOp.RevealMnemonic, onConfirm, onOpenChange);

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <Wrapper /> }],
      networkGateOpen: true,
    });

    // Verify dialog is open and gate is open
    expect(bundle.stores.networkGate.getState().isOpen).toBe(true);
    await screen.findByRole("heading", {
      name: SENSITIVE_OP_COPY[SensitiveOp.RevealMnemonic].title,
    });

    // Close the gate externally
    act(() => {
      bundle.stores.networkGate.getState().close();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Auto-dismiss should have fired
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
