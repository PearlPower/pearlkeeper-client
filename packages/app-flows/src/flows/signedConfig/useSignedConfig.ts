// packages/app-flows/src/flows/signedConfig/useSignedConfig.ts — ,
//
// TanStack Query hook over the SignedConfigPort. ships the
// surface; consumers land in .1 (chain-config cutover —
// replaces ~30+ BLOCKCHAINS callers) and (UpdateBanner
// consumes version-manifest).
//
// The hook accepts the port as an explicit argument rather
// than reading from context — .1 will wrap this in a
// context-reading helper after wiring `signedConfig` into ServicesPorts
// in mobile + desktop createServicePorts.ts.
//
// Source field () approximates today: "loading" | "fresh" | "error".
// Threading "last-known-good" vs "bundled-fallback" through the
// adapter return type is deferred to a follow-up; the surface allows
// for it without breaking changes.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  SignedConfigUnavailableError,
  type SignedConfigPort,
  type ChainConfigPayload,
  type VersionManifestPayload,
} from "@prl-wallet/services";

/**
 * Mapping from `SignedPayloadType` literal → matching payload type.
 * Lets `useSignedConfig` infer the correct return type from the
 * `type` argument alone — callers don't have to thread an explicit
 * generic.
 */
export type PayloadByType<T> = T extends "chain-config"
  ? ChainConfigPayload
  : T extends "version-manifest"
    ? VersionManifestPayload
    : never;

/**
 * source field — discriminated union of 5 states. only
 * surfaces 3 (loading | fresh | error); the remaining two
 * (`last-known-good`, `bundled-fallback`) require the adapter to
 * thread a source label through its return shape, which is deferred
 * to a follow-up plan. The type lands now so consumers can switch on
 * all 5 states without a breaking change later.
 */
export type SignedConfigSource =
  | "loading"
  | "fresh"
  | "last-known-good"
  | "bundled-fallback"
  | "error";

/**
 * The implemented payload type literals. Excludes reserved-1 /
 * reserved-2 from `SignedPayloadType` — those routes 404 ().
 */
export type ImplementedSignedPayloadType = "chain-config" | "version-manifest";

export interface UseSignedConfigResult<T> {
  /** Parsed payload, undefined while loading or on error. */
  data: T | undefined;
  /** True until the first response (success or error) lands. */
  isLoading: boolean;
  /** True if the underlying TanStack query rejected. */
  isError: boolean;
  /** The rejection value (`unknown` per TanStack convention). */
  error: unknown;
  /** Discriminated source label per (3-state in ). */
  source: SignedConfigSource;
  /** Escape-hatch — full TanStack `UseQueryResult` for advanced consumers. */
  query: UseQueryResult<T>;
}

function dispatchByType<T extends ImplementedSignedPayloadType>(
  port: SignedConfigPort,
  type: T,
): Promise<PayloadByType<T>> {
  switch (type) {
    case "chain-config":
      return port.getChainConfig() as Promise<PayloadByType<T>>;
    case "version-manifest":
      return port.getVersionManifest() as Promise<PayloadByType<T>>;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown signed payload type: ${exhaustive as string}`);
    }
  }
}

/**
 * TanStack Query hook over the SignedConfigPort.
 *
 * staleTime matches the backend cache TTL (5 min). gcTime is 24h —
 * last-known-good in StoragePort outlives the in-memory query cache.
 * retry: 0 because the adapter handles fallback already; TanStack
 * retries would re-roll the StoragePort write.
 *
 * : source field is 3-state (loading | fresh | error).
 * .1+: adapter surfaces "last-known-good" / "bundled-fallback"
 * via a return shape extension; the hook reads the new field and
 * surfaces it through the same `source` discriminator without breaking
 * existing consumers.
 *
 * REGISTERED BUT UNUSED in () — this hook compiles + tests
 * pass, but no code consumes it. .1 (chain-config
 * cutover) and (UpdateBanner) are the actual consumers.
 *
 * @param port - SignedConfigPort instance from createServicePorts.
 * .1 wraps this in a context-reading helper after wiring
 * `signedConfig` into ServicesPorts.
 * @param type - One of the 4 implemented payload types.
 */
export function useSignedConfig<T extends ImplementedSignedPayloadType>(
  port: SignedConfigPort,
  type: T,
): UseSignedConfigResult<PayloadByType<T>> {
  const query = useQuery<PayloadByType<T>>({
    queryKey: ["signed-config", type],
    queryFn: () => dispatchByType(port, type),
    staleTime: 5 * 60_000, // 5 min — matches backend cache TTL.
    gcTime: 24 * 60 * 60_000, // 24h — last-known-good in storage outlives cache.
    // : bounded retry for transient errors. The adapter has
    // mixed throw semantics:
    // getChainConfig is NEVER-rejecting (returns bundled fallback)
    // getVersionManifest MAY throw SignedConfigUnavailableError
    // when backend is unreachable AND no LKG AND no bundled fallback
    // Retrying SignedConfigUnavailableError is pointless — the adapter
    // already exhausted its fallback chain. For other transient errors
    // (rare — most are caught inside the adapter), do up to 2 retries
    // with TanStack's default exponential backoff so a brief network
    // blip doesn't wedge the consumer until window-focus refetch.
    retry: (failureCount, error) => {
      if (error instanceof SignedConfigUnavailableError) return false;
      return failureCount < 2;
    },
  });

  // source discrimination — 3-state. .1+ extends to
  // 5-state once the adapter threads source through its return.
  const source: SignedConfigSource = query.isLoading
    ? "loading"
    : query.isError
      ? "error"
      : "fresh";

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    source,
    query,
  };
}
