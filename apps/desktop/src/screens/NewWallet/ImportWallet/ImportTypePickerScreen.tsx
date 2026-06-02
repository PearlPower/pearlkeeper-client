// apps/desktop/src/screens/NewWallet/ImportWallet/ImportTypePickerScreen.tsx
//
// import type picker. 3 cards → /wallet/import/{mnemonic|bip32|xpub}.

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Option = { heading: string; body: string; route: string };
const OPTIONS: Option[] = [
  {
    heading: "Mnemonic",
    body: "12 or 24 words from a BIP39 seed phrase.",
    route: "/wallet/import/mnemonic",
  },
  {
    heading: "BIP32 seed",
    body: "Hex seed or extended private key (xprv).",
    route: "/wallet/import/bip32",
  },
  {
    heading: "Watch-only (xpub)",
    body: "Public-key only. View balance and history; cannot sign transactions.",
    route: "/wallet/import/xpub",
  },
];

export function ImportTypePickerScreen() {
  const navigate = useNavigate();
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
          Import a wallet
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose how you want to restore.
        </p>
        <div className="grid gap-3">
          {OPTIONS.map((o) => (
            <Card key={o.route} className="p-0">
              <button
                type="button"
                onClick={() => navigate(o.route)}
                className="w-full text-left p-6 hover:bg-primary/5 transition-colors rounded-lg"
              >
                <p className="text-xs font-semibold mb-1">{o.heading}</p>
                <p className="text-xs text-muted-foreground">{o.body}</p>
              </button>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
