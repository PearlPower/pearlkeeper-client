// apps/desktop/src/screens/NewWallet/SetupSuccessScreen.tsx
//
// wizard terminal step. useSetupSuccessFlow.createWallet does the
// actual wallet creation; resetToRoot navigates with replace:true so
// the auth state machine flips cleanly (Pitfall 1).

import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useSetupSuccessFlow } from "@prl-wallet/app-flows";
import { Button } from "@/components/ui/button";
import { useNewWalletContext } from "./NewWalletProvider";

type StateShape = {
  walletId?: string;
  walletName?: string;
  address?: string;
};

export function SetupSuccessScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as StateShape | null) ?? {};
  const { ports, networkConfig, clearMnemonic } = useNewWalletContext();
  const isImport = location.pathname.startsWith("/wallet/import");
  const heading = isImport ? "Wallet imported" : "Wallet created";

  const flow = useSetupSuccessFlow({
    navigation: {
      resetToRoot: (newWalletId) => {
        // (UAT Test 7, 2026-04-28): wipe provider mnemonic on terminal
        // success — must run BEFORE navigate(...) so the auth-tree flip that
        // unmounts NewWalletProvider sees a null field. Never called on Back.
        clearMnemonic();
        navigate(`/wallet/${newWalletId}`, { replace: true });
      },
    },
    ports,
    walletId: state.walletId ?? "",
    walletName: state.walletName ?? "",
    address: state.address ?? "",
    networkId: networkConfig.id,
  });

  const { createWallet, isSubmitting } = flow;

  // IN-02: render-time redirect via <Navigate> matches the WR-05 fix in
  // PINConfirmScreen. Hooks must run unconditionally above the guard
  // (Rules of Hooks); the guard therefore comes AFTER useSetupSuccessFlow.
  if (!state.walletId || !state.walletName || !state.address) {
    return <Navigate to="/wallet/new" replace />;
  }

  return (
    <main className="bg-background min-h-screen flex items-center justify-center">
      <section className="max-w-md mx-auto px-6 py-8 w-full text-center">
        <h1 className="text-3xl font-semibold leading-tight mb-4">{heading}</h1>
        <p className="text-sm text-muted-foreground mb-12">
          '{state.walletName}' is ready. You can find it in your wallets list.
        </p>
        <Button
          size="lg"
          className="w-full"
          onClick={createWallet}
          disabled={isSubmitting}
        >
          Open wallet
        </Button>
        <Button
          variant="link"
          className="mt-4 text-xs text-muted-foreground"
          onClick={() => navigate("/wallets")}
          disabled={isSubmitting}
        >
          Back to wallets list
        </Button>
      </section>
    </main>
  );
}
