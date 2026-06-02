// packages/app-flows/src/flows/formatFiat.ts — .
//
// Shared fiat formatter consumed across mobile + desktop UI surfaces.
// Introduced in once 4+ call sites materialized ( plan-time
// decision rule):
// 1. SendAmountScreen (mobile + desktop) — fiat sublabel below the
// amount input.
// 2. SendFeeScreen / FeeTierList (mobile + desktop) — per-tier fiat
// sublabel × 4 tiers.
// 3. WalletDetailScreen (mobile + desktop) — fiat balance sublabel.
// 4. useSendFee — populates FeeTierOption.estimatedFiatDisplay.
//
// Locked tokens ():
// `≈` (U+2248 ALMOST EQUAL TO) precedes every value to signal an
// approximation (price feed is advisory per FEE-PRICE-05).
// `—` (U+2014 EM DASH) is the unavailable token. Avoid `N/A`, `?`,
// blank, `0` (which is a real value).
//
// Format math ():
// Uses `Intl.NumberFormat("en-US", { style: "currency", currency:
// "USD", maximumFractionDigits: 2 })` — produces e.g. `$65,432.10`.
// Suffixed with ` USD` so the literal currency symbol is reinforced
// and screen-reader output is unambiguous.

const FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/**
 * Returns `≈ $X.XX USD` when value is a finite number; `≈ —` otherwise.
 *
 * The em-dash branch is the locked unavailable token across UI
 * (). Callers MUST NOT post-process the return value beyond direct
 * rendering — the prefix `≈` and suffix ` USD` are part of the contract.
 */
export function formatFiat(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "≈ —";
  return `≈ ${FORMATTER.format(value)} USD`;
}
