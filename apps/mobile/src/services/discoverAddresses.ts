import {
  deriveChildKey,
  p2trAddress,
  BIP32,
  mnemonicToSeed,
} from "@prl-wallet/core";
import type { BlockbookClientLike } from "@prl-wallet/api-client";
import { BLOCKCHAINS, buildDerivationPath } from "@prl-wallet/config";
import type { Network } from "bitcoinjs-lib";
import { getMnemonic, getBIP32Seed, getXpub } from "./secureStorage";
import type { WalletType } from "../store/walletListStore";

// NOTE: callers updated in

const GAP_LIMIT = 5;

export interface DerivedAddress {
  index: number;
  address: string;
  hasTransactions: boolean;
}

/** Resolve the bitcoinjs-lib Network and bip86Path builder for a given networkId. */
function resolveNetwork(networkId: string): {
  network: Network;
  bip86Path: (account?: number, change?: number, index?: number) => string;
} {
  const cfg = BLOCKCHAINS.flatMap((bc) => bc.networks).find(
    (n) => n.id === networkId,
  );
  if (!cfg) throw new Error(`Unknown networkId: "${networkId}"`);
  return {
    network: cfg.bitcoinNetwork as unknown as Network,
    bip86Path: (account = 0, change = 0, index = 0) =>
      buildDerivationPath(
        cfg.bip86CoinType,
        account,
        change,
        index,
        cfg.derivationPathTemplate,
      ),
  };
}

/**
 * Scan the HD derivation path (m/86'/coin'/0'/0/i) starting at index 0,
 * collecting addresses until GAP_LIMIT consecutive unused addresses are found.
 * Returns all scanned DerivedAddress entries and the receiveAddressIndex
 * (array index of the first unused address).
 */
export async function discoverFromSeed(
  client: BlockbookClientLike,
  seed: Buffer,
  networkId: string,
): Promise<{
  derivedAddresses: DerivedAddress[];
  receiveAddressIndex: number;
}> {
  const { network, bip86Path } = resolveNetwork(networkId);
  const results: DerivedAddress[] = [];
  let gap = 0;
  let index = 0;

  while (gap < GAP_LIMIT) {
    const path = bip86Path(0, 0, index);
    const { xOnlyPubkey } = deriveChildKey(seed, network, path);
    const addr = p2trAddress(xOnlyPubkey, network);

    let hasTxs = false;
    try {
      const info = await client.getAddress(addr, 1, 1);
      hasTxs = info.txs > 0;
    } catch {
      // Network error — treat as empty, keep counting gap
    }

    results.push({ index, address: addr, hasTransactions: hasTxs });

    if (hasTxs) {
      gap = 0;
    } else {
      gap++;
    }

    index++;
  }

  const firstUnused = results.findIndex((r) => !r.hasTransactions);
  if (firstUnused === -1) {
    // All addresses have transactions — derive one more as the receive address
    const path = bip86Path(0, 0, index);
    const { xOnlyPubkey } = deriveChildKey(seed, network, path);
    const addr = p2trAddress(xOnlyPubkey, network);
    results.push({ index, address: addr, hasTransactions: false });
    return { derivedAddresses: results, receiveAddressIndex: index };
  }

  return { derivedAddresses: results, receiveAddressIndex: firstUnused };
}

/**
 * Gap-limit discovery for xpub (account-level) watch-only wallets.
 * The stored xpub is an account-level key; child addresses are derived as
 * accountNode.derive(0 = external chain).derive(index).
 * Hardened derivation is not possible from a public key, so this requires
 * the account-level xpub (not the master xpub).
 */
export async function discoverFromXpub(
  client: BlockbookClientLike,
  accountNode: ReturnType<typeof BIP32.fromBase58>,
  networkId: string,
): Promise<{
  derivedAddresses: DerivedAddress[];
  receiveAddressIndex: number;
}> {
  const { network } = resolveNetwork(networkId);
  const externalChain = accountNode.derive(0);
  const results: DerivedAddress[] = [];
  let gap = 0;
  let index = 0;

  while (gap < GAP_LIMIT) {
    const child = externalChain.derive(index);
    const xOnlyPubkey = child.publicKey.slice(1);
    const addr = p2trAddress(xOnlyPubkey, network);

    let hasTxs = false;
    try {
      const info = await client.getAddress(addr, 1, 1);
      hasTxs = info.txs > 0;
    } catch {
      // Network error — treat as empty, keep counting gap
    }

    results.push({ index, address: addr, hasTransactions: hasTxs });

    if (hasTxs) {
      gap = 0;
    } else {
      gap++;
    }

    index++;
  }

  const firstUnused = results.findIndex((r) => !r.hasTransactions);
  if (firstUnused === -1) {
    const child = externalChain.derive(index);
    const xOnlyPubkey = child.publicKey.slice(1);
    const addr = p2trAddress(xOnlyPubkey, network);
    results.push({ index, address: addr, hasTransactions: false });
    return { derivedAddresses: results, receiveAddressIndex: index };
  }

  return { derivedAddresses: results, receiveAddressIndex: firstUnused };
}

/**
 * Read the wallet credential from SecureStore and run gap-limit address
 * discovery. Handles all supported HD wallet types:
 * "mnemonic" → reads mnemonic, derives seed, calls discoverFromSeed
 * "bip32Seed" → reads stored seed data:
 * hex (64–128 chars) → Buffer → discoverFromSeed
 * extended key → BIP32.fromBase58 → discoverFromRoot
 *
 * Returns null for non-HD wallet types (xpub, wif) or if the credential
 * cannot be read from SecureStore.
 */
export async function discoverWalletAddresses(
  client: BlockbookClientLike,
  walletId: string,
  walletType: WalletType | null,
  networkId: string,
): Promise<{
  derivedAddresses: DerivedAddress[];
  receiveAddressIndex: number;
} | null> {
  if (walletType === "mnemonic") {
    const mnemonic = await getMnemonic(walletId);
    if (!mnemonic) return null;
    const seed = await mnemonicToSeed(mnemonic);
    return discoverFromSeed(client, seed, networkId);
  }

  if (walletType === "bip32Seed") {
    const seedData = await getBIP32Seed(walletId);
    if (!seedData) return null;

    if (/^[0-9a-fA-F]{64,128}$/.test(seedData) && seedData.length % 2 === 0) {
      // Raw hex seed (32–64 bytes)
      return discoverFromSeed(client, Buffer.from(seedData, "hex"), networkId);
    }

    // Extended private key (xprv, zprv, tprv, etc. — validated by BIP32.fromBase58 against network version bytes)
    const { network } = resolveNetwork(networkId);
    const root = BIP32.fromBase58(seedData, network);
    return discoverFromRoot(client, root, networkId);
  }

  if (walletType === "xpub") {
    const xpubData = await getXpub(walletId);
    if (!xpubData) return null;
    const { network } = resolveNetwork(networkId);
    const accountNode = BIP32.fromBase58(xpubData, network);
    return discoverFromXpub(client, accountNode, networkId);
  }

  // wif (single key, non-HD) — no derivation path to scan
  return null;
}

/**
 * Same gap-limit discovery as discoverFromSeed but accepts an already-parsed
 * BIP32 root node (e.g. from BIP32.fromBase58 for an extended private key).
 * Uses root.derivePath instead of deriveChildKey so the key material
 * is never re-interpreted as raw entropy.
 */
export async function discoverFromRoot(
  client: BlockbookClientLike,
  root: ReturnType<typeof BIP32.fromBase58>,
  networkId: string,
): Promise<{
  derivedAddresses: DerivedAddress[];
  receiveAddressIndex: number;
}> {
  const { network, bip86Path } = resolveNetwork(networkId);
  const results: DerivedAddress[] = [];
  let gap = 0;
  let index = 0;

  while (gap < GAP_LIMIT) {
    const path = bip86Path(0, 0, index);
    const childNode = root.derivePath(path);
    const xOnlyPubkey = childNode.publicKey.slice(1);
    const addr = p2trAddress(xOnlyPubkey, network);

    let hasTxs = false;
    try {
      const info = await client.getAddress(addr, 1, 1);
      hasTxs = info.txs > 0;
    } catch {
      // Network error — treat as empty, keep counting gap
    }

    results.push({ index, address: addr, hasTransactions: hasTxs });

    if (hasTxs) {
      gap = 0;
    } else {
      gap++;
    }

    index++;
  }

  const firstUnused = results.findIndex((r) => !r.hasTransactions);
  if (firstUnused === -1) {
    const path = bip86Path(0, 0, index);
    const childNode = root.derivePath(path);
    const xOnlyPubkey = childNode.publicKey.slice(1);
    const addr = p2trAddress(xOnlyPubkey, network);
    results.push({ index, address: addr, hasTransactions: false });
    return { derivedAddresses: results, receiveAddressIndex: index };
  }

  return { derivedAddresses: results, receiveAddressIndex: firstUnused };
}
