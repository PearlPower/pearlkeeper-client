// packages/core/src/address.ts
// P2TR address generation — pure function, no classes
import { payments } from "bitcoinjs-lib";
import type { Network } from "bitcoinjs-lib";
// Importing ecc.ts ensures initEccLib() is called before payments.p2tr
import "./ecc.js";

/**
 * Generate a P2TR (Taproot) address from an x-only 32-byte pubkey.
 * Uses bech32m encoding — address prefix is determined by network.bech32.
 */
export function p2trAddress(xOnlyPubkey: Uint8Array, network: Network): string {
  const { address } = payments.p2tr({
    internalPubkey: Buffer.from(xOnlyPubkey),
    network,
  });
  if (!address) throw new Error("Failed to derive P2TR address");
  return address;
}
