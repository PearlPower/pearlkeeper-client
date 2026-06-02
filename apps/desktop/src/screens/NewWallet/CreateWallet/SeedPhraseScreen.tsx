// apps/desktop/src/screens/NewWallet/CreateWallet/SeedPhraseScreen.tsx
//
// + . Mnemonic now sourced from NewWalletProvider (, UAT
// Test 7, 2026-04-28) instead of `location.state` — Back navigation from
// /wallet/new/verify needs to land here with the SAME words still in scope,
// and route state would not survive a re-mount. The provider lives ONCE in
// App.tsx (W-8), so its state spans the wizard's full lifetime.
//
// The mnemonic is displayed only after the user toggles <HoldToReveal>
// (click / Space / Enter). (UAT-6, 2026-04-28): the prior
// press-and-hold mechanism made it hard for users to write the seed phrase
// down — replaced with a click-to-toggle that stays visible until the user
// toggles it back off.
//
// + — Strategy A (Pitfall 1 mitigation):
// <HoldToReveal gate={handleGate}> awaits the gate Promise BEFORE
// setRevealed(true); the mnemonic never flashes for one frame.
// <SensitiveOpGate op=RevealMnemonic> sequences re-PIN + (online) warning.
// once-per-visit consent (): re-PIN shown only on first reveal per
// screen visit; subsequent toggle/hide cycles short-circuit via consented.
// revealRegistry integration (): clearAll() on blur/lock flips
// registryDisabled → true, triggering HoldToReveal's existing disabled-flip
// useEffect to hide the mnemonic and fire onHide.
// W-9: HoldToReveal wrapper is <div role="button"> so it legally contains
// the block-level word grid below.
//
// ( test 5): The registry callback now flips registryDisabled
// true (synchronous redaction via HoldToReveal's disabled-flip effect — SECUX-05
// preserved), clears consented (so the next reveal re-prompts the gate), then
// queueMicrotask-resets registryDisabled to false so the Switch is re-engageable.
// The "I've written it down" continue button stays enabled because it is gated solely
// on hasBeenRevealed, which is set on first reveal and never reset by the registry
// callback.

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useAnalyticsFlow } from "@prl-wallet/app-flows";
import { Button } from "@/components/ui/button";
import { HoldToReveal } from "@/components/HoldToReveal";
import { SensitiveOpGate } from "@/security/SensitiveOpGate";
import { SensitiveOp } from "@/security/sensitiveOps";
import { register } from "@/security/revealRegistry";
import { NOOP_ANALYTICS_PORT } from "@/lib/noopAnalyticsPort";
import { useNewWalletContext } from "../NewWalletProvider";

export function SeedPhraseScreen() {
  const navigate = useNavigate();
  const { ports, services } = useAdapters();
  const { mnemonic } = useNewWalletContext();
  const [hasBeenRevealed, setHasBeenRevealed] = useState(false);

  // wallet.create flow start + mnemonic.shown step.
  // Mounting SeedPhraseScreen marks the user committing to a new wallet
  // creation; the mnemonic is shown immediately after the gate. Defense
  // layer #2 (the hook's getConsent check) no-ops both calls when consent
  // is revoked ( hook contract).
  const flow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.create",
  );
  const flowStartedRef = useRef(false);
  useEffect(() => {
    if (flowStartedRef.current) return;
    flowStartedRef.current = true;
    flow.start();
    flow.step("mnemonic.shown");
  }, [flow]);

  // once-per-visit consent: short-circuits the gate on subsequent reveals
  // within the same screen visit. Cleared on route unmount (component-local state).
  const [consented, setConsented] = useState(false);

  // registryDisabled: flipped true by revealRegistry.clearAll() on blur/lock ().
  // Passes through to <HoldToReveal disabled>, which triggers its existing
  // useEffect (lines 78-83) to hide the mnemonic and fire onHide.
  const [registryDisabled, setRegistryDisabled] = useState(false);

  // gatePendingRef: holds the resolve function for the in-flight gate Promise.
  // Drained by handleConfirm (resolve true) or handleCancel (resolve false).
  const gatePendingRef = useRef<((v: boolean) => void) | null>(null);

  // triggerRef: holds the SensitiveOpGate render-prop trigger so handleGate
  // can invoke it from inside the gate Promise factory.
  const triggerRef = useRef<(() => void) | null>(null);

  // : transient registryDisabled flip + consent reset on registry-clear.
  // Sequence guarantees: (a) HoldToReveal's disabled-flip useEffect fires once with
  // disabled=true → hides the mnemonic (SECUX-05); (b) consented goes false so the next
  // reveal re-prompts the gate; (c) queueMicrotask flips registryDisabled back to false
  // on the next microtask so the Switch is re-engageable. hasBeenRevealed is NOT reset.
  useEffect(() => {
    const unregister = register(() => {
      setRegistryDisabled(true);
      setConsented(false);
      queueMicrotask(() => setRegistryDisabled(false));
    });
    return unregister;
  }, []);

  // handleGate: the `gate` prop value passed to <HoldToReveal>.
  // short-circuit: if already consented, skip the gate entirely.
  // Otherwise, construct a Promise and invoke the SensitiveOpGate trigger.
  const handleGate = useCallback((): Promise<boolean> => {
    if (consented) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      gatePendingRef.current = resolve;
      triggerRef.current?.();
    });
  }, [consented]);

  // handleConfirm: called by <SensitiveOpGate onConfirm> when the user passes
  // re-PIN (offline) or re-PIN + type-to-confirm (online). Sets consented=true
  // and drains gatePendingRef with true.
  const handleConfirm = useCallback(() => {
    setConsented(true);
    const resolve = gatePendingRef.current;
    gatePendingRef.current = null;
    resolve?.(true);
  }, []);

  // handleCancel: called by <SensitiveOpGate onCancel> when the user dismisses
  // any dialog. Drains gatePendingRef with false so the awaiting HoldToReveal
  // returns cleanly without hanging (T-22-26 mitigation).
  const handleCancel = useCallback(() => {
    const resolve = gatePendingRef.current;
    gatePendingRef.current = null;
    resolve?.(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!mnemonic) return;
    try {
      await ports.clipboard.setString(mnemonic.trim());
      toast.success("Seed phrase copied");
    } catch {
      toast.error("Could not copy seed phrase");
    }
  }, [mnemonic, ports]);

  // IN-02: render-time redirect via <Navigate> matches the WR-05 fix in
  // PINConfirmScreen and the canonical react-router-dom idiom. The previous
  // effect-based version paired with `if (!mnemonic) return null;` was
  // already non-interactive, so this is purely an ergonomic / consistency
  // change — no observable behavior shift.
  if (!mnemonic) return <Navigate to="/wallet/new" replace />;

  const words = mnemonic.trim().split(/\s+/);
  // 2-column layout, column-major (1..N/2 left, N/2+1..N right) for tabular readability.
  const rows = Math.ceil(words.length / 2);

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold leading-snug mb-2">
          Your seed phrase
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Write these {words.length} words down, in order. They are the only way
          to recover your wallet.
        </p>

        <SensitiveOpGate
          op={SensitiveOp.RevealMnemonic}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        >
          {(trigger) => {
            triggerRef.current = trigger;
            return (
              <HoldToReveal
                label="Show seed phrase"
                disabled={registryDisabled}
                gate={handleGate}
                onReveal={() => setHasBeenRevealed(true)}
              >
                <div
                  className="grid gap-x-6 gap-y-2 text-base font-mono"
                  style={{
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gridTemplateRows: `repeat(${rows}, auto)`,
                    gridAutoFlow: "column",
                  }}
                >
                  {words.map((w, i) => (
                    <span key={i} className="text-foreground">
                      {i + 1}. {w}
                    </span>
                  ))}
                </div>
              </HoldToReveal>
            );
          }}
        </SensitiveOpGate>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          disabled={!hasBeenRevealed}
          onClick={handleCopy}
        >
          <Copy className="mr-2 size-4" aria-hidden="true" />
          Copy seed phrase
        </Button>

        {/* : continue button is gated solely on !hasBeenRevealed. Do NOT add registryDisabled
            to this disabled prop — the user must be able to leave the screen even if the registry
            clears mid-visit. hasBeenRevealed stays true for the duration of the screen visit once
            set on first reveal. */}
        <Button
          size="lg"
          className="w-full mt-4"
          disabled={!hasBeenRevealed}
          onClick={() => navigate("/wallet/new/verify")}
        >
          I've written it down
        </Button>
        {/*
          Back uses navigate(1) (history-back). The previous URL-push variant
          left a duplicate /wallet/new on the stack, which made the picker's
          own Back (also navigate(1)) loop back into /seed. The deep-link/
          refresh edge case is already handled by the !mnemonic redirect at
          the top of this file (<Navigate to="/wallet/new" replace />).
        */}
        <Button
          variant="ghost"
          onClick={() => navigate(1)}
          className="w-full mt-4"
        >
          Back
        </Button>
      </section>
    </main>
  );
}
