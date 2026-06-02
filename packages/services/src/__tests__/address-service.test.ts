import {
  BIP32,
  deriveChildKey,
  mnemonicToSeed,
  p2trAddress,
} from "@prl-wallet/core";

import { createAddressService } from "../address/index.js";
import { resolveNetworkContext } from "../network/index.js";

import { createTestPorts } from "./fixtures/servicePorts.js";
import { walletFixtures } from "./fixtures/wallets.js";

async function deriveSeedAddresses(
  networkId: string,
  seed: Buffer,
  count: number,
): Promise<string[]> {
  const { network, bip86Path } = resolveNetworkContext(networkId);

  return Array.from({ length: count }, (_, index) => {
    const child = deriveChildKey(seed, network, bip86Path(0, 0, index));
    return p2trAddress(child.xOnlyPubkey, network);
  });
}

function deriveRootAddresses(
  networkId: string,
  seedHex: string,
  count: number,
): string[] {
  const { network, bip86Path } = resolveNetworkContext(networkId);
  const root = BIP32.fromSeed(Buffer.from(seedHex, "hex"), network);

  return Array.from({ length: count }, (_, index) => {
    const child = root.derivePath(bip86Path(0, 0, index));
    return p2trAddress(child.publicKey.slice(1), network);
  });
}

function deriveXpubAddresses(
  networkId: string,
  xpub: string,
  count: number,
): string[] {
  const { network } = resolveNetworkContext(networkId);
  const accountNode = BIP32.fromBase58(xpub, network).derive(0);

  return Array.from({ length: count }, (_, index) => {
    const child = accountNode.derive(index);
    return p2trAddress(child.publicKey.slice(1), network);
  });
}

function deriveAccountXpub(networkId: string, seedHex: string): string {
  const { network, bip86Path } = resolveNetworkContext(networkId);
  const root = BIP32.fromSeed(Buffer.from(seedHex, "hex"), network);

  return root
    .derivePath(bip86Path(0).replace(/\/0\/0$/, ""))
    .neutered()
    .toBase58();
}

describe("address service", () => {
  it("discovers mnemonic wallet addresses with deterministic receive-address results", async () => {
    const expectedAddresses = await deriveSeedAddresses(
      walletFixtures.signingWallet.networkId,
      await mnemonicToSeed(walletFixtures.mnemonic),
      6,
    );
    const ports = createTestPorts({
      secrets: {
        getMnemonic: async () => walletFixtures.mnemonic,
      },
      blockbook: {
        getAddress: async (address) => ({
          address,
          balance: "0",
          txs: address === expectedAddresses[0] ? 2 : 0,
        }),
      },
    });
    const service = createAddressService(ports);

    const result = await service.discoverAddresses({
      wallet: walletFixtures.signingWallet,
    });

    expect(result.derivedAddresses).toEqual([
      { index: 0, address: expectedAddresses[0], hasTransactions: true },
      { index: 1, address: expectedAddresses[1], hasTransactions: false },
      { index: 2, address: expectedAddresses[2], hasTransactions: false },
      { index: 3, address: expectedAddresses[3], hasTransactions: false },
      { index: 4, address: expectedAddresses[4], hasTransactions: false },
      { index: 5, address: expectedAddresses[5], hasTransactions: false },
    ]);
    expect(result.receiveAddressIndex).toBe(1);
    expect(result.receiveAddress).toBe(expectedAddresses[1]);
    expect(result.warnings).toEqual([]);
  });

  it("discovers bip32-seed wallet addresses against wallet-owned network data only", async () => {
    const expectedAddresses = deriveRootAddresses(
      walletFixtures.bip32SeedWallet.networkId,
      walletFixtures.bip32Seed,
      5,
    );
    const networkIds: string[] = [];
    const service = createAddressService(
      createTestPorts({
        secrets: {
          getBIP32Seed: async () => walletFixtures.bip32Seed,
        },
        blockbook: (networkId) => {
          networkIds.push(networkId);
          return {
            getAddress: async (address) => ({
              address,
              balance: "0",
              txs: 0,
            }),
          };
        },
      }),
    );

    const result = await service.discoverAddresses({
      wallet: walletFixtures.bip32SeedWallet,
    });

    expect(new Set(networkIds)).toEqual(
      new Set([walletFixtures.bip32SeedWallet.networkId]),
    );
    expect(result.derivedAddresses.map((entry) => entry.address)).toEqual(
      expectedAddresses,
    );
    expect(result.receiveAddress).toBe(expectedAddresses[0]);
    expect(result.receiveAddressIndex).toBe(0);
  });

  it("discovers xpub watch-only wallets without touching signing-secret lookups", async () => {
    const xpub = deriveAccountXpub(
      walletFixtures.watchOnlyWallet.networkId,
      walletFixtures.bip32Seed,
    );
    const expectedAddresses = deriveXpubAddresses(
      walletFixtures.watchOnlyWallet.networkId,
      xpub,
      5,
    );
    const service = createAddressService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => {
            throw new Error("mnemonic should not be loaded");
          },
          getBIP32Seed: async () => {
            throw new Error("seed should not be loaded");
          },
          getXpub: async () => xpub,
        },
      }),
    );

    const result = await service.discoverAddresses({
      wallet: walletFixtures.watchOnlyWallet,
    });

    expect(result.derivedAddresses.map((entry) => entry.address)).toEqual(
      expectedAddresses,
    );
    expect(result.receiveAddressIndex).toBe(0);
    expect(result.receiveAddress).toBe(expectedAddresses[0]);
  });

  it("surfaces partial Blockbook lookup failures as warnings while keeping deterministic addresses", async () => {
    const expectedAddresses = await deriveSeedAddresses(
      walletFixtures.signingWallet.networkId,
      await mnemonicToSeed(walletFixtures.mnemonic),
      5,
    );
    const service = createAddressService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => walletFixtures.mnemonic,
        },
        blockbook: {
          getAddress: async (address) => {
            if (address === expectedAddresses[1]) {
              throw new Error("temporary blockbook failure");
            }

            return {
              address,
              balance: "0",
              txs: address === expectedAddresses[0] ? 1 : 0,
            };
          },
        },
      }),
    );

    const result = await service.discoverAddresses({
      wallet: walletFixtures.signingWallet,
      gapLimit: 4,
    });

    expect(result.derivedAddresses.map((entry) => entry.address)).toEqual(
      expectedAddresses,
    );
    expect(result.receiveAddressIndex).toBe(1);
    expect(result.receiveAddress).toBe(expectedAddresses[1]);
    expect(result.warnings).toEqual([
      {
        code: "address_lookup_failed",
        message: `Failed to check ${expectedAddresses[1]}`,
      },
    ]);
  });

  it("returns the next unused receive address without relying on screen state", async () => {
    const expectedAddresses = await deriveSeedAddresses(
      walletFixtures.signingWallet.networkId,
      await mnemonicToSeed(walletFixtures.mnemonic),
      6,
    );
    const service = createAddressService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => walletFixtures.mnemonic,
        },
        blockbook: {
          getAddress: async (address) => ({
            address,
            balance: "0",
            txs: [expectedAddresses[0], expectedAddresses[1]].includes(address)
              ? 1
              : 0,
          }),
        },
      }),
    );

    await expect(
      service.getReceiveAddress(walletFixtures.signingWallet),
    ).resolves.toEqual({
      index: 2,
      address: expectedAddresses[2],
      hasTransactions: false,
    });
  });

  it("fails with explicit errors for unknown networks and missing wallet material", async () => {
    const service = createAddressService(createTestPorts());

    await expect(
      service.discoverAddresses({
        wallet: {
          ...walletFixtures.signingWallet,
          networkId: "missing-network",
        },
      }),
    ).rejects.toThrow('Unknown networkId: "missing-network"');

    await expect(
      service.discoverAddresses({
        wallet: walletFixtures.signingWallet,
      }),
    ).rejects.toThrow("missing_secret");
  });
});
