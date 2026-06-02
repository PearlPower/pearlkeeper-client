// packages/services/src/wallet/__tests__/factoryReset.test.ts
//
// / — factory-reset helper test suite (activated Wave 2).

import { deleteAllSecrets } from "../factoryReset.js";
import type { WalletRecord } from "../../contracts/index.js";
import type { WalletSecretsPort } from "../../ports/index.js";

interface Call {
  method: string;
  args: unknown[];
}

interface FakeSecretsOptions {
  rejectDeleteForWalletIds?: ReadonlyArray<string>;
}

function makeFakeSecrets(options: FakeSecretsOptions = {}): {
  port: WalletSecretsPort;
  calls: Call[];
} {
  const calls: Call[] = [];
  const reject = new Set(options.rejectDeleteForWalletIds ?? []);
  const port: WalletSecretsPort = {
    getMnemonic: async () => null,
    getBIP32Seed: async () => null,
    getXpub: async () => null,
    getWalletType: async () => null,
    storeMnemonic: async (...args) => {
      calls.push({ method: "storeMnemonic", args });
    },
    storeBIP32Seed: async (...args) => {
      calls.push({ method: "storeBIP32Seed", args });
    },
    storeXpub: async (...args) => {
      calls.push({ method: "storeXpub", args });
    },
    storeWalletType: async (...args) => {
      calls.push({ method: "storeWalletType", args });
    },
    deleteWalletSecrets: async (walletId: string) => {
      calls.push({ method: "deleteWalletSecrets", args: [walletId] });
      if (reject.has(walletId)) {
        throw new Error(`forced failure for ${walletId}`);
      }
    },
    getPinHash: async () => null,
    storePinHash: async (...args) => {
      calls.push({ method: "storePinHash", args });
    },
    deletePinHash: async () => {
      calls.push({ method: "deletePinHash", args: [] });
    },
  };
  return { port, calls };
}

describe("deleteAllSecrets", () => {
  it("calls deleteWalletSecrets for every wallet in the list", async () => {
    const { port, calls } = makeFakeSecrets();
    const wallets: WalletRecord[] = [
      { id: "w1", name: "A", networkId: "btc-mainnet", createdAt: 1 },
      { id: "w2", name: "B", networkId: "prl-mainnet", createdAt: 2 },
    ];

    await deleteAllSecrets({ secrets: port, wallets });

    const deleteCalls = calls.filter((c) => c.method === "deleteWalletSecrets");
    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls.map((c) => c.args[0])).toEqual(["w1", "w2"]);
  });

  it("calls deletePinHash exactly once after per-wallet deletes", async () => {
    const { port, calls } = makeFakeSecrets();
    const wallets: WalletRecord[] = [
      { id: "w1", name: "A", networkId: "btc-mainnet", createdAt: 1 },
      { id: "w2", name: "B", networkId: "prl-mainnet", createdAt: 2 },
    ];

    await deleteAllSecrets({ secrets: port, wallets });

    const pinHashCalls = calls.filter((c) => c.method === "deletePinHash");
    expect(pinHashCalls).toHaveLength(1);

    const lastDeleteWalletIdx = calls
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.method === "deleteWalletSecrets")
      .map(({ i }) => i)
      .pop();
    const pinHashIdx = calls.findIndex((c) => c.method === "deletePinHash");

    expect(lastDeleteWalletIdx).toBeDefined();
    expect(pinHashIdx).toBeGreaterThan(lastDeleteWalletIdx as number);
  });

  it("swallows per-wallet delete errors and continues to next wallet (best-effort)", async () => {
    const { port, calls } = makeFakeSecrets({
      rejectDeleteForWalletIds: ["w1"],
    });
    const wallets: WalletRecord[] = [
      { id: "w1", name: "A", networkId: "btc-mainnet", createdAt: 1 },
      { id: "w2", name: "B", networkId: "prl-mainnet", createdAt: 2 },
    ];

    await expect(
      deleteAllSecrets({ secrets: port, wallets }),
    ).resolves.toBeUndefined();

    const deleteCalls = calls.filter((c) => c.method === "deleteWalletSecrets");
    expect(deleteCalls.map((c) => c.args[0])).toEqual(["w1", "w2"]);

    const pinHashCalls = calls.filter((c) => c.method === "deletePinHash");
    expect(pinHashCalls).toHaveLength(1);
  });

  it("handles an empty wallet list — only deletes pin_hash", async () => {
    const { port, calls } = makeFakeSecrets();

    await deleteAllSecrets({ secrets: port, wallets: [] });

    const deleteCalls = calls.filter((c) => c.method === "deleteWalletSecrets");
    expect(deleteCalls).toHaveLength(0);

    const pinHashCalls = calls.filter((c) => c.method === "deletePinHash");
    expect(pinHashCalls).toHaveLength(1);
  });
});
