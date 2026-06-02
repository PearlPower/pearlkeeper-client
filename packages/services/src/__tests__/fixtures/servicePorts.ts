import type {
  BlockbookPort,
  BlockbookPortFactory,
  ServicesPorts,
  WalletRecord,
  WalletType,
} from "../../index.js";

export const TEST_NOW = 1_700_000_000_000;
export const TEST_WALLET_ID = "wallet-1";

export interface TestPortsOverrides {
  secrets?: Partial<ServicesPorts["secrets"]>;
  registry?: Partial<ServicesPorts["registry"]>;
  blockbook?:
    | Partial<BlockbookPort>
    | ((networkId: string) => Partial<BlockbookPort>);
  runtime?: Partial<ServicesPorts["runtime"]>;
}

export function createTestPorts(
  overrides: TestPortsOverrides = {},
): ServicesPorts {
  const wallets: WalletRecord[] = [];
  let activeWalletId: string | null = null;
  const mnemonicByWalletId = new Map<string, string>();
  const bip32SeedByWalletId = new Map<string, string>();
  const xpubByWalletId = new Map<string, string>();
  const walletTypeByWalletId = new Map<string, WalletType>();
  let pinHash: string | null = null;

  const defaultSecrets = {
    getMnemonic: async (walletId: string) =>
      mnemonicByWalletId.get(walletId) ?? null,
    getBIP32Seed: async (walletId: string) =>
      bip32SeedByWalletId.get(walletId) ?? null,
    getXpub: async (walletId: string) => xpubByWalletId.get(walletId) ?? null,
    getWalletType: async (walletId: string) =>
      walletTypeByWalletId.get(walletId) ?? null,
    storeMnemonic: async (walletId: string, mnemonic: string) => {
      mnemonicByWalletId.set(walletId, mnemonic);
    },
    storeBIP32Seed: async (walletId: string, seed: string) => {
      bip32SeedByWalletId.set(walletId, seed);
    },
    storeXpub: async (walletId: string, xpub: string) => {
      xpubByWalletId.set(walletId, xpub);
    },
    storeWalletType: async (walletId: string, type: WalletType) => {
      walletTypeByWalletId.set(walletId, type);
    },
    deleteWalletSecrets: async (walletId: string) => {
      mnemonicByWalletId.delete(walletId);
      bip32SeedByWalletId.delete(walletId);
      xpubByWalletId.delete(walletId);
      walletTypeByWalletId.delete(walletId);
    },
    getPinHash: async () => pinHash,
    storePinHash: async (hash: string) => {
      pinHash = hash;
    },
    deletePinHash: async () => {
      pinHash = null;
    },
  };

  const defaultRegistry = {
    listWallets: async () => [...wallets],
    getWallet: async (walletId: string) =>
      wallets.find((wallet) => wallet.id === walletId) ?? null,
    getActiveWalletId: async () => activeWalletId,
    addWallet: async (record: WalletRecord) => {
      wallets.push(record);
    },
    removeWallet: async (walletId: string) => {
      const index = wallets.findIndex((wallet) => wallet.id === walletId);

      if (index >= 0) {
        wallets.splice(index, 1);
      }
    },
    setActiveWalletId: async (walletId: string | null) => {
      activeWalletId = walletId;
    },
    updateWalletBalance: async (walletId: string, balance: string) => {
      const wallet = wallets.find((record) => record.id === walletId);

      if (wallet) {
        wallet.lastKnownBalance = balance;
      }
    },
  };

  const blockbookFactory: BlockbookPortFactory = (networkId) => {
    const blockbookOverrides =
      typeof overrides.blockbook === "function"
        ? overrides.blockbook(networkId)
        : (overrides.blockbook ?? {});

    return {
      ping: async () => ({ healthy: true, networkId }),
      getAddress: async (address) => ({ address, balance: "0", txs: 0 }),
      getTransaction: async (txid) => ({ txid }),
      getUtxos: async () => [],
      estimateFee: async () => 1,
      sendTransaction: async () => `${networkId}-txid`,
      ...blockbookOverrides,
    };
  };

  return {
    secrets: {
      getMnemonic: overrides.secrets?.getMnemonic ?? defaultSecrets.getMnemonic,
      getBIP32Seed:
        overrides.secrets?.getBIP32Seed ?? defaultSecrets.getBIP32Seed,
      getXpub: overrides.secrets?.getXpub ?? defaultSecrets.getXpub,
      getWalletType:
        overrides.secrets?.getWalletType ?? defaultSecrets.getWalletType,
      storeMnemonic: async (walletId, mnemonic) => {
        await defaultSecrets.storeMnemonic(walletId, mnemonic);
        await overrides.secrets?.storeMnemonic?.(walletId, mnemonic);
      },
      storeBIP32Seed: async (walletId, seed) => {
        await defaultSecrets.storeBIP32Seed(walletId, seed);
        await overrides.secrets?.storeBIP32Seed?.(walletId, seed);
      },
      storeXpub: async (walletId, xpub) => {
        await defaultSecrets.storeXpub(walletId, xpub);
        await overrides.secrets?.storeXpub?.(walletId, xpub);
      },
      storeWalletType: async (walletId, type) => {
        await defaultSecrets.storeWalletType(walletId, type);
        await overrides.secrets?.storeWalletType?.(walletId, type);
      },
      deleteWalletSecrets: async (walletId) => {
        await defaultSecrets.deleteWalletSecrets(walletId);
        await overrides.secrets?.deleteWalletSecrets?.(walletId);
      },
      getPinHash: overrides.secrets?.getPinHash ?? defaultSecrets.getPinHash,
      storePinHash: async (hash) => {
        await defaultSecrets.storePinHash(hash);
        await overrides.secrets?.storePinHash?.(hash);
      },
      deletePinHash: async () => {
        await defaultSecrets.deletePinHash();
        await overrides.secrets?.deletePinHash?.();
      },
    },
    registry: {
      listWallets:
        overrides.registry?.listWallets ?? defaultRegistry.listWallets,
      getWallet: overrides.registry?.getWallet ?? defaultRegistry.getWallet,
      getActiveWalletId:
        overrides.registry?.getActiveWalletId ??
        defaultRegistry.getActiveWalletId,
      addWallet: async (record) => {
        await defaultRegistry.addWallet(record);
        await overrides.registry?.addWallet?.(record);
      },
      removeWallet: async (walletId) => {
        await defaultRegistry.removeWallet(walletId);
        await overrides.registry?.removeWallet?.(walletId);
      },
      setActiveWalletId: async (walletId) => {
        await defaultRegistry.setActiveWalletId(walletId);
        await overrides.registry?.setActiveWalletId?.(walletId);
      },
      updateWalletBalance: async (walletId, balance) => {
        await defaultRegistry.updateWalletBalance(walletId, balance);
        await overrides.registry?.updateWalletBalance?.(walletId, balance);
      },
    },
    blockbook: blockbookFactory,
    runtime: {
      now: () => TEST_NOW,
      createId: () => TEST_WALLET_ID,
      ...overrides.runtime,
    },
  };
}
