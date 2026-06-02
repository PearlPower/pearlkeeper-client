import { deriveP2TRAddress, generateMnemonic } from "@prl-wallet/core";

import {
  discoverFromRoot,
  discoverFromSeed,
  discoverFromXpub,
} from "../address/discovery.js";
import { loadAddressCredentials } from "../address/credentials.js";
import type {
  CreateWalletDraft,
  ImportWalletInput,
  WalletDraft,
  WalletReference,
} from "../contracts/index.js";
import { resolveNetworkContext } from "../network/index.js";
import type { ServicesPorts } from "../ports/index.js";
import { assertStoredWalletType } from "./secrets.js";

interface PrepareCreateWalletOptions {
  ports: ServicesPorts;
  networkId: string;
  walletType: "mnemonic";
}

interface PrepareImportWalletOptions {
  ports: ServicesPorts;
  walletId: string;
  input: ImportWalletInput;
  gapLimit?: number;
}

export async function prepareCreateWallet(
  options: PrepareCreateWalletOptions,
): Promise<CreateWalletDraft> {
  const network = resolveNetworkContext(options.networkId);
  const walletId = options.ports.runtime.createId();
  const mnemonic = generateMnemonic();
  const result = await deriveP2TRAddress(
    mnemonic,
    network.network,
    network.bip86Path,
  );

  return {
    walletId,
    networkId: options.networkId,
    walletType: "mnemonic",
    capability: "signing",
    mnemonic,
    firstReceiveAddress: result.address,
  };
}

export async function prepareImportWallet(
  options: PrepareImportWalletOptions,
): Promise<WalletDraft> {
  const { input, ports, walletId } = options;
  const network = resolveNetworkContext(input.networkId);
  const wallet = toWalletReference(walletId, input);
  await assertStoredWalletType(ports.secrets, walletId, input.walletType);
  const credentials = await loadAddressCredentials(
    wallet,
    ports.secrets,
    network,
  );
  const client = ports.blockbook(input.networkId);

  if (input.walletType === "xpub") {
    if (credentials.kind !== "xpub") {
      throw new Error("missing_secret");
    }

    const discovery = await discoverFromXpub({
      client,
      network,
      accountNode: credentials.accountNode,
      gapLimit: options.gapLimit,
    });

    return {
      walletId,
      name: input.name,
      networkId: input.networkId,
      walletType: input.walletType,
      capability: "watchOnly",
      xpub: input.xpub,
      discovery,
    };
  }

  if (credentials.kind === "xpub") {
    throw new Error("missing_secret");
  }

  const discovery =
    credentials.kind === "root"
      ? await discoverFromRoot({
          client,
          network,
          root: credentials.root,
          gapLimit: options.gapLimit,
        })
      : await discoverFromSeed({
          client,
          network,
          seed: credentials.seed,
          gapLimit: options.gapLimit,
        });

  if (input.walletType === "mnemonic") {
    return {
      walletId,
      networkId: input.networkId,
      walletType: input.walletType,
      capability: "signing",
      mnemonic: input.mnemonic,
      firstReceiveAddress: discovery.receiveAddress,
      discovery,
    };
  }

  return {
    walletId,
    networkId: input.networkId,
    walletType: input.walletType,
    capability: "signing",
    firstReceiveAddress: discovery.receiveAddress,
    discovery,
  };
}

function toWalletReference(
  walletId: string,
  input: ImportWalletInput,
): WalletReference {
  if (input.walletType === "xpub") {
    return {
      walletId,
      networkId: input.networkId,
      walletType: input.walletType,
      capability: "watchOnly",
    };
  }

  return {
    walletId,
    networkId: input.networkId,
    walletType: input.walletType,
    capability: "signing",
  };
}
