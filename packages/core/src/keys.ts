// packages/core/src/keys.ts
// BIP86 key derivation — pure functions, no classes
import { BIP32 } from "./ecc.js";
import type { Network } from "bitcoinjs-lib";

export interface DerivedChild {
  xOnlyPubkey: Uint8Array; // 32-byte x-only pubkey for P2TR
  childNode: ReturnType<typeof BIP32.fromSeed>; // BIP32Interface — has .tweak()
  accountXpub: string; // Base58 xpub at account depth (m/86'/coin'/account')
}

/**
 * Derive a BIP86 child key from a raw seed buffer.
 * path: full BIP86 path e.g. "m/86'/808276'/0'/0/0"
 */
export function deriveChildKey(
  seed: Buffer,
  network: Network,
  path: string,
): DerivedChild {
  const root = BIP32.fromSeed(seed, network);
  // Account xpub: first 4 path segments (m/purpose'/coin'/account')
  const accountPath = path.split("/").slice(0, 4).join("/");
  const accountXpub = root.derivePath(accountPath).neutered().toBase58();
  const childNode = root.derivePath(path);
  const xOnlyPubkey = childNode.publicKey.slice(1); // strip 02/03 prefix
  return { xOnlyPubkey, childNode, accountXpub };
}

/**
 * Derive account-level xpub only (no child key, no private key exposure).
 * accountPath: e.g. "m/86'/808276'/0'"
 */
export function getXpub(
  seed: Buffer,
  network: Network,
  accountPath: string,
): string {
  const root = BIP32.fromSeed(seed, network);
  return root.derivePath(accountPath).neutered().toBase58();
}

/**
 * Derive the account node (BIP32Interface) for further child derivation.
 * accountPath: e.g. "m/86'/808276'/0'"
 */
export function deriveAccountNode(
  seed: Buffer,
  network: Network,
  accountPath: string,
) {
  const root = BIP32.fromSeed(seed, network);
  return root.derivePath(accountPath);
}
