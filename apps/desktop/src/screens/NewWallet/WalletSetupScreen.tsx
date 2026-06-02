// apps/desktop/src/screens/NewWallet/WalletSetupScreen.tsx
//
// combined first step. Blockchain + Network + Create-or-Import action.
// 1:1 port of apps/mobile/src/screens/NewWallet/WalletSetupScreen.tsx with
// RN segmented control swapped for shadcn Buttons (variant=default selected,
// variant=outline unselected) and TouchableOpacity action cards swapped for
// shadcn <Card> wrapped in <button>.
//
// (UAT Test 7, 2026-04-28): the mnemonic is no longer held in screen-
// local useState — it lives in NewWalletProvider so Back navigation from
// /wallet/new/verify → /wallet/new/seed sees the SAME words. Clicking
// "Create new" calls setMnemonic(generateMnemonic(128)) before navigating.

import { useNavigate } from "react-router-dom";
import { BLOCKCHAINS } from "@prl-wallet/config";
import { generateMnemonic } from "@prl-wallet/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNewWalletContext } from "./NewWalletProvider";

export function WalletSetupScreen() {
  const navigate = useNavigate();
  const { blockchainConfig, networkConfig, setChain, setMnemonic } =
    useNewWalletContext();

  const showBlockchainPicker = BLOCKCHAINS.length > 1;
  const showNetworkPicker = blockchainConfig.networks.length > 1;

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold leading-snug mb-8">
          Create a new wallet
        </h1>

        {showBlockchainPicker && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Blockchain
            </p>
            <div className="flex gap-2">
              {BLOCKCHAINS.map((bc) => (
                <Button
                  key={bc.id}
                  variant={bc.id === blockchainConfig.id ? "default" : "outline"}
                  onClick={() => setChain(bc, bc.networks[0])}
                  className="flex-1"
                >
                  {bc.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {showNetworkPicker && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Network
            </p>
            <div className="flex gap-2">
              {blockchainConfig.networks.map((net) => (
                <Button
                  key={net.id}
                  variant={net.id === networkConfig.id ? "default" : "outline"}
                  onClick={() => setChain(blockchainConfig, net)}
                  className="flex-1"
                >
                  {net.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs font-semibold text-muted-foreground mb-3">
          How do you want to add this wallet?
        </p>
        <div className="grid gap-3">
          <Card className="p-0">
            <button
              type="button"
              onClick={() => {
                setMnemonic(generateMnemonic(128));
                navigate("/wallet/new/seed");
              }}
              className="w-full text-left p-6 hover:bg-primary/5 transition-colors rounded-lg"
            >
              <p className="text-xs font-semibold mb-1">Create new</p>
              <p className="text-xs text-muted-foreground">
                Generate a fresh seed phrase on this device.
              </p>
            </button>
          </Card>
          <Card className="p-0">
            <button
              type="button"
              onClick={() => navigate("/wallet/import")}
              className="w-full text-left p-6 hover:bg-primary/5 transition-colors rounded-lg"
            >
              <p className="text-xs font-semibold mb-1">Import existing</p>
              <p className="text-xs text-muted-foreground">
                Restore from a mnemonic, BIP32 seed, or xpub.
              </p>
            </button>
          </Card>
        </div>

        <Button
          variant="ghost"
          onClick={() => navigate(1)}
          className="w-full mt-8"
        >
          Back
        </Button>
      </section>
    </main>
  );
}
