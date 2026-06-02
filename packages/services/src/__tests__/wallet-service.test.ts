import {
  BIP32,
  deriveChildKey,
  mnemonicToSeed,
  p2trAddress,
} from "@prl-wallet/core";

import { createWalletService } from "../wallet/index.js";
import { resolveNetworkContext } from "../network/index.js";

import {
  createTestPorts,
  TEST_NOW,
  TEST_WALLET_ID,
} from "./fixtures/servicePorts.js";
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

function deriveAccountXpub(networkId: string, seedHex: string): string {
  const { network, bip86Path } = resolveNetworkContext(networkId);
  const root = BIP32.fromSeed(Buffer.from(seedHex, "hex"), network);

  return root
    .derivePath(bip86Path(0).replace(/\/0\/0$/, ""))
    .neutered()
    .toBase58();
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

describe("wallet service", () => {
  it("prepares a signing draft without persisting secrets or registry records", async () => {
    const storedSecrets: string[] = [];
    const registryWrites: string[] = [];
    const service = createWalletService(
      createTestPorts({
        secrets: {
          storeMnemonic: async () => {
            storedSecrets.push("mnemonic");
          },
          storeWalletType: async () => {
            storedSecrets.push("walletType");
          },
        },
        registry: {
          addWallet: async () => {
            registryWrites.push("addWallet");
          },
        },
      }),
    );

    const draft = await service.prepareCreateWallet({
      networkId: walletFixtures.signingWallet.networkId,
      walletType: "mnemonic",
    });

    if (draft.walletType !== "mnemonic") {
      throw new Error(`expected mnemonic draft, received ${draft.walletType}`);
    }

    expect(draft).toMatchObject({
      walletId: TEST_WALLET_ID,
      networkId: walletFixtures.signingWallet.networkId,
      walletType: "mnemonic",
      capability: "signing",
    });
    expect(draft.mnemonic.split(" ")).toHaveLength(12);
    expect(draft.firstReceiveAddress).toMatch(/^bc1p/);
    expect(storedSecrets).toEqual([]);
    expect(registryWrites).toEqual([]);
  });

  it("commits an approved create-wallet draft exactly once through injected ports", async () => {
    const walletAdds: Array<{ id: string; name: string }> = [];
    const storedSecrets: string[] = [];
    const service = createWalletService(
      createTestPorts({
        secrets: {
          storeMnemonic: async (walletId, mnemonic) => {
            storedSecrets.push(`${walletId}:${mnemonic}`);
          },
          storeWalletType: async (walletId, walletType) => {
            storedSecrets.push(`${walletId}:${walletType}`);
          },
        },
        registry: {
          addWallet: async (record) => {
            walletAdds.push({ id: record.id, name: record.name });
          },
        },
      }),
    );
    const draft = await service.prepareCreateWallet({
      networkId: walletFixtures.signingWallet.networkId,
      walletType: "mnemonic",
    });

    if (draft.walletType !== "mnemonic") {
      throw new Error(`expected mnemonic draft, received ${draft.walletType}`);
    }

    const committed = await service.commitCreateWallet({
      name: "Primary",
      draft,
    });

    expect(committed).toEqual(draft);
    expect(walletAdds).toEqual([{ id: draft.walletId, name: "Primary" }]);
    expect(storedSecrets).toEqual([
      `${draft.walletId}:${draft.mnemonic}`,
      `${draft.walletId}:mnemonic`,
    ]);

    await expect(
      service.commitCreateWallet({
        name: "Primary",
        draft,
      }),
    ).rejects.toThrow("wallet already exists");
  });

  it("imports mnemonic wallets after discovery completes and before registry commit", async () => {
    const seed = await mnemonicToSeed(walletFixtures.mnemonic);
    const expectedAddresses = await deriveSeedAddresses(
      walletFixtures.signingWallet.networkId,
      seed,
      6,
    );
    const events: string[] = [];
    const service = createWalletService(
      createTestPorts({
        secrets: {
          storeMnemonic: async () => {
            events.push("storeMnemonic");
          },
          storeWalletType: async () => {
            events.push("storeWalletType");
          },
        },
        registry: {
          addWallet: async () => {
            events.push("addWallet");
          },
        },
        blockbook: {
          getAddress: async (address) => {
            events.push(`lookup:${address}`);
            return {
              address,
              balance: "0",
              txs: address === expectedAddresses[0] ? 1 : 0,
            };
          },
        },
      }),
    );

    const draft = await service.importWallet({
      name: "Imported mnemonic",
      networkId: walletFixtures.signingWallet.networkId,
      walletType: "mnemonic",
      mnemonic: walletFixtures.mnemonic,
    });

    if (draft.walletType !== "mnemonic") {
      throw new Error(`expected mnemonic draft, received ${draft.walletType}`);
    }

    expect(draft).toMatchObject({
      walletId: TEST_WALLET_ID,
      networkId: walletFixtures.signingWallet.networkId,
      walletType: "mnemonic",
      capability: "signing",
      mnemonic: walletFixtures.mnemonic,
      firstReceiveAddress: expectedAddresses[1],
      discovery: {
        receiveAddressIndex: 1,
        receiveAddress: expectedAddresses[1],
        warnings: [],
      },
    });
    expect(
      draft.discovery?.derivedAddresses.map((entry) => entry.address),
    ).toEqual(expectedAddresses);
    expect(events).toContain("storeMnemonic");
    expect(events).toContain("storeWalletType");
    expect(events[events.length - 1]).toBe("addWallet");
    expect(
      events.findIndex((event) => event.startsWith("lookup:")),
    ).toBeGreaterThan(events.indexOf("storeWalletType"));
  });

  it("imports bip32-seed wallets with discovery-aware signing drafts", async () => {
    const expectedAddresses = deriveRootAddresses(
      walletFixtures.bip32SeedWallet.networkId,
      walletFixtures.bip32Seed,
      6,
    );
    const service = createWalletService(
      createTestPorts({
        blockbook: {
          getAddress: async (address) => ({
            address,
            balance: "0",
            txs: address === expectedAddresses[0] ? 1 : 0,
          }),
        },
      }),
    );

    const draft = await service.importWallet({
      name: "Imported root",
      networkId: walletFixtures.bip32SeedWallet.networkId,
      walletType: "bip32Seed",
      seed: walletFixtures.bip32Seed,
    });

    if (draft.walletType !== "bip32Seed") {
      throw new Error(`expected bip32Seed draft, received ${draft.walletType}`);
    }

    expect(draft).toMatchObject({
      walletId: TEST_WALLET_ID,
      networkId: walletFixtures.bip32SeedWallet.networkId,
      walletType: "bip32Seed",
      capability: "signing",
      firstReceiveAddress: expectedAddresses[1],
      discovery: {
        receiveAddressIndex: 1,
        receiveAddress: expectedAddresses[1],
      },
    });
    expect(
      draft.discovery?.derivedAddresses.map((entry) => entry.address),
    ).toEqual(expectedAddresses);
  });

  it("imports xpub wallets as watch-only drafts and never touches signing-secret lookups", async () => {
    const xpub = deriveAccountXpub(
      walletFixtures.watchOnlyWallet.networkId,
      walletFixtures.bip32Seed,
    );
    const expectedAddresses = deriveXpubAddresses(
      walletFixtures.watchOnlyWallet.networkId,
      xpub,
      5,
    );
    const service = createWalletService(
      createTestPorts({
        secrets: {
          storeMnemonic: async () => {
            throw new Error("mnemonic should not be stored");
          },
          storeBIP32Seed: async () => {
            throw new Error("seed should not be stored");
          },
        },
        blockbook: {
          getAddress: async (address) => ({
            address,
            balance: "0",
            txs: 0,
          }),
        },
      }),
    );

    const draft = await service.importWallet({
      name: "Watch only",
      networkId: walletFixtures.watchOnlyWallet.networkId,
      walletType: "xpub",
      xpub,
    });

    expect(draft).toEqual({
      walletId: TEST_WALLET_ID,
      name: "Watch only",
      networkId: walletFixtures.watchOnlyWallet.networkId,
      walletType: "xpub",
      capability: "watchOnly",
      xpub,
      discovery: {
        derivedAddresses: expectedAddresses.map((address, index) => ({
          index,
          address,
          hasTransactions: false,
        })),
        receiveAddressIndex: 0,
        receiveAddress: expectedAddresses[0],
        warnings: [],
      },
    });
  });

  it("deletes wallet secrets and registry state, and lists registry records deterministically", async () => {
    const ports = createTestPorts();
    const service = createWalletService(ports);

    await ports.registry.addWallet(walletFixtures.walletRecord);
    await ports.secrets.storeMnemonic(TEST_WALLET_ID, walletFixtures.mnemonic);
    await ports.secrets.storeWalletType(TEST_WALLET_ID, "mnemonic");

    await expect(service.listWallets()).resolves.toEqual([
      walletFixtures.walletRecord,
    ]);

    await service.deleteWallet(TEST_WALLET_ID);

    await expect(service.listWallets()).resolves.toEqual([]);
    await expect(ports.secrets.getMnemonic(TEST_WALLET_ID)).resolves.toBeNull();
    await expect(
      ports.secrets.getWalletType(TEST_WALLET_ID),
    ).resolves.toBeNull();
  });

  it("fails imported signing wallets when their stored secret is missing", async () => {
    const service = createWalletService(
      createTestPorts({
        secrets: {
          storeMnemonic: async () => undefined,
          getMnemonic: async () => null,
        },
      }),
    );

    await expect(
      service.importWallet({
        name: "Broken mnemonic import",
        networkId: walletFixtures.signingWallet.networkId,
        walletType: "mnemonic",
        mnemonic: walletFixtures.mnemonic,
      }),
    ).rejects.toThrow("missing_secret");
  });

  it("keeps the deterministic runtime fixture visible to wallet-service tests", () => {
    const ports = createTestPorts();

    expect(ports.runtime.now()).toBe(TEST_NOW);
    expect(ports.runtime.createId()).toBe(TEST_WALLET_ID);
  });
});
