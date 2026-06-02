// apps/desktop/src/lib/satoshisToDisplay.ts
//
// Pure TS helper.
// Verbatim port from apps/mobile/src/screens/WalletList/WalletListScreen.tsx
// lines 47-52 (mobile parity).
//
// T-20-09: returns "—" (em-dash) for both undefined input and isNaN cases
// so balance cards never render "NaN BTC".

export function satoshisToDisplay(sats?: string): string {
  if (!sats) return "—";
  const n = parseInt(sats, 10);
  if (isNaN(n)) return "—";
  return (n / 100_000_000).toFixed(8).replace(/\.?0+$/, "");
}
