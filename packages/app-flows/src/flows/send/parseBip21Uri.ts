// packages/app-flows/src/flows/send/parseBip21Uri.ts
// shared BIP21 parser. Lifted from
// apps/desktop/src/screens/Send/SendAddressScreen.tsx:26-38 inline impl.
// Mobile + desktop SendAddressScreen consume from this single source.
//
// Signature: prefix is `string` (NOT a string-literal union) so callers can
// thread `getNetworkMetadata(networkId).bip21Prefix` (typed `string`) without
// a manual cast. Empty prefix → returns null (defense-in-depth: avoids
// returning the entire input as the address).

export function parseBip21Uri(
  input: string,
  prefix: string,
): { address: string; amount?: string } | null {
  const scheme = prefix ? `${prefix}:` : "";
  if (!scheme || !input.startsWith(scheme)) return null;
  const rest = input.slice(scheme.length);
  const [addr, query] = rest.split("?");
  const amount = query
    ? new URLSearchParams(query).get("amount") ?? undefined
    : undefined;
  return { address: addr ?? "", amount };
}
