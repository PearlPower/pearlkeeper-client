// apps/desktop/src/screens/NewWallet/CreateWallet/SeedVerifyScreen.tsx
//
// . useSeedVerifyFlow consumer. Renders the challenge as choice-button
// rows (shadcn <Button> variant=default selected, variant=outline unselected).
// Hook return shape pinned at planning time from
// packages/app-flows/src/flows/create/useSeedVerifyFlow.ts:
// { challenge: { blanks: [{position,choices,correct}] },
// selections: Record<number,string>, // KEYED BY POSITION
// error, isVerifying, allSelected, handleSelect, handleVerify }
//
// (UAT Test 7, 2026-04-28): adds a Back button → /wallet/new/seed so
// the user can re-read the mnemonic. Mnemonic persists in NewWalletProvider
// so re-mount of SeedPhraseScreen shows the same 12/24 words.

import { useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSeedVerifyFlow, useAnalyticsFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { NOOP_ANALYTICS_PORT } from "@/lib/noopAnalyticsPort";
import { useNewWalletContext } from "../NewWalletProvider";

export function SeedVerifyScreen() {
  const navigate = useNavigate();
  const { ports, network, bip86Path, networkConfig, mnemonic } =
    useNewWalletContext();

  // wallet.create success trigger lives in the
  // goToWalletName navigation transition (verification passed).
  // STEP 2 wallet.create row: mnemonic.verified + flow.success on
  // successful verify. SeedPhraseScreen owns flow.start (mount), so we
  // deliberately do NOT call flow.start here.
  const { services } = useAdapters();
  const analyticsFlow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.create",
  );
  const successEmittedRef = useRef(false);

  const flow = useSeedVerifyFlow({
    navigation: {
      goToWalletName: (walletId, address, walletType) => {
        if (!successEmittedRef.current) {
          successEmittedRef.current = true;
          analyticsFlow.step("mnemonic.verified");
          analyticsFlow.success();
        }
        navigate("/wallet/new/name", {
          state: { walletId, address, walletType },
        });
      },
    },
    mnemonic: mnemonic ?? "",
    ports,
    network,
    bip86Path,
    networkId: networkConfig.id,
  });

  // IN-02: render-time redirect via <Navigate> matches the WR-05 fix in
  // PINConfirmScreen. Hooks must run unconditionally above this guard so
  // call order stays stable across renders (Rules of Hooks); the guard
  // therefore comes AFTER useSeedVerifyFlow and the early <Navigate> tears
  // the screen down without rendering the verification UI.
  if (!mnemonic) return <Navigate to="/wallet/new" replace />;

  const {
    challenge,
    selections,
    error,
    isVerifying,
    allSelected,
    handleSelect,
    handleVerify,
  } = flow;

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold leading-snug mb-2">
          Verify your seed phrase
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Tap each word in the order it appears in your seed phrase.
        </p>

        <div className="grid gap-4 mb-6">
          {challenge.blanks.map((blank) => (
            <div key={blank.position}>
              <p className="text-xs text-muted-foreground mb-2">
                Word #{blank.position + 1}
              </p>
              <div className="flex gap-2 flex-wrap">
                {blank.choices.map((opt) => {
                  // selections is keyed by position (per useSeedVerifyFlow)
                  const isSelected = selections[blank.position] === opt;
                  return (
                    <Button
                      key={opt}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelect(blank.position, opt)}
                      disabled={isVerifying}
                    >
                      {opt}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          // UI-SPEC line 249 locks this copy. The hook's internal error string
          // ("Incorrect — please try again.") is implementation detail; we
          // display the locked UI-SPEC copy whenever `error` is non-null.
          <p className="text-sm text-destructive mb-4" role="alert">
            That's not the right order. Try again.
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={!allSelected || isVerifying}
          onClick={handleVerify}
        >
          Continue
        </Button>
        {/*
          Back uses navigate(1) (history-pop). The previous URL-push variant
          (navigate("/wallet/new/seed")) added a duplicate /seed onto the
          history stack, which then made /seed's own Back loop back into
          /verify. The deep-link/refresh edge case is handled by the
          !mnemonic guard above (<Navigate to="/wallet/new" replace />).
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
