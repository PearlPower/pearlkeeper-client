// apps/desktop/src/screens/NewWallet/ImportWallet/BIP32SeedImportScreen.tsx
//
// . useBip32SeedImportFlow consumer with single textarea for the seed.
// scanLog from the mobile reference is intentionally dropped (mobile-specific
// debug surface — not needed on desktop per PATTERNS §BIP32 line 778).

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  useBip32SeedImportFlow,
  useAnalyticsFlow,
} from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NOOP_ANALYTICS_PORT } from "@/lib/noopAnalyticsPort";
import { useNewWalletContext } from "../NewWalletProvider";

export function BIP32SeedImportScreen() {
  const navigate = useNavigate();
  const { addressService, ports, networkConfig } = useNewWalletContext();

  // wallet.import flow.bip32seed shape.
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
    analyticsFlow.step("type.bip32seed");
  }, [analyticsFlow]);
  const successEmittedRef = useRef(false);

  const flow = useBip32SeedImportFlow({
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
    extendedKeyPrefix: networkConfig.extendedKeyPrefix,
  });

  const { error, importWallet, input, isImporting, setInput } = flow;

  // edge-triggered flow.error.
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      analyticsFlow.error("type.bip32seed");
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
          Import from BIP32 seed
        </h1>
        <p className="text-xs text-muted-foreground mb-6">
          For 12- or 24-word seed phrases, go back and choose{" "}
          <strong>Mnemonic</strong>.
        </p>
        <Label htmlFor="bip32-seed-input">
          Hex seed or extended private key (xprv)
        </Label>
        <textarea
          id="bip32-seed-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your hex seed or xprv..."
          className="bg-input/30 border border-border rounded-md p-3 text-sm w-full min-h-32 mt-2 font-mono"
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
          disabled={!input.trim() || isImporting}
          onClick={importWallet}
        >
          Continue
        </Button>
      </section>
    </main>
  );
}
