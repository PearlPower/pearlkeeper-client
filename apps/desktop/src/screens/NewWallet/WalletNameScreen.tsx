// apps/desktop/src/screens/NewWallet/WalletNameScreen.tsx
//
// final-step shared by create + import branches. useWalletNameFlow consumer.
// Branch detection via location.pathname routes to the correct /done route.

import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useWalletNameFlow } from "@prl-wallet/app-flows";
import type { ImportWalletType } from "@prl-wallet/app-flows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StateShape = {
  walletId?: string;
  address?: string;
  walletType?: ImportWalletType;
};

export function WalletNameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as StateShape | null) ?? {};
  const isImport = location.pathname.startsWith("/wallet/import");
  const doneRoute = isImport ? "/wallet/import/done" : "/wallet/new/done";

  const flow = useWalletNameFlow({
    navigation: {
      goToSetupSuccess: (walletId, walletName, address) =>
        navigate(doneRoute, { state: { walletId, walletName, address } }),
    },
    walletId: state.walletId ?? "",
    address: state.address ?? "",
    walletType: (state.walletType ?? "mnemonic") as ImportWalletType,
  });

  const { continueToSetupSuccess, error, setWalletName, walletName } = flow;

  // IN-02: render-time redirect via <Navigate> matches the WR-05 fix in
  // PINConfirmScreen. Hooks must run unconditionally above the guard
  // (Rules of Hooks); the guard therefore comes AFTER useWalletNameFlow.
  if (!state.walletId || !state.address || !state.walletType) {
    return <Navigate to="/wallet/new" replace />;
  }

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold leading-snug mb-2">
          Name your wallet
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Pick a name you'll recognize. This is just a label.
        </p>
        <Label htmlFor="wallet-name">Wallet name</Label>
        <Input
          id="wallet-name"
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
          placeholder="My PRL wallet"
          autoFocus
          autoComplete="off"
          className="mt-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") continueToSetupSuccess();
          }}
        />
        {error && (
          <p className="text-sm text-destructive mt-3" role="alert">
            {error}
          </p>
        )}
        <Button
          size="lg"
          className="w-full mt-6"
          disabled={!walletName.trim()}
          onClick={continueToSetupSuccess}
        >
          Continue
        </Button>
      </section>
    </main>
  );
}
