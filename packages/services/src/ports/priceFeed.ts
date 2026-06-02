// packages/services/src/ports/priceFeed.ts — .
//
// PriceFeedPort — consumer-facing interface for the BTC/PRL fiat price
// feed. The adapter (packages/api-client/src/priceFeedPortAdapter.ts)
// ships the only production implementor; tests can construct stub
// implementations from this interface alone.
//
// Method semantics (, ):
// getPrices: NEVER-rejecting. Online → fresh; offline + populated
// storage → last-known-good with source="stale"; offline + empty
// storage → returns BTC_USD=null + PRL_USD=null with
// source="unavailable" (UI renders `—` em-dash).
//
// PRL_USD may be permanently null even on `source: "live"` if no
// upstream source lists PRL ( PRL fallback policy).

export const PRICE_FEED_PORT_METHODS = ["getPrices"] as const;

/**
 * + : adapter return shape. Floats permitted for prices (cents
 * matter). Either symbol may be null even when source="live" (PRL
 * fallback policy). `asOf` is null only when no LKG ever existed.
 */
export interface PriceSnapshotWithMeta {
  BTC_USD: number | null;
  PRL_USD: number | null;
  source: "live" | "stale" | "unavailable";
  asOf: number | null;
}

export interface PriceFeedPort {
  getPrices(): Promise<PriceSnapshotWithMeta>;
}
