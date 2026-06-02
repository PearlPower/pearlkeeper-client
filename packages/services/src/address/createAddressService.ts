import {
  discoverFromRoot,
  discoverFromSeed,
  discoverFromXpub,
} from "./discovery.js";
import { loadAddressCredentials } from "./credentials.js";
import type {
  AddressDiscoveryResult,
  DerivedAddress,
  WalletReference,
} from "../contracts/index.js";
import { resolveNetworkContext } from "../network/index.js";
import type { ServicesPorts } from "../ports/index.js";

export interface DiscoverAddressesInput {
  wallet: WalletReference;
  gapLimit?: number;
}

export interface AddressService {
  discoverAddresses(
    input: DiscoverAddressesInput,
  ): Promise<AddressDiscoveryResult>;
  getReceiveAddress(wallet: WalletReference): Promise<DerivedAddress>;
}

export function createAddressService(ports: ServicesPorts): AddressService {
  assertAddressServicePorts(ports);

  return {
    async discoverAddresses(input) {
      assertWalletReference(input.wallet, "discoverAddresses");
      return discoverAddresses({
        ports,
        wallet: input.wallet,
        gapLimit: input.gapLimit,
      });
    },

    async getReceiveAddress(wallet) {
      assertWalletReference(wallet, "getReceiveAddress");
      const discovery = await discoverAddresses({ ports, wallet });

      return discovery.derivedAddresses[discovery.receiveAddressIndex];
    },
  };
}

function assertAddressServicePorts(ports: ServicesPorts): void {
  if (!ports.registry || !ports.blockbook || !ports.runtime) {
    throw new Error(
      "createAddressService requires registry, blockbook, and runtime ports",
    );
  }
}

function assertWalletReference(
  wallet: WalletReference,
  methodName: string,
): void {
  assertNonEmptyString(wallet.walletId, methodName, "walletId");
  assertNonEmptyString(wallet.networkId, methodName, "networkId");
}

function assertNonEmptyString(
  value: string,
  methodName: string,
  fieldName: string,
): void {
  if (!value.trim()) {
    throw new Error(`${methodName} requires a non-empty ${fieldName}`);
  }
}

interface DiscoverAddressesOptions {
  ports: ServicesPorts;
  wallet: WalletReference;
  gapLimit?: number;
}

async function discoverAddresses(
  options: DiscoverAddressesOptions,
): Promise<AddressDiscoveryResult> {
  const network = resolveNetworkContext(options.wallet.networkId);
  const credentials = await loadAddressCredentials(
    options.wallet,
    options.ports.secrets,
    network,
  );
  const client = options.ports.blockbook(options.wallet.networkId);

  if (credentials.kind === "seed") {
    return discoverFromSeed({
      client,
      network,
      seed: credentials.seed,
      gapLimit: options.gapLimit,
    });
  }

  if (credentials.kind === "root") {
    return discoverFromRoot({
      client,
      network,
      root: credentials.root,
      gapLimit: options.gapLimit,
    });
  }

  return discoverFromXpub({
    client,
    network,
    accountNode: credentials.accountNode,
    gapLimit: options.gapLimit,
  });
}
