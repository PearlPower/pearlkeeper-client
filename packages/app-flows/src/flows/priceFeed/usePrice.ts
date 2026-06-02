// packages/app-flows/src/flows/priceFeed/usePrice.ts — .
//
// TanStack Query hook over the PriceFeedPort. Single shared queryKey
// (`["price-feed"]`) for both BTC + PRL — both hooks subscribe to the
// same TanStack cache entry, the symbol arg only routes which field is
// surfaced. Reduces redundant network calls (the wire envelope always
// carries BTC + PRL together).
//
// Cache parameters per :
// queryKey: ["price-feed"]
// staleTime: 60_000 (60s — matches backend cron tick)
// gcTime: 24h (LKG in StoragePort outlives in-memory cache)
// retry: 0 (adapter handles fallback already)
//
// PRL_USD may be permanently null even when source="live" if no
// upstream source lists PRL ( PRL fallback policy). The hook
// surfaces that as `usd: null`; UI renders `—` (em-dash, ).

import { useQuery } from "@tanstack/react-query";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { PriceSnapshotWithMeta } from "@prl-wallet/services";

export interface UsePriceResult {
  /** Latest USD price for the requested symbol; null when unavailable. */
  usd: number | null;
  /** True when the snapshot came from LKG fallback (offline + cached). */
  isStale: boolean;
  /** True when neither network nor LKG had a usable value. */
  isUnavailable: boolean;
  /** Last-success Unix epoch ms; null if no successful refresh ever. */
  asOf: number | null;
  /** TanStack-derived loading flag for the first response. */
  isLoading: boolean;
}

/**
 * TanStack Query hook for the price feed. Single shared
 * queryKey for all symbols; the `symbol` argument only selects which
 * field of the cached snapshot to surface. Returns `usd: null` when:
 * `symbol` is null (e.g., wallet not yet loaded — caller doesn't yet
 * know which chain to ask about)
 * the symbol isn't in the snapshot (e.g., PRL not listed by any source)
 * the entire snapshot is unavailable (offline + no LKG)
 *
 * The port is read from `useAdapters().services.priceFeed` (the
 * AdaptersBundle exposes ServicesPorts as `services`). When the port
 * is undefined (test factories that don't exercise fee/price flows),
 * the queryFn returns the unavailable shape — matches the adapter's
 * NEVER-rejecting contract ().
 *
 * BOUNDARY: this file is the single allowed site that maps an
 * application-level `symbol` string to wire-shape `*_USD` fields. Every
 * other module reads symbols dynamically from blockchains.json via
 * `getNetworkMetadata`. The mapping below is allowlisted in the
 * `no-restricted-syntax` rule against hardcoded asset symbols.
 */
// eslint-disable-next-line no-restricted-syntax -- wire-shape boundary
export function usePrice(symbol: string | null): UsePriceResult {
  const { services } = useAdapters();
  const port = services.priceFeed;

  const query = useQuery<PriceSnapshotWithMeta>({
    queryKey: ["price-feed"] as const,
    queryFn: async (): Promise<PriceSnapshotWithMeta> => {
      if (!port) {
        return {
          BTC_USD: null,
          PRL_USD: null,
          source: "unavailable",
          asOf: null,
        };
      }
      return port.getPrices();
    },
    staleTime: 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
    enabled: symbol !== null,
  });

  const result = query.data;
  // eslint-disable-next-line no-restricted-syntax -- wire-shape boundary
  const usd = symbolToUsd(symbol, result);

  return {
    usd,
    isStale: result?.source === "stale",
    isUnavailable: result?.source === "unavailable",
    asOf: result?.asOf ?? null,
    // : see useFeeOracle.ts for the same rationale — TanStack v5
    // `isLoading` can be false during a fresh-key transition when the
    // previous key had cached data; `isPending` is the broader "no data
    // yet" indicator. Gated by symbol so it stays false when disabled.
    isLoading: symbol !== null && query.isPending,
  };
}

/**
 * Wire-shape adapter: maps `assetSymbol` strings (from blockchains.json) to
 * the corresponding USD field on `PriceSnapshotWithMeta`. The hardcoded
 * symbol comparisons live ONLY in this function; every other module sees
 * only `string | null`. If the price-feed wire schema gains a new symbol
 * field, extend the mapping here.
 */
// eslint-disable-next-line no-restricted-syntax -- wire-shape boundary
function symbolToUsd(
  symbol: string | null,
  snapshot: PriceSnapshotWithMeta | undefined,
): number | null {
  if (!symbol || !snapshot) return null;
  // eslint-disable-next-line no-restricted-syntax -- wire-shape boundary
  if (symbol === "BTC") return snapshot.BTC_USD ?? null;
  // eslint-disable-next-line no-restricted-syntax -- wire-shape boundary
  if (symbol === "PRL") return snapshot.PRL_USD ?? null;
  return null;
}
