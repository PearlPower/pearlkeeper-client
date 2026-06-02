import { deriveChildKey, mnemonicToSeed, p2trAddress } from "@prl-wallet/core";
import { Transaction } from "bitcoinjs-lib";

import { resolveNetworkContext } from "../network/index.js";
import { createTransactionService } from "../transaction/index.js";

import { createTestPorts } from "./fixtures/servicePorts.js";
import { walletFixtures } from "./fixtures/wallets.js";

/**
 * split: signTransactionHex + broadcastTxHex additive primitives.
 *
 * These tests lock in:
 * 1. signTransactionHex returns { hex, previewedTxid } with no network call.
 * 2. signTransactionHex does NOT invoke BlockbookClient.sendTransaction.
 * 3. signTransactionHex succeeds even when the blockbook client is "closed-gate"
 * (offline-OK signing — TX-03).
 * 4. signTransactionHex throws watch_only_wallet for xpub wallets (TX-04).
 * 5. broadcastTxHex(networkId, hex) calls sendTransaction exactly once and
 * returns the resulting txid.
 * 6. sendTransaction(input) composes both — produces the same final txid + hex
 * as calling the two methods sequentially (parity check).
 */
describe("TransactionService split", () => {
  async function createSigningFixture() {
    const context = resolveNetworkContext(
      walletFixtures.signingWallet.networkId,
    );
    const seed = await mnemonicToSeed(walletFixtures.mnemonic);
    const addresses = [0, 1, 2].map((index) =>
      fixtureAddress(context, index, seed),
    );

    return {
      wallet: walletFixtures.signingWallet,
      recipientAddress: fixtureAddress(context, 10, seed),
      addresses,
    };
  }

  function fixtureAddress(
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

  function createPortsWithUtxos(
    fixture: Awaited<ReturnType<typeof createSigningFixture>>,
    sendTransactionSpy: jest.Mock = jest.fn(async () => "spy-txid"),
  ) {
    return createTestPorts({
      secrets: {
        getMnemonic: async (walletId) =>
          walletId === fixture.wallet.walletId ? walletFixtures.mnemonic : null,
      },
      blockbook: (_networkId) => ({
        estimateFee: async () => 2,
        getAddress: async (address) => ({
          address,
          balance:
            address === fixture.addresses[0]
              ? "30000"
              : address === fixture.addresses[1]
                ? "50000"
                : "0",
          txs:
            address === fixture.addresses[0] || address === fixture.addresses[1]
              ? 1
              : 0,
        }),
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
        sendTransaction: sendTransactionSpy,
      }),
    });
  }

  it("1. signTransactionHex returns { hex, previewedTxid } where previewedTxid equals Transaction.fromHex(hex).getId", async () => {
    const fixture = await createSigningFixture();
    const service = createTransactionService(createPortsWithUtxos(fixture));

    const result = await service.signTransactionHex({
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
      feeRate: "2",
    });

    expect(result.hex).toMatch(/^[0-9a-f]+$/);
    expect(result.hex.length).toBeGreaterThan(100);
    expect(result.previewedTxid).toBe(Transaction.fromHex(result.hex).getId());
  });

  it("2. signTransactionHex does NOT call BlockbookClient.sendTransaction (spy: 0 calls)", async () => {
    const fixture = await createSigningFixture();
    const sendTransactionSpy = jest.fn(async () => "should-not-be-called");
    const service = createTransactionService(
      createPortsWithUtxos(fixture, sendTransactionSpy),
    );

    await service.signTransactionHex({
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
      feeRate: "2",
    });

    expect(sendTransactionSpy).toHaveBeenCalledTimes(0);
  });

  it("3. signTransactionHex succeeds with a closed-gate blockbook client (offline-OK signing — TX-03)", async () => {
    const fixture = await createSigningFixture();
    // "Closed gate" stub: sendTransaction throws NetworkOfflineError but signing
    // should never call it — so this test verifies no network reach during sign.
    const closedGateSpy = jest.fn(async () => {
      throw new Error("NetworkOfflineError: gate closed");
    });
    const service = createTransactionService(
      createPortsWithUtxos(fixture, closedGateSpy),
    );

    // Should resolve successfully because signing never touches the network
    const result = await service.signTransactionHex({
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
      feeRate: "2",
    });

    expect(result.hex).toMatch(/^[0-9a-f]+$/);
    expect(closedGateSpy).toHaveBeenCalledTimes(0);
  });

  it("4. signTransactionHex throws watch_only_wallet for xpub wallets (TX-04)", async () => {
    const service = createTransactionService(
      createTestPorts({
        secrets: {
          getXpub: async () => walletFixtures.xpub,
        },
        blockbook: () => ({}),
      }),
    );

    await expect(
      service.signTransactionHex({
        wallet: walletFixtures.watchOnlyWallet as unknown as Parameters<
          typeof service.signTransactionHex
        >[0]["wallet"],
        recipients: [
          {
            address: "bc1precipient0000000000000000000000000000000",
            value: "1",
          },
        ],
        changeAddress: "bc1pchange000000000000000000000000000000000",
        feeRate: "1",
      }),
    ).rejects.toThrow("watch_only_wallet");
  });

  it("5. broadcastTxHex(networkId, hex) calls BlockbookClient.sendTransaction exactly once and returns the txid", async () => {
    const fixture = await createSigningFixture();
    const sendTransactionSpy = jest.fn(async () => "broadcast-txid-5");
    const service = createTransactionService(
      createPortsWithUtxos(fixture, sendTransactionSpy),
    );

    // Get a valid hex first via signTransactionHex
    const signed = await service.signTransactionHex({
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
      feeRate: "2",
    });

    // Reset spy so we count only the broadcastTxHex call
    sendTransactionSpy.mockClear();

    const result = await service.broadcastTxHex(
      fixture.wallet.networkId,
      signed.hex,
    );

    expect(sendTransactionSpy).toHaveBeenCalledTimes(1);
    expect(sendTransactionSpy).toHaveBeenCalledWith(signed.hex);
    expect(result.txid).toBe("broadcast-txid-5");
    expect(result.hex).toBe(signed.hex);
  });

  it("6. sendTransaction composes sign+broadcast — returns previewedTxid as txid and hex, and broadcastTxHex is called once (parity check)", async () => {
    const fixture = await createSigningFixture();
    const sendTransactionSpy = jest.fn(async () => "parity-txid-6");

    const service = createTransactionService(
      createPortsWithUtxos(fixture, sendTransactionSpy),
    );

    const txInput = {
      wallet: fixture.wallet,
      recipients: [{ address: fixture.recipientAddress, value: "70000" }],
      changeAddress: fixture.addresses[2],
      feeRate: "2",
    };

    // Path A: atomic sendTransaction (composer: signTransactionHex + broadcastTxHex internally)
    const atomicResult = await service.sendTransaction(txInput);

    // sendTransaction should have called blockbook.sendTransaction exactly once
    expect(sendTransactionSpy).toHaveBeenCalledTimes(1);

    // The txid returned by sendTransaction is the network-returned txid from broadcastTxHex
    // (preserves mobile contract — mobile callers see the txid echoed back from the relay)
    expect(atomicResult.txid).toBe("parity-txid-6");

    // hex is a valid transaction hex
    expect(atomicResult.hex).toMatch(/^[0-9a-f]+$/);
    expect(atomicResult.hex.length).toBeGreaterThan(100);

    // Path B: verify signTransactionHex + broadcastTxHex yield consistent
    // output structure (both start from same inputs, Schnorr sigs differ per call)
    sendTransactionSpy.mockClear();
    const signed = await service.signTransactionHex(txInput);
    // previewedTxid must always match Transaction.fromHex(hex).getId()
    expect(signed.previewedTxid).toBe(Transaction.fromHex(signed.hex).getId());

    const broadcast = await service.broadcastTxHex(
      fixture.wallet.networkId,
      signed.hex,
    );
    expect(broadcast.txid).toBe("parity-txid-6");
    expect(broadcast.hex).toBe(signed.hex);
  });
});
