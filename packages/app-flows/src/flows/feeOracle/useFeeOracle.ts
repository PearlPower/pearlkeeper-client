// packages/app-flows/src/flows/feeOracle/useFeeOracle.ts — .
//
// TanStack Query hook over the FeeOraclePort. Mirrors the canonical
// useQuery factory pattern from packages/blockbook/src/hooks.ts and
// the useSignedConfig precedent (factory-style hook over a
// services port).
//
// The port is read from `useAdapters().services.feeOracle` (the
// AdaptersBundle exposes ServicesPorts as `services`, NOT `ports.X`).
// When the port is undefined (test factories that don't exercise
// fee/price flows), the queryFn returns the unavailable shape so the
// hook never throws — matches the adapter's NEVER-rejecting contract
// ().
//
// Cache parameters per :
// queryKey: ["fee-oracle", networkId]
// staleTime: 30_000 (30s — matches backend cron tick)
// gcTime: 24h (LKG in StoragePort outlives in-memory cache)
// retry: 0 (adapter handles fallback already)

import { useQuery } from "@tanstack/react-query";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { LiveRates, LiveRatesWithMeta } from "@prl-wallet/services";
import type { NetworkId } from "@prl-wallet/api-schemas";

export interface UseFeeOracleResult {
  /** LiveRates BigInt-tier shape, or null when unavailable. */
  data: LiveRates | null;
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
 * TanStack Query hook for fee oracle. Returns LiveRates+meta
 * from FeeOraclePort.getFees(networkId), surfaced via a flat
 * UseFeeOracleResult shape that send-flow contexts feed directly into
 * `useSendFee({ liveRates: data })`.
 *
 * Pass `networkId: null` when the wallet hasn't loaded yet — the query
 * stays disabled and the hook returns the unavailable shape. Callers
 * MUST NOT substitute a hardcoded default like "btc-mainnet" because
 * that network may be disabled in blockchains.json.
 */
export function useFeeOracle(networkId: NetworkId | null): UseFeeOracleResult {
  const { services } = useAdapters();
  const port = services.feeOracle;

  const query = useQuery<LiveRatesWithMeta>({
    queryKey: ["fee-oracle", networkId] as const,
    queryFn: async (): Promise<LiveRatesWithMeta> => {
      if (!port || !networkId) {
        return { rates: null, source: "unavailable", asOf: null };
      }
      return port.getFees(networkId);
    },
    staleTime: 30_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
    enabled: networkId !== null && networkId.length > 0,
  });

  const result = query.data;
  return {
    data: result?.rates ?? null,
    isStale: result?.source === "stale",
    isUnavailable: result?.source === "unavailable",
    asOf: result?.asOf ?? null,
    // : use isPending instead of isLoading (TanStack v5
    // semantic — isLoading is `isPending && isFetching`, which can
    // be false during a fresh key switch when the previous query had
    // cached data, producing a phantom "ready but empty" state.
    // isPending is "no data yet for this key" regardless of fetch
    // state; gated by networkId so it stays false when the query
    // is disabled.
    isLoading: networkId !== null && query.isPending,
  };
}
