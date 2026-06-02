// apps/desktop/src/lib/explorerUrl.ts
//
// Resolves the per-network `explorerTxUrlTemplate` from blockchains.json
// (the canonical source for chain-protocol config). Returns null for
// networks without a public explorer (PRL today). Returned URLs are
// user-click deep links opened in the OS default browser — the wallet
// process never issues HTTP to them; the "clients only call the backend"
// invariant is preserved. This file is in the no-restricted-syntax
// override list in .eslintrc.cjs.
import { BLOCKCHAINS } from "@prl-wallet/config";

const TEMPLATE_BY_NETWORK_ID: ReadonlyMap<string, string | null> = new Map(
  BLOCKCHAINS.flatMap((bc) =>
    bc.networks.map((n) => [n.id, n.explorerTxUrlTemplate] as const),
  ),
);

export function explorerUrl(networkId: string, txid: string): string | null {
  if (!TEMPLATE_BY_NETWORK_ID.has(networkId)) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[explorerUrl] unknown networkId: ${networkId}`);
    }
    return null;
  }
  const template = TEMPLATE_BY_NETWORK_ID.get(networkId) ?? null;
  return template ? template.replace("{txid}", txid) : null;
}

export function relativeTime(blockTimeSeconds: number): string {
  const diffMs = Date.now() - blockTimeSeconds * 1000;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function shortTxid(txid: string): string {
  if (txid.length <= 16) return txid;
  return `${txid.slice(0, 8)}…${txid.slice(8)}`;
}
