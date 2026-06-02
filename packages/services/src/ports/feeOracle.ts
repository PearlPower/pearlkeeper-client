// packages/services/src/ports/feeOracle.ts — .
//
// FeeOraclePort — consumer-facing interface for the fee oracle. The
// adapter (packages/api-client/src/feeOraclePortAdapter.ts) ships the
// only production implementor; tests can construct stub implementations
// from this interface alone.
//
// Method semantics (, ):
// getFees: NEVER-rejecting. Online → fresh; offline + populated
// storage → last-known-good with source="stale"; offline + empty
// storage → returns rates=null with source="unavailable" (UI shows
// `—` em-dash via FALLBACK_RATES path in useSendFee).
//
// `LiveRates` is defined inline here (NOT re-exported from app-flows) to
// keep the services package free of an app-flows dep. Mirrors the Phase
// 30 SignedConfigPort approach of inlining payload type re-exports.
import type { NetworkId } from "@prl-wallet/api-schemas";

export const FEE_ORACLE_PORT_METHODS = ["getFees"] as const;

/**
 * : 3-tier sat/vbyte rates. Wire-shape numbers — matches the
 * FeeOracleResponse schema and stays JSON-serializable so the TanStack
 * cache can be wired to `@tanstack/react-query-persist-client` without
 * `Do not know how to serialize a BigInt` errors. The send-flow's
 * internal `LiveRates` (packages/app-flows/src/flows/send/types.ts) uses
 * BigInt for tier arithmetic; consumers convert at the boundary via
 * `liveRatesToBigInt` (packages/app-flows/src/flows/feeOracle/liveRatesConversion.ts).
 */
export interface LiveRates {
  slow: number;
  medium: number;
  fast: number;
}

/**
 * + : adapter return shape. `rates` is null when source is
 * "unavailable" OR when the LKG cache is older than the 5min validity
 * window (). `asOf` is null only when no LKG ever existed.
 */
export interface LiveRatesWithMeta {
  rates: LiveRates | null;
  source: "live" | "stale" | "unavailable";
  asOf: number | null;
}

export interface FeeOraclePort {
  getFees(networkId: NetworkId): Promise<LiveRatesWithMeta>;
}
