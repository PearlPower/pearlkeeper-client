// apps/desktop/src/screens/NewWallet/ImportWallet/XpubImportScreen.tsx
//
// . useXpubImportFlow consumer. Watch-only wallet — no signing capability.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useXpubImportFlow, useAnalyticsFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NOOP_ANALYTICS_PORT } from "@/lib/noopAnalyticsPort";
import { useNewWalletContext } from "../NewWalletProvider";

export function XpubImportScreen() {
  const navigate = useNavigate();
  const { addressService, ports, networkConfig, network } =
    useNewWalletContext();

  // wallet.import flow.xpub shape (watch-only).
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
    analyticsFlow.step("type.xpub");
  }, [analyticsFlow]);
  const successEmittedRef = useRef(false);

  const flow = useXpubImportFlow({
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
    network,
    extendedPubKeyPrefix: networkConfig.extendedPubKeyPrefix,
  });

  const { error, importWallet, isImporting, setXpub, xpub } = flow;

  // edge-triggered flow.error.
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      analyticsFlow.error("type.xpub");
    } else if (!error) {
      lastErrorRef.current = null;
    }
  }, [error, analyticsFlow]);

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
        <h1 className="text-xl font-semibold leading-snug mb-2">
          Import as watch-only
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Paste an xpub to track balance and history. You won't be able to send
          from this wallet.
        </p>
        <Label htmlFor="xpub-input">xpub</Label>
        <textarea
          id="xpub-input"
          value={xpub}
          onChange={(e) => setXpub(e.target.value)}
          placeholder="xpub..."
          className="bg-input/30 border border-border rounded-md p-3 text-sm w-full min-h-24 mt-2 font-mono"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {error && (
          <p className="text-sm text-destructive mt-3" role="alert">
            {error}
          </p>
        )}
        <Button
          size="lg"
          className="w-full mt-6"
          disabled={!xpub.trim() || isImporting}
          onClick={importWallet}
        >
          Continue
        </Button>
      </section>
    </main>
  );
}
