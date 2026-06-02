// apps/desktop/src/screens/NewWallet/ImportWallet/MnemonicImportScreen.tsx
//
// . useMnemonicImportFlow consumer with single textarea (paste-and-go).
// Mobile divergence: mobile uses 12/24 separate WordInputs; desktop ergonomic
// is paste-the-whole-phrase per UI-SPEC §MnemonicImport. The hook's per-word
// state is populated from the pasted text on submit (preserving the hook's
// internal validation contract — `words.some(w => !w.trim())` etc).
//
// CR-01 fix: React 18 batches state updates inside event handlers, so calling
// importWallet() synchronously after setSelectedWordCount/setWord runs against
// the previous render's empty `words` array and trips the
// `words.some(w => !w.trim())` early-return on the first click. The fix is to
// hydrate the per-word state, then arm a `pendingSubmitRef` and let a
// `useEffect` keyed on `words` fire `importWallet()` once the queued updates
// have flushed and `words` reflects the pasted phrase.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMnemonicImportFlow, useAnalyticsFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NOOP_ANALYTICS_PORT } from "@/lib/noopAnalyticsPort";
import { useNewWalletContext } from "../NewWalletProvider";

export function MnemonicImportScreen() {
  const navigate = useNavigate();
  const { addressService, ports, networkConfig } = useNewWalletContext();

  // wallet.import flow.
  // Mount → flow.start + step("type.mnemonic"); validation pass via
  // goToWalletName → step("validation.passed") + flow.success.
  const { services } = useAdapters();
  const analyticsFlow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.import",
  );
  const flowStartedRef = useRef(false);
  useEffect(() => {
    if (flowStartedRef.current) return;
    flowStartedRef.current = true;
    analyticsFlow.start();
    analyticsFlow.step("type.mnemonic");
  }, [analyticsFlow]);
  const successEmittedRef = useRef(false);

  const flow = useMnemonicImportFlow({
    navigation: {
      goToWalletName: (walletId, address, walletType) => {
        if (!successEmittedRef.current) {
          successEmittedRef.current = true;
          analyticsFlow.step("validation.passed");
          analyticsFlow.success();
        }
        navigate("/wallet/import/name", {
          state: { walletId, address, walletType },
        });
      },
    },
    addressService,
    ports,
    networkId: networkConfig.id,
  });

  const [text, setText] = useState("");
  // WR-01: Local length-validation error. The hook's `error` field is owned
  // by the import flow (mnemonic validity, storage failures, etc.) and we
  // shouldn't mutate it from the consumer; surface our pre-flow length
  // check via this separate state instead. The two error strings are
  // mutually exclusive in time — `localError` is set on the click that
  // never arms the submit, and the hook's `error` only appears AFTER
  // importWallet runs.
  const [localError, setLocalError] = useState<string | null>(null);
  const {
    error,
    importWallet,
    isImporting,
    setSelectedWordCount,
    setWord,
    words,
  } = flow;

  // CR-01: Submission is deferred to an effect so React has flushed the
  // queued setSelectedWordCount + setWord updates before importWallet runs.
  // Without this, importWallet's closure reads stale (empty) `words` and
  // always reports "Please fill in all word fields...".
  const pendingSubmitRef = useRef(false);

  useEffect(() => {
    if (
      pendingSubmitRef.current &&
      words.length > 0 &&
      words.every((w) => w.trim())
    ) {
      pendingSubmitRef.current = false;
      void importWallet();
    }
  }, [words, importWallet]);

  // edge-triggered flow.error so repeated renders carrying
  // the same error string emit exactly one analytics event per failure.
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      analyticsFlow.error("type.mnemonic");
    } else if (!error) {
      lastErrorRef.current = null;
    }
  }, [error, analyticsFlow]);

  const handleContinue = () => {
    // Push pasted text into the hook's per-word state, then arm the deferred
    // submit. The `words`-keyed effect above will fire importWallet() once
    // React flushes the queued state updates.
    const split = text.trim().split(/\s+/);
    // WR-01: BIP39 mnemonics are 12 or 24 words. Treat any other length as a
    // user-facing error and bail BEFORE arming the deferred submit. Without
    // this guard, a 13–23-word paste silently truncated to the first 12
    // words and the hook's BIP39 validation surfaced a generic "Invalid
    // mnemonic" error — leaving the user no signal that their paste was
    // truncated.
    if (split.length !== 12 && split.length !== 24) {
      setLocalError(
        `Seed phrases are 12 or 24 words. You pasted ${split.length}.`,
      );
      return;
    }
    setLocalError(null);
    const targetCount: 12 | 24 = split.length === 24 ? 24 : 12;
    setSelectedWordCount(targetCount);
    for (let i = 0; i < targetCount; i++) {
      setWord(i, split[i] ?? "");
    }
    pendingSubmitRef.current = true;
  };

  // WR-01: hook `error` and `localError` are mutually exclusive in time —
  // localError is set on a click that NEVER arms the submit, hook `error`
  // only appears AFTER importWallet runs. Prefer hook `error` if both are
  // somehow set to keep the displayed copy aligned with the most recent
  // user action.
  const displayError = error ?? localError;

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(1)}
          aria-label="Back"
          className="mb-4"
        >
          ← Back
        </Button>
        <h1 className="text-xl font-semibold leading-snug mb-6">
          Import from mnemonic
        </h1>
        <Label htmlFor="mnemonic-input">Seed phrase</Label>
        <textarea
          id="mnemonic-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your 12 or 24 words separated by spaces"
          className="bg-input/30 border border-border rounded-md p-3 text-sm w-full min-h-32 mt-2 font-mono"
          autoFocus
        />
        {displayError && (
          <p className="text-sm text-destructive mt-3" role="alert">
            {displayError}
          </p>
        )}
        <Button
          size="lg"
          className="w-full mt-6"
          disabled={!text.trim() || isImporting}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </section>
    </main>
  );
}
