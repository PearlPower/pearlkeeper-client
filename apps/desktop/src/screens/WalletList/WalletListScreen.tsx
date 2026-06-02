// apps/desktop/src/screens/WalletList/WalletListScreen.tsx
//
// stacked card list + header "+ New wallet" CTA.
//
// Reads from `stores.walletList` (cached balance only — says cached;
// live balance fires from WalletDetail). will wrap this same list
// as the sidebar in master/detail; ships full-route stacked.
//
// Locked copy (UI-SPEC §WalletList lines 180-191 — DO NOT paraphrase):
// "Your wallets" / "+ New wallet" / "No wallets yet" /
// "Create your first wallet or import an existing one to get started."
//
// Color reservations (UI-SPEC §Color):
// hover:bg-primary/5 — the only place primary appears at <10% opacity
// (reservation #4 — wallet card hover/selection)
//
// T-20-36 mitigation: each card is wrapped in a real <button type="button">
// element so it's keyboard-activatable + has visible focus ring.

import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { satoshisToDisplay } from "@/lib/satoshisToDisplay";
import { getNetworkInfo } from "@/lib/getNetworkInfo";

export function WalletListScreen() {
  const navigate = useNavigate();
  const { stores } = useAdapters();
  const wallets = useStore(stores.walletList, (s) => s.wallets);

  if (wallets.length === 0) {
    return (
      <section className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-xl font-semibold leading-snug mb-3">
          No wallets yet
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Create your first wallet or import an existing one to get started.
        </p>
        <Button size="lg" onClick={() => navigate("/wallet/new")}>
          + New wallet
        </Button>
      </section>
    );
  }

  return (
    <section className="max-w-2xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold leading-snug">Your wallets</h1>
        <Button onClick={() => navigate("/wallet/new")}>+ New wallet</Button>
      </header>
      <div className="grid gap-3">
        {wallets.map((w) => {
          const { blockchainName, networkName } = getNetworkInfo(w.networkId);
          return (
            <Card key={w.id} className="p-0 min-h-20">
              <button
                type="button"
                onClick={() => navigate(`/wallet/${w.id}`)}
                className="w-full text-left p-6 hover:bg-primary/5 transition-colors rounded-xl flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold truncate">{w.name}</p>
                  <Badge
                    variant="outline"
                    className="mt-1 text-xs font-semibold"
                  >
                    {blockchainName} · {networkName}
                  </Badge>
                </div>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {satoshisToDisplay(w.lastKnownBalance)}
                </p>
              </button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
