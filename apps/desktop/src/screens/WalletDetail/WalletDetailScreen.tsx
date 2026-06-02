// apps/desktop/src/screens/WalletDetail/WalletDetailScreen.tsx
//
// stacked sections + chronological tx list +
// Danger zone composed at the bottom.
//
// Live balance + history are sourced via `useWalletBalance` and
// `useWalletTransactionHistory` from `@prl-wallet/api-client` (both backed
// by `useGatedQuery` per /19 — T-20-37). This screen itself NEVER
// calls TanStack's raw query hook directly — verified by the plan's
// acceptance grep (T-20-37 mitigation).
//
// useWalletDetailFlow's actual return shape (verified at execute time):
// { addresses, deleteWallet, derivedAddresses, hasMultipleAddresses,
// isDiscovering, isRefreshing, networkId, openAddressList, openReceive,
// openSend, openTransactionHistory, persistBalance, refresh,
// usedAddressCount, wallet, walletType }
// It does NOT return `balance` or `history` directly — those come from
// the blockbook hooks called with `addresses`. The plan's <interfaces>
// block (lines 91-105) listed `balance`/`history`/`isLoading` as
// placeholders; the plan's <action> block explicitly told me to verify
// at execute time and adjust — this is the verified shape.
//
// W-7 explorer URL map LOCKED from packages/config/src/blockchains.json
// (verified at execute time: NO chain has a `blockExplorerUrl` field).
// BTC networks fall back to mempool.space's community explorer; ALL four
// PRL networks return null so their tx rows render WITHOUT a link.
// When a `blockExplorerUrl` field is added to blockchains.json, replace
// the switch with: `BLOCKCHAINS.flatMap(c=>c.networks).find(n=>n.id===
// networkId).blockExplorerUrl?.replace("{txid}", txid) ?? null`.
//
// Locked copy (UI-SPEC §WalletDetail lines 193-213 — DO NOT paraphrase):
// "Balance" / "Cached balance · offline" / "Send" / "Receive" /
// "Transactions" / "No transactions yet" /
// "When you send or receive, transactions will appear here." /
// "View on explorer"
//
// Unicode minus `−` (U+2212) used for negative tx amounts (NOT hyphen-minus).

import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import {
  formatFiat,
  getNetworkMetadata,
  usePrice,
  useWalletDetailFlow,
} from "@prl-wallet/app-flows";
import { useWalletBalance } from "@prl-wallet/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/CopyButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, RefreshCw } from "lucide-react";
import { satoshisToDisplay } from "@/lib/satoshisToDisplay";
import { getNetworkInfo } from "@/lib/getNetworkInfo";
import { getBlockbookClient } from "@/lib/getBlockbookClient";
import { scopedFetch } from "@/platform/scopedFetch";
import { DangerZone } from "./components/DangerZone";

export function WalletDetailScreen() {
  const { id: walletId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ports, stores } = useAdapters();
  const networkGateOpen = useStore(stores.networkGate, (s) => s.isOpen);

  const flow = useWalletDetailFlow({
    walletId: walletId ?? "",
    navigation: {
      goToSend: (id) => navigate(`/wallet/${id}/send`),
      goToReceive: (id) => navigate(`/wallet/${id}/receive`),
      goToTransactionList: () => {
        /* detail polish */
      },
      goToAddressList: () => {
        /* deferred */
      },
      goBack: () => navigate(1),
      popToTop: () => navigate("/wallets"),
      resetToRoot: () => navigate("/wallets"),
    },
  });

  const { wallet, addresses, isDiscovering, persistBalance, walletType } = flow;

  // T-20-37: ALL Blockbook traffic flows through useGatedQuery — this
  // screen never invokes the raw TanStack hooks directly. The wallet-balance
  // and wallet-transaction-history helpers wrap useGatedQuery internally;
  // closed gate cancels in-flight requests via the networkGate
  // subscription bound to the QueryClient ().
  const client = useMemo(
    () =>
      wallet
        ? getBlockbookClient(wallet.networkId, ports.networkGate, scopedFetch)
        : null,
    [ports.networkGate, wallet],
  );

  const balanceResult = useWalletBalance(client, addresses);

  // fiat balance sublabel. Symbol flows from
  // chain.assetSymbol in blockchains.json; `null` while the wallet hasn't
  // loaded (usePrice returns unavailable for null). PRL.USD is permanently
  // null per PRL fallback policy → ≈ — ( em-dash unavailable
  // token) on PRL wallets.
  const symbol = wallet
    ? getNetworkMetadata(wallet.networkId).assetSymbol
    : null;
  const price = usePrice(symbol);

  // Persist confirmed live balance back to the cache so WalletList renders
  // a fresh "—or last known—" value next time the user comes back.
  useEffect(() => {
    if (balanceResult.hasData) {
      persistBalance(balanceResult.confirmed.toString());
    }
  }, [balanceResult.confirmed, balanceResult.hasData, persistBalance]);

  // Defensive: if user back-navigates after delete, wallet is undefined →
  // bail to /wallets. Mobile parity (T-20-34).
  useEffect(() => {
    if (!isDiscovering && !wallet) navigate("/wallets", { replace: true });
  }, [wallet, isDiscovering, navigate]);

  if (!wallet) return null;

  const { blockchainName, networkName } = getNetworkInfo(wallet.networkId);
  const liveSats = balanceResult.hasData
    ? balanceResult.confirmed.toString()
    : undefined;

  // "Cached balance · offline" marker (UI-SPEC line 201, T-20-32):
  // shown when the network gate is closed AND we have no live data, so
  // the user knows the displayed value is stale and not refreshing.
  const showCachedMarker = !networkGateOpen && !balanceResult.hasData;

  const displaySats = liveSats ?? wallet.lastKnownBalance;

  return (
    <section className="max-w-2xl mx-auto px-6 py-8">
      {/*
        Back goes directly to /wallets (the hub), not navigate(1). WalletDetail
        is reachable from two paths: (a) /wallets list, (b) wizard completion
        (SetupSuccessScreen.resetToRoot replaces /done with /wallet/:id, leaving
        /wallet/new/name as the prior history entry). navigate(1) would land in
        wizard history after creation. /wallets is a top-level hub with no own
        Back button, so direct URL navigation is safe.
      */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/wallets")}
        className="mb-4"
      >
        ← Back
      </Button>
      <header className="mb-8">
        <h1 className="text-xl font-semibold leading-snug">{wallet.name}</h1>
        <Badge variant="outline" className="mt-2 text-xs font-semibold">
          {blockchainName} · {networkName}
        </Badge>
      </header>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Balance
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => balanceResult.refetch()}
            disabled={balanceResult.isFetching || !networkGateOpen}
            aria-label="Refresh balance"
            className="h-7 px-2"
          >
            {balanceResult.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
          </Button>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tabular-nums leading-tight">
            {satoshisToDisplay(displaySats)}
          </p>
          {balanceResult.isFetching && (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-label="Refreshing"
            />
          )}
        </div>
        {/* — fiat balance sublabel. ≈ — () when
            the price feed is unavailable; stale: opacity-70 +
            (stale) suffix. The math reads from displaySats (live or
            cached) so the sublabel renders both online + offline. */}
        <p
          data-testid="fiat-balance-sublabel"
          className={cn(
            "text-sm text-muted-foreground mt-1 tabular-nums",
            price.isStale && "opacity-70",
          )}
        >
          {price.usd == null
            ? "≈ —"
            : formatFiat(
                (Number(BigInt(displaySats ?? "0")) / 1e8) * price.usd,
              )}
          {price.isStale ? " (stale)" : ""}
        </p>
        {showCachedMarker && (
          <p className="text-xs text-muted-foreground mt-1">
            Cached balance · offline
          </p>
        )}
      </Card>

      {/* W-5 () — inline next-receive-address row with icon-only
          copy. Conditionally rendered: only shown when wallet.nextReceiveAddress
          is populated (graceful fallback for un-derived wallets). The icon-only
          CopyButton uses the same h-6 w-6 size override as the txid icon
          (W-4 invariant) so the row geometry stays compact. */}
      {wallet.nextReceiveAddress && (
        <Card
          className="p-3 mb-6 flex items-center justify-between gap-3"
          data-testid="next-receive-address-row"
        >
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Next receive address
            </span>
            <span className="text-sm font-mono break-all mt-1">
              {wallet.nextReceiveAddress}
            </span>
          </div>
          <CopyButton
            variant="icon"
            onCopy={() => ports.clipboard.setString(wallet.nextReceiveAddress!)}
            ariaLabel="Copy address"
            className="h-6 w-6 p-0 [&>svg]:size-3.5"
          />
        </Card>
      )}

      <div className="flex gap-3 mb-8">
        {walletType === "xpub" ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* span wrapper required: disabled Button does not fire pointer events for Tooltip */}
                <span tabIndex={0} className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                    aria-label="Send (watch-only wallets cannot send)"
                  >
                    Send
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Watch-only wallets cannot send.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate(`/wallet/${walletId}/send`)}
          >
            Send
          </Button>
        )}
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate(`/wallet/${walletId}/receive`)}
        >
          Receive
        </Button>
      </div>

      <div className="grid gap-3 mb-8">
        <Card className="p-0">
          <button
            type="button"
            onClick={() => navigate(`/wallet/${walletId}/transactions`)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-primary/5 transition-colors rounded-lg"
          >
            <span className="text-sm font-semibold">Transactions</span>
            <span className="text-xs text-muted-foreground">View all →</span>
          </button>
        </Card>
        <Card className="p-0">
          <button
            type="button"
            onClick={() => navigate(`/wallet/${walletId}/addresses`)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-primary/5 transition-colors rounded-lg"
          >
            <span className="text-sm font-semibold">Addresses</span>
            <span className="text-xs text-muted-foreground">View all →</span>
          </button>
        </Card>
      </div>

      <Separator className="my-8" />
      <DangerZone walletId={walletId!} walletName={wallet.name} />
    </section>
  );
}
