import { BIP32, mnemonicToSeed } from "@prl-wallet/core";
import type { WalletReference } from "../contracts/index.js";
import type { NetworkContext } from "../network/index.js";
import type { WalletSecretsPort } from "../ports/index.js";
import { assertExtendedKeyMatchesNetwork } from "./extendedKeyValidator.js";

export type AddressCredentials =
  | { kind: "seed"; seed: Buffer }
  | { kind: "root"; root: ReturnType<typeof BIP32.fromBase58> }
  | { kind: "xpub"; accountNode: ReturnType<typeof BIP32.fromBase58> };

const HEX_SEED_PATTERN = /^[0-9a-fA-F]{64,128}$/;

export async function loadAddressCredentials(
  wallet: WalletReference,
  secrets: WalletSecretsPort,
  network: NetworkContext,
): Promise<AddressCredentials> {
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

    // CR-1: defense-in-depth — refuse to load a stored extended key that
    // doesn't match the current network's prefix. Without this, a wallet
    // record persisted against the wrong network would silently derive
    // garbage addresses on every signing/discovery call.
    assertExtendedKeyMatchesNetwork(seedData, network, "private");

    return {
      kind: "root",
      root: BIP32.fromBase58(seedData, network.network),
    };
  }

  if (wallet.walletType === "xpub") {
    const xpub = await secrets.getXpub(wallet.walletId);

    if (!xpub) {
      throw new Error("missing_secret");
    }

    // CR-1: see note in bip32Seed branch above.
    assertExtendedKeyMatchesNetwork(xpub, network, "public");

    return {
      kind: "xpub",
      accountNode: BIP32.fromBase58(xpub, network.network),
    };
  }

  throw new Error(`unsupported_wallet_type:${wallet.walletType}`);
}
