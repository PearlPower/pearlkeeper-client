// apps/desktop/src/screens/Transactions/TransactionsScreen.tsx
//
// Lifted out of WalletDetailScreen as part of the WalletDetail polish pass.
// Renders the full transaction list for a wallet with a manual refresh
// button + isFetching spinner, and exposes the txid prominently on each row.

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useWalletDetailFlow } from "@prl-wallet/app-flows";
import { useWalletTransactionHistory } from "@prl-wallet/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { satoshisToDisplay } from "@/lib/satoshisToDisplay";
import { getNetworkInfo } from "@/lib/getNetworkInfo";
import { getBlockbookClient } from "@/lib/getBlockbookClient";
import { scopedFetch } from "@/platform/scopedFetch";
import { explorerUrl, relativeTime, shortTxid } from "@/lib/explorerUrl";

export function TransactionsScreen() {
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

  const historyResult = useWalletTransactionHistory(client, addresses);

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
          <h1 className="text-xl font-semibold leading-snug">Transactions</h1>
          <p className="text-xs text-muted-foreground mt-1">{wallet.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => historyResult.refetch()}
          disabled={historyResult.isFetching || !networkGateOpen}
          aria-label="Refresh transactions"
          className="h-9"
        >
          {historyResult.isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </header>

      {/* Loading state — shown while addresses are being discovered, the
          first balance/history fetch is in flight, or the user hit Refresh
          on a previously-empty list. Without this guard the screen shows
          "No transactions yet" before data has had a chance to arrive. */}
      {isDiscovering ||
      historyResult.isLoading ||
      (historyResult.transactions.length === 0 && historyResult.isFetching) ? (
        <Card className="p-12 text-center flex flex-col items-center gap-3">
          <Loader2
            className="size-6 animate-spin text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">Loading transactions…</p>
        </Card>
      ) : historyResult.isError ? (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold leading-snug mb-2 text-destructive">
            Couldn't load transactions
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            The Blockbook fetch failed. Watching {addresses.length} address
            {addresses.length === 1 ? "" : "es"}.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => historyResult.refetch()}
          >
            Retry
          </Button>
        </Card>
      ) : historyResult.transactions.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-xl font-semibold leading-snug mb-2">
            No transactions yet
          </h3>
          <p className="text-sm text-muted-foreground">
            {addresses.length === 0
              ? "Address discovery returned no addresses for this wallet."
              : `Watching ${addresses.length} address${
                  addresses.length === 1 ? "" : "es"
                }. When you send or receive, transactions will appear here.`}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid gap-1 p-2">
            {historyResult.transactions.map((tx) => {
              const url = explorerUrl(wallet.networkId, tx.txid);
              const isNegative = tx.netSatoshis < 0n;
              const sign = isNegative ? "−" : "+";
              const magnitude = (
                isNegative ? -tx.netSatoshis : tx.netSatoshis
              ).toString();
              const ts = tx.blockTime;
              return (
                <div
                  key={tx.txid}
                  className="group flex items-center justify-between gap-4 p-3 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {ts ? relativeTime(ts) : "Pending"}
                    </p>
                    <p
                      className="text-xs font-mono mt-0.5 truncate"
                      title={tx.txid}
                    >
                      {shortTxid(tx.txid)}
                    </p>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        View on explorer
                      </a>
                    )}
                  </div>
                  <p className="text-sm tabular-nums whitespace-nowrap">
                    {sign}
                    {satoshisToDisplay(magnitude)} {blockchainName}
                  </p>
                  <CopyButton
                    variant="icon"
                    onCopy={() => ports.clipboard.setString(tx.txid)}
                    ariaLabel="Copy transaction ID"
                    className="h-6 w-6 p-0 [&>svg]:size-3.5"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t bg-card">
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing {historyResult.transactions.length}
              {historyResult.hasMore ? "+" : ""}
            </p>
            {historyResult.hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => historyResult.fetchMore()}
                disabled={historyResult.isFetchingMore}
              >
                {historyResult.isFetchingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
