import {
  BIP32,
  deriveChildKey,
  mnemonicToSeed,
  p2trAddress,
} from "@prl-wallet/core";
// Namespace import so we can `jest.spyOn(coreModule, "buildPsbt")` for the
// controlled-bad-backend negative test (closes C-02 phase exit gate).
import * as coreModule from "@prl-wallet/core";

import { UtxoVerificationError } from "../contracts/errors.js";
import { resolveNetworkContext } from "../network/index.js";
import { createTransactionService } from "../transaction/index.js";

import { createTestPorts } from "./fixtures/servicePorts.js";
import { walletFixtures } from "./fixtures/wallets.js";

describe("createTransactionService", () => {
  it("previewTransaction builds a deterministic draft for signable wallets", async () => {
    const fixture = await createSigningWalletFixture();
    const ports = createTestPorts({
      secrets: {
        getMnemonic: async (walletId) =>
          walletId === fixture.wallet.walletId ? walletFixtures.mnemonic : null,
      },
      blockbook: (networkId) => {
        if (networkId !== fixture.wallet.networkId) {
          throw new Error(`unexpected network:${networkId}`);
        }

        return {
          estimateFee: async () => 2,
          getAddress: async (address) => {
            if (address === fixture.addresses[0]) {
              return { address, balance: "80000", txs: 1 };
            }

            if (address === fixture.addresses[1]) {
              return { address, balance: "0", txs: 1 };
            }

            return { address, balance: "0", txs: 0 };
          },
          getUtxos: async (address) => {
            if (address === fixture.addresses[0]) {
              return [
                {
                  txid: "11".repeat(32),
                  vout: 0,
                  value: "30000",
                  confirmations: 120,
                },
              ];
            }

            if (address === fixture.addresses[1]) {
              return [
                {
                  txid: "22".repeat(32),
                  vout: 1,
                  value: "50000",
                  confirmations: 120,
                },
              ];
            }

            return [];
          },
        };
      },
    });

    const service = createTransactionService(ports);
    const draft = await service.previewTransaction({
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
    });

    expect(draft).toEqual({
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
      feeRate: "2",
      fee: "424",
    });
  });

  it("previewTransaction rejects watch-only wallets before fee or secret work", async () => {
    let blockbookCalls = 0;
    let xpubReads = 0;
    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getXpub: async () => {
            xpubReads += 1;
            return walletFixtures.xpub;
          },
        },
        blockbook: () => {
          blockbookCalls += 1;
          return {};
        },
      }),
    );

    await expect(
      service.previewTransaction({
        wallet: walletFixtures.watchOnlyWallet,
        recipients: [
          {
            address: "bc1precipient0000000000000000000000000000000",
            value: "1",
          },
        ],
        changeAddress: "bc1pchange000000000000000000000000000000000",
      }),
    ).rejects.toThrow("watch_only_wallet");

    expect(blockbookCalls).toBe(0);
    expect(xpubReads).toBe(0);
  });

  it("previewTransaction surfaces insufficient funds with a stable error", async () => {
    const fixture = await createSigningWalletFixture();
    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => walletFixtures.mnemonic,
        },
        blockbook: () => ({
          estimateFee: async () => 2,
          getAddress: async (address) => ({
            address,
            balance: address === fixture.addresses[0] ? "10000" : "0",
            txs: address === fixture.addresses[0] ? 1 : 0,
          }),
          getUtxos: async (address) =>
            address === fixture.addresses[0]
              ? [
                  {
                    txid: "33".repeat(32),
                    vout: 0,
                    value: "10000",
                    confirmations: 120,
                  },
                ]
              : [],
        }),
      }),
    );

    await expect(
      service.previewTransaction({
        wallet: fixture.wallet,
        recipients: [{ address: fixture.recipientAddress, value: "50000" }],
        changeAddress: fixture.addresses[1],
      }),
    ).rejects.toThrow("insufficient_funds");
  });

  it("previewTransaction skips immature coinbase utxos before selection", async () => {
    const fixture = await createSigningWalletFixture();
    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => walletFixtures.mnemonic,
        },
        blockbook: () => ({
          estimateFee: async () => 2,
          getAddress: async (address) => ({
            address,
            balance: address === fixture.addresses[0] ? "70000" : "0",
            txs: address === fixture.addresses[0] ? 1 : 0,
          }),
          getUtxos: async (address) =>
            address === fixture.addresses[0]
              ? [
                  {
                    txid: "66".repeat(32),
                    vout: 0,
                    value: "70000",
                    confirmations: 1,
                    coinbase: true,
                  },
                ]
              : [],
        }),
      }),
    );

    await expect(
      service.previewTransaction({
        wallet: fixture.wallet,
        recipients: [{ address: fixture.recipientAddress, value: "1000" }],
        changeAddress: fixture.addresses[1],
      }),
    ).rejects.toThrow("insufficient_funds");
  });

  it("previewTransaction skips immature coinbase utxos even when utxo flag is missing", async () => {
    const fixture = await createSigningWalletFixture();
    const getTransaction = jest.fn(async () => ({
      txid: "66".repeat(32),
      vin: [{ coinbase: "coinbase-data" }],
    }));
    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => walletFixtures.mnemonic,
        },
        blockbook: () => ({
          estimateFee: async () => 2,
          getAddress: async (address) => ({
            address,
            balance: address === fixture.addresses[0] ? "70000" : "0",
            txs: address === fixture.addresses[0] ? 1 : 0,
          }),
          getTransaction,
          getUtxos: async (address) =>
            address === fixture.addresses[0]
              ? [
                  {
                    txid: "66".repeat(32),
                    vout: 0,
                    value: "70000",
                    confirmations: 1,
                  },
                ]
              : [],
        }),
      }),
    );

    await expect(
      service.previewTransaction({
        wallet: fixture.wallet,
        recipients: [{ address: fixture.recipientAddress, value: "1000" }],
        changeAddress: fixture.addresses[1],
      }),
    ).rejects.toThrow("insufficient_funds");

    expect(getTransaction).toHaveBeenCalledWith("66".repeat(32));
  });

  it("sendTransaction signs selected inputs and broadcasts through the wallet network client", async () => {
    const fixture = await createSigningWalletFixture();
    let broadcastHex: string | null = null;
    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => walletFixtures.mnemonic,
        },
        blockbook: (networkId) => ({
          estimateFee: async () => 2,
          getAddress: async (address) => {
            if (networkId !== fixture.wallet.networkId) {
              throw new Error(`unexpected network:${networkId}`);
            }

            return {
              address,
              balance:
                address === fixture.addresses[0]
                  ? "30000"
                  : address === fixture.addresses[1]
                    ? "50000"
                    : "0",
              txs:
                address === fixture.addresses[0] ||
                address === fixture.addresses[1]
                  ? 1
                  : 0,
            };
          },
          getUtxos: async (address) => {
            if (address === fixture.addresses[0]) {
              return [
                {
                  txid: "44".repeat(32),
                  vout: 0,
                  value: "30000",
                  confirmations: 120,
                },
              ];
            }

            if (address === fixture.addresses[1]) {
              return [
                {
                  txid: "55".repeat(32),
                  vout: 1,
                  value: "50000",
                  confirmations: 120,
                },
              ];
            }

            return [];
          },
          sendTransaction: async (txHex) => {
            broadcastHex = txHex;
            return "sent-mainnet-txid";
          },
        }),
      }),
    );

    const result = await service.sendTransaction({
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
      feeRate: "2",
    });

    expect(result.txid).toBe("sent-mainnet-txid");
    expect(result.hex).toBe(broadcastHex);
    expect(result.hex).toMatch(/^[0-9a-f]+$/);
    expect(result.hex.length).toBeGreaterThan(100);
  });

  it("sendTransaction fails when signing secrets are missing before network I/O continues", async () => {
    let addressLookups = 0;
    const service = createTransactionService(
      createTestPorts({
        blockbook: () => ({
          getAddress: async (address) => {
            addressLookups += 1;
            return { address, balance: "0", txs: 0 };
          },
        }),
      }),
    );

    await expect(
      service.sendTransaction({
        wallet: walletFixtures.signingWallet,
        recipients: [
          {
            address: "bc1precipient0000000000000000000000000000000",
            value: "1",
          },
        ],
        changeAddress: "bc1pchange000000000000000000000000000000000",
        feeRate: "1",
      }),
    ).rejects.toThrow("missing_secret");

    expect(addressLookups).toBe(0);
  });

  it("sendTransaction rejects wrong-network bip32 material using wallet.networkId", async () => {
    const mainnet = resolveNetworkContext("btc-mainnet");
    const testnet = resolveNetworkContext("btc-testnet");
    const root = BIP32.fromSeed(
      Buffer.from(walletFixtures.bip32Seed, "hex"),
      testnet.network,
    );
    let addressLookups = 0;
    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getBIP32Seed: async () => root.toBase58(),
        },
        blockbook: () => ({
          getAddress: async (address) => {
            addressLookups += 1;
            return { address, balance: "0", txs: 0 };
          },
        }),
      }),
    );

    // CR-1: prefix-string guard rejects the cross-network material BEFORE
    // BIP32.fromBase58 ever runs. The previous "Invalid network version"
    // bitcoinjs-lib error is now replaced with a metadata-bearing
    // `ExtendedKeyNetworkMismatchError`.
    await expect(
      service.sendTransaction({
        wallet: {
          walletId: "wallet-wrong-network",
          walletType: "bip32Seed",
          capability: "signing",
          networkId: mainnet.config.id,
        },
        recipients: [{ address: fixtureRecipient(mainnet, 8), value: "1" }],
        changeAddress: fixtureRecipient(mainnet, 9),
        feeRate: "1",
      }),
    ).rejects.toThrow(/must start with "xprv"/);

    expect(addressLookups).toBe(0);
  });

  // / Wave 3 — INDEXER-02 / C-02 phase exit gate.
  //
  // Controlled-bad-backend: `getUtxos` returns a UTXO whose `.address` field
  // does NOT match the queried address (i.e. the backend was compromised /
  // lying / proxy-tampered). `assertScriptMatchesAddress` ( /
  // `transaction/utxoVerification.ts`) must reject inside `collectUtxos`
  // BEFORE `selectUtxos`, `buildPsbt`, signing, or upstream broadcast is
  // ever reached.
  //
  // Test design: drive `service.sendTransaction` (the FULL pipeline:
  // collectUtxos → selectUtxos → buildPsbt → sign → broadcast).
  // Spy `client.sendTransaction` on the blockbook port — that's the LAST
  // step (post-buildPsbt-post-signing). If the C-02 gate works, the bad
  // UTXO is rejected at collectUtxos and `client.sendTransaction` is
  // never invoked. This is the strongest behavioral proxy for "buildPsbt
  // was not called" because broadcast is downstream of buildPsbt; if
  // broadcast wasn't called, neither was buildPsbt nor signing.
  it("rejects controlled-bad-backend UTXO before buildPsbt is reached", async () => {
    const fixture = await createSigningWalletFixture();
    const broadcastSpy = jest.fn(async (_hex: string) => "should-never-fire");

    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getMnemonic: async () => walletFixtures.mnemonic,
        },
        blockbook: () => ({
          estimateFee: async () => 2,
          getAddress: async (address) => ({
            address,
            balance: address === fixture.addresses[0] ? "100000" : "0",
            txs: address === fixture.addresses[0] ? 1 : 0,
          }),
          getUtxos: async (address) =>
            address === fixture.addresses[0]
              ? [
                  {
                    txid: "ab".repeat(32),
                    vout: 0,
                    value: "100000",
                    confirmations: 10,
                    // ATTACKER-SUBSTITUTED: backend volunteers an address
                    // that does NOT match the queried xpub-derived address
                    // (`fixture.addresses[0]`). cross-check rejects.
                    address: fixture.addresses[1],
                  },
                ]
              : [],
          sendTransaction: broadcastSpy,
        }),
      }),
    );

    let caught: unknown;
    try {
      await service.sendTransaction({
        wallet: fixture.wallet,
        recipients: [{ address: fixture.recipientAddress, value: "50000" }],
        changeAddress: fixture.addresses[2],
        feeRate: "2",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(UtxoVerificationError);
    expect((caught as Error).name).toBe("UtxoVerificationError");
    // exit gate per success criterion #2: the bad UTXO never reached
    // signing/broadcast. The blockbook port's sendTransaction (downstream of
    // buildPsbt + signAllInputs) was never invoked → the entire post-
    // collectUtxos pipeline (including buildPsbt) was bypassed.
    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});

// `coreModule` namespace import is retained for forward reference / future
// regression tests that need to spy on `@prl-wallet/core` exports. The
// transaction-level negative test above uses the broadcast-port spy as a
// behavioral proxy because the namespace export is non-configurable under
// ts-jest's CJS interop. Keep the import to flag the spy seam.
void coreModule;

async function createSigningWalletFixture() {
  const context = resolveNetworkContext(walletFixtures.signingWallet.networkId);
  const seed = await mnemonicToSeed(walletFixtures.mnemonic);
  const addresses = [0, 1, 2].map((index) =>
    fixtureRecipient(context, index, seed),
  );

  return {
    wallet: walletFixtures.signingWallet,
    recipientAddress: fixtureRecipient(context, 10, seed),
    addresses,
  };
}

function fixtureRecipient(
  context: ReturnType<typeof resolveNetworkContext>,
  index: number,
  seed?: Buffer,
): string {
  const sourceSeed = seed ?? Buffer.from(walletFixtures.bip32Seed, "hex");
  const child = deriveChildKey(
    sourceSeed,
    context.network,
    context.bip86Path(0, 0, index),
  );
  return p2trAddress(child.xOnlyPubkey, context.network);
}
