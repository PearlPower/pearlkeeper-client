import { BIP32, deriveChildKey, mnemonicToSeed } from "@prl-wallet/core";
import type { InputSigner } from "@prl-wallet/core";

import { assertExtendedKeyMatchesNetwork } from "../address/extendedKeyValidator.js";
import type { SignableWalletReference } from "../contracts/index.js";
import type { NetworkContext } from "../network/index.js";
import type { WalletSecretsPort } from "../ports/index.js";

import type { TaggedUtxo } from "./preview.js";

const HEX_SEED_PATTERN = /^[0-9a-fA-F]{64,128}$/;

type SigningMaterial =
  | { kind: "seed"; seed: Buffer }
  | { kind: "root"; root: ReturnType<typeof BIP32.fromBase58> };

export async function loadSigningMaterial(
  wallet: SignableWalletReference,
  secrets: WalletSecretsPort,
  network: NetworkContext,
): Promise<SigningMaterial> {
  if (wallet.walletType === "mnemonic") {
    const mnemonic = await secrets.getMnemonic(wallet.walletId);

    if (!mnemonic) {
      throw new Error("missing_secret");
    }

    return {
      kind: "seed",
      seed: await mnemonicToSeed(mnemonic),
    };
  }

  if (wallet.walletType === "bip32Seed") {
    const seedData = await secrets.getBIP32Seed(wallet.walletId);

    if (!seedData) {
      throw new Error("missing_secret");
    }

    if (HEX_SEED_PATTERN.test(seedData) && seedData.length % 2 === 0) {
      return {
        kind: "seed",
        seed: Buffer.from(seedData, "hex"),
      };
    }

    // CR-1: refuse to sign with a stored extended key that doesn't match
    // the current network's prefix. Mirrors the check in credentials.ts —
    // signing and discovery walk through different load paths and both
    // need the guard.
    assertExtendedKeyMatchesNetwork(seedData, network, "private");

    return {
      kind: "root",
      root: BIP32.fromBase58(seedData, network.network),
    };
  }

  throw new Error(`unsupported_wallet_type:${wallet.walletType}`);
}

export function createInputSigners(options: {
  utxos: TaggedUtxo[];
  material: SigningMaterial;
  network: NetworkContext;
}): InputSigner[] {
  return options.utxos.map((utxo) => {
    const path = options.network.bip86Path(0, 0, utxo.addressIndex);

    if (options.material.kind === "seed") {
      const child = deriveChildKey(
        options.material.seed,
        options.network.network,
        path,
      );
      return {
        childNode: child.childNode,
        xOnlyPubkey: child.xOnlyPubkey,
      };
    }

    const childNode = options.material.root.derivePath(path);
    return {
      childNode,
      xOnlyPubkey: childNode.publicKey.slice(1),
    };
  });
}
