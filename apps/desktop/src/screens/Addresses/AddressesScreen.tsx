// apps/desktop/src/screens/Addresses/AddressesScreen.tsx
//
// New surface added during the WalletDetail polish pass. Lists the wallet's
// discovered addresses with copy + per-address balance + refresh button.
// Reuses the same TanStack ["address", addr] query keys that
// useWalletBalance populates, so cache is shared with the WalletDetail
// balance card.

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useWalletDetailFlow } from "@prl-wallet/app-flows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { satoshisToDisplay } from "@/lib/satoshisToDisplay";
import { getNetworkInfo } from "@/lib/getNetworkInfo";
import { getBlockbookClient } from "@/lib/getBlockbookClient";
import { scopedFetch } from "@/platform/scopedFetch";

export function AddressesScreen() {
  const { id: walletId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ports, stores } = useAdapters();
  const networkGateOpen = useStore(stores.networkGate, (s) => s.isOpen);

  const flow = useWalletDetailFlow({
    walletId: walletId ?? "",
    navigation: {
      goToSend: () => {},
      goToReceive: () => {},
      goToTransactionList: () => {},
      goToAddressList: () => {},
      goBack: () => navigate(1),
      popToTop: () => navigate("/wallets"),
      resetToRoot: () => navigate("/wallets"),
    },
  });

  const { wallet, addresses, isDiscovering } = flow;

  const client = useMemo(
    () =>
      wallet
        ? getBlockbookClient(wallet.networkId, ports.networkGate, scopedFetch)
        : null,
    [ports.networkGate, wallet],
  );

  // Per-address balance queries — share the cache with useWalletBalance via
  // the matching ["address", addr] query key.
  const queries = useQueries({
    queries: addresses.map((addr) => ({
      queryKey: ["address", addr],
      queryFn: () => client!.getAddress(addr, 1, 1),
      enabled: !!client && !!addr,
      refetchInterval: 30_000,
      staleTime: 10_000,
    })),
  });

  const isFetching = queries.some((q) => q.isFetching);

  const refetchAll = () => {
    queries.forEach((q) => q.refetch());
  };

  if (!wallet) return null;

  const { blockchainName } = getNetworkInfo(wallet.networkId);

  return (
    <section className="max-w-2xl mx-auto px-6 py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(1)}
        className="mb-4"
      >
        ← Back
      </Button>
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold leading-snug">Addresses</h1>
          <p className="text-xs text-muted-foreground mt-1">{wallet.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetchAll}
          disabled={isFetching || !networkGateOpen || addresses.length === 0}
          aria-label="Refresh addresses"
          className="h-9"
        >
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </header>

      {/* Loading state — shown while address discovery is in flight or the
          initial per-address balance queries are loading. Without this guard
          the screen would briefly show "No addresses yet" before the
          discovered set arrives from useWalletDetailFlow. */}
      {isDiscovering || (addresses.length === 0 && isFetching) ? (
        <Card className="p-12 text-center flex flex-col items-center gap-3">
          <Loader2
            className="size-6 animate-spin text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">Loading addresses…</p>
        </Card>
      ) : addresses.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold leading-snug mb-2">
            No addresses yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Address discovery hasn't completed for this wallet.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid gap-1 p-2">
            {addresses.map((addr, i) => {
              const q = queries[i];
              const balance = q?.data?.balance ?? null;
              return (
                <div
                  key={addr}
                  className="group flex items-center justify-between gap-4 p-3 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      #{i + 1}
                    </p>
                    <p className="text-xs font-mono truncate" title={addr}>
                      {addr}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                    {balance == null
                      ? "—"
                      : `${satoshisToDisplay(balance)} ${blockchainName}`}
                  </p>
                  <CopyButton
                    variant="icon"
                    onCopy={() => ports.clipboard.setString(addr)}
                    ariaLabel="Copy address"
                    className="h-6 w-6 p-0 [&>svg]:size-3.5"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </section>
  );
}
