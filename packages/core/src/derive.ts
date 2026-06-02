// packages/core/src/derive.ts
// Source: bitcoinjs-lib taproot.spec.ts pattern + BIP86 spec

import { BIP32 } from "./ecc.js";
import { mnemonicToSeed } from "@scure/bip39";
import { payments } from "bitcoinjs-lib";
import type { Network } from "bitcoinjs-lib";

// x-only pubkey for Taproot (strip the 02/03 prefix byte)
function toXOnly(pubkey: Uint8Array): Uint8Array {
  return pubkey.slice(1, 33);
}

export interface DeriveResult {
  mnemonic: string;
  seed: string; // hex string
  rootXpub: string;
  address: string;
  internalPubkey: string; // hex string
}

export async function deriveP2TRAddress(
  mnemonic: string,
  network: Network,
  bip86PathFn: (account?: number, change?: number, index?: number) => string,
): Promise<DeriveResult> {
  const seedBytes = await mnemonicToSeed(mnemonic);
  const seed = Buffer.from(seedBytes);

  const root = BIP32.fromSeed(seed, network);
  const child = root.derivePath(bip86PathFn());
  const xOnly = Buffer.from(toXOnly(child.publicKey));
  const { address } = payments.p2tr({
    internalPubkey: xOnly,
    network,
  });

  if (!address) throw new Error("Failed to derive P2TR address");

  return {
    mnemonic,
    seed: seed.toString("hex"),
    rootXpub: root.neutered().toBase58(),
    address,
    internalPubkey: xOnly.toString("hex"),
  };
}
