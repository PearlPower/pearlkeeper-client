import { BIP32, deriveChildKey, p2trAddress } from "@prl-wallet/core";
import type { DerivedAddress, ServiceWarning } from "../contracts/index.js";
import type { BlockbookPort } from "../ports/index.js";
import type { NetworkContext } from "../network/index.js";

export const DEFAULT_GAP_LIMIT = 5;

export interface DiscoveryScanResult {
  derivedAddresses: DerivedAddress[];
  receiveAddressIndex: number;
  receiveAddress: string;
  warnings: ServiceWarning[];
}

interface BaseDiscoveryInput {
  client: BlockbookPort;
  network: NetworkContext;
  gapLimit?: number;
}

interface SeedDiscoveryInput extends BaseDiscoveryInput {
  seed: Buffer;
}

interface RootDiscoveryInput extends BaseDiscoveryInput {
  root: ReturnType<typeof BIP32.fromBase58>;
}

interface XpubDiscoveryInput extends BaseDiscoveryInput {
  accountNode: ReturnType<typeof BIP32.fromBase58>;
}

export async function discoverFromSeed(
  input: SeedDiscoveryInput,
): Promise<DiscoveryScanResult> {
  const { seed, network } = input;

  return discoverWithDeriver({
    ...input,
    deriveAddress(index) {
      const child = deriveChildKey(
        seed,
        network.network,
        network.bip86Path(0, 0, index),
      );
      return p2trAddress(child.xOnlyPubkey, network.network);
    },
  });
}

export async function discoverFromRoot(
  input: RootDiscoveryInput,
): Promise<DiscoveryScanResult> {
  const { root, network } = input;

  return discoverWithDeriver({
    ...input,
    deriveAddress(index) {
      const child = root.derivePath(network.bip86Path(0, 0, index));
      return p2trAddress(child.publicKey.slice(1), network.network);
    },
  });
}

export async function discoverFromXpub(
  input: XpubDiscoveryInput,
): Promise<DiscoveryScanResult> {
  const { accountNode, network } = input;
  const externalChain = accountNode.derive(0);

  return discoverWithDeriver({
    ...input,
    deriveAddress(index) {
      const child = externalChain.derive(index);
      return p2trAddress(child.publicKey.slice(1), network.network);
    },
  });
}

interface DiscoverWithDeriverInput extends BaseDiscoveryInput {
  deriveAddress(index: number): string;
}

async function discoverWithDeriver(
  input: DiscoverWithDeriverInput,
): Promise<DiscoveryScanResult> {
  const gapLimit = input.gapLimit ?? DEFAULT_GAP_LIMIT;

  if (!Number.isInteger(gapLimit) || gapLimit <= 0) {
    throw new Error("gapLimit must be a positive integer");
  }

  const results: DerivedAddress[] = [];
  const warnings: ServiceWarning[] = [];
  let index = 0;
  let gap = 0;

  while (gap < gapLimit) {
    const address = input.deriveAddress(index);

    let hasTransactions = false;
    try {
      const info = await input.client.getAddress(address, 1, 1);
      hasTransactions = info.txs > 0;
    } catch {
      warnings.push({
        code: "address_lookup_failed",
        message: `Failed to check ${address}`,
      });
    }

    results.push({ index, address, hasTransactions });
    gap = hasTransactions ? 0 : gap + 1;
    index += 1;
  }

  const receiveAddressIndex = results.findIndex(
    (entry) => !entry.hasTransactions,
  );

  if (receiveAddressIndex < 0) {
    throw new Error("discovery failed to resolve a receive address");
  }

  return {
    derivedAddresses: results,
    receiveAddressIndex,
    receiveAddress: results[receiveAddressIndex].address,
    warnings,
  };
}
