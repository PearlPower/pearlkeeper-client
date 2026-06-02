import {
  selectUtxos,
  estimateFee,
  buildPsbt,
  sign,
  signAllInputs,
  extract,
} from "../tx.js";
import type { Utxo, TxOutput, InputSigner } from "../tx.js";
import { deriveChildKey } from "../keys.js";
import { p2trAddress } from "../address.js";
import { mnemonicToSeedSync } from "@scure/bip39";
import {
  PRL_MAINNET as PRL_NET,
  TEST_MNEMONIC as ABANDON_MNEMONIC,
} from "../__fixtures__/cryptoVectors.js";
import { payments } from "bitcoinjs-lib";

const SEED = Buffer.from(mnemonicToSeedSync(ABANDON_MNEMONIC));
// Derive a P2TR address to use for change
const DERIVED = deriveChildKey(SEED, PRL_NET, "m/86'/808276'/0'/1/0");
const CHANGE_ADDRESS = p2trAddress(DERIVED.xOnlyPubkey, PRL_NET);

// Helper: create a mock P2TR scriptPubKey (payments.p2tr output)
function mockP2TRScript(xOnly: Uint8Array): Uint8Array {
  return payments.p2tr({
    internalPubkey: Buffer.from(xOnly),
    network: PRL_NET,
  }).output!;
}
const SCRIPT = mockP2TRScript(DERIVED.xOnlyPubkey);

function makeUtxo(value: bigint, i = 0): Utxo {
  return {
    txid: "a".repeat(64),
    vout: i,
    value,
    script: SCRIPT,
  };
}

describe("estimateFee", () => {
  it("1 input, 1 output: ceil((10.5 + 57.5 + 43) * rate)", () => {
    const utxos: Utxo[] = [makeUtxo(100000n)];
    const outputs: TxOutput[] = [{ address: CHANGE_ADDRESS, value: 90000n }];
    // 10.5 + 57.5 + 43 = 111 vbytes; ceil(111) * 5 = 555
    expect(estimateFee(utxos, outputs, 5n)).toBe(555n);
  });
  it("2 inputs, 2 outputs", () => {
    const utxos: Utxo[] = [makeUtxo(50000n), makeUtxo(50000n, 1)];
    const outputs: TxOutput[] = [
      { address: CHANGE_ADDRESS, value: 40000n },
      { address: CHANGE_ADDRESS, value: 40000n },
    ];
    // 10.5 + 2*57.5 + 2*43 = 211.5 vbytes; ceil(211.5) * 2 = 212 * 2 = 424
    expect(estimateFee(utxos, outputs, 2n)).toBe(424n);
  });
  it("returns bigint", () => {
    const fee = estimateFee(
      [makeUtxo(100000n)],
      [{ address: CHANGE_ADDRESS, value: 90000n }],
      1n,
    );
    expect(typeof fee).toBe("bigint");
  });
});

describe("selectUtxos", () => {
  it("selects smallest UTXOs first", () => {
    const utxos: Utxo[] = [
      makeUtxo(50000n, 0),
      makeUtxo(10000n, 1), // smallest
      makeUtxo(100000n, 2),
    ];
    const outputs: TxOutput[] = [{ address: CHANGE_ADDRESS, value: 8000n }];
    const result = selectUtxos(utxos, outputs, 1n, CHANGE_ADDRESS);
    expect(result.success).toBe(true);
    if (result.success) {
      // smallest (10000) should be selected first
      expect(result.selected[0].value).toBe(10000n);
    }
  });
  it("returns insufficient_funds when UTXOs cannot cover amount", () => {
    const utxos: Utxo[] = [makeUtxo(1000n)];
    const outputs: TxOutput[] = [{ address: CHANGE_ADDRESS, value: 999999n }];
    const result = selectUtxos(utxos, outputs, 1n, CHANGE_ADDRESS);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("insufficient_funds");
    }
  });
  it("folds dust change into miner fee (no change output)", () => {
    // Choose values where change would be < 294n (dust threshold)
    // 1 input + 1 output: overhead=111 vbytes at 1 sat/vbyte = 111 sat fee
    // Total: value=10000, target=9600, fee=111 -> change = 289 < 294 -> fold into fee
    const utxos: Utxo[] = [makeUtxo(10000n)];
    const outputs: TxOutput[] = [{ address: CHANGE_ADDRESS, value: 9600n }];
    const result = selectUtxos(utxos, outputs, 1n, CHANGE_ADDRESS);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.change).toBe(0n); // dust folded into fee
    }
  });
  it("returns change when above dust threshold", () => {
    const utxos: Utxo[] = [makeUtxo(100000n)];
    const outputs: TxOutput[] = [{ address: CHANGE_ADDRESS, value: 50000n }];
    const result = selectUtxos(utxos, outputs, 1n, CHANGE_ADDRESS);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.change).toBeGreaterThan(294n);
    }
  });
});

describe("buildPsbt + sign + extract round-trip", () => {
  it("produces a non-empty transaction hex", () => {
    const derived = deriveChildKey(SEED, PRL_NET, "m/86'/808276'/0'/0/0");
    const recipientAddress = p2trAddress(derived.xOnlyPubkey, PRL_NET);
    const utxos: Utxo[] = [
      {
        txid: "b".repeat(64),
        vout: 0,
        value: 100000n,
        script: mockP2TRScript(derived.xOnlyPubkey),
      },
    ];
    const outputs: TxOutput[] = [{ address: recipientAddress, value: 90000n }];
    const wrapper = buildPsbt(utxos, outputs, derived.xOnlyPubkey, PRL_NET);
    const signed = sign(wrapper, derived.childNode, derived.xOnlyPubkey);
    const txHex = extract(signed);
    expect(typeof txHex).toBe("string");
    expect(txHex.length).toBeGreaterThan(100);
    // Valid hex
    expect(txHex).toMatch(/^[0-9a-f]+$/);
  });
});

describe("CR-3 — multi-address PSBT building and signing", () => {
  // Two derived addresses under the same seed — the same shape as a
  // real multi-address spend.
  const aliceDerived = deriveChildKey(SEED, PRL_NET, "m/86'/808276'/0'/0/0");
  const bobDerived = deriveChildKey(SEED, PRL_NET, "m/86'/808276'/0'/0/1");

  function makeMultiUtxos(): Utxo[] {
    return [
      {
        txid: "a".repeat(64),
        vout: 0,
        value: 50_000n,
        script: mockP2TRScript(aliceDerived.xOnlyPubkey),
      },
      {
        txid: "b".repeat(64),
        vout: 0,
        value: 50_000n,
        script: mockP2TRScript(bobDerived.xOnlyPubkey),
      },
    ];
  }

  const RECIPIENT = p2trAddress(
    deriveChildKey(SEED, PRL_NET, "m/86'/808276'/0'/0/9").xOnlyPubkey,
    PRL_NET,
  );

  it("buildPsbt accepts a per-input key array and records each input's own tapInternalKey", () => {
    const utxos = makeMultiUtxos();
    const outputs: TxOutput[] = [{ address: RECIPIENT, value: 80_000n }];
    const wrapper = buildPsbt(
      utxos,
      outputs,
      [aliceDerived.xOnlyPubkey, bobDerived.xOnlyPubkey],
      PRL_NET,
    );
    const input0Key = wrapper.psbt.data.inputs[0].tapInternalKey;
    const input1Key = wrapper.psbt.data.inputs[1].tapInternalKey;
    expect(input0Key).toBeDefined();
    expect(input1Key).toBeDefined();
    expect(
      Buffer.from(input0Key!).equals(Buffer.from(aliceDerived.xOnlyPubkey)),
    ).toBe(true);
    expect(
      Buffer.from(input1Key!).equals(Buffer.from(bobDerived.xOnlyPubkey)),
    ).toBe(true);
  });

  it("buildPsbt rejects a per-input key array of wrong length", () => {
    const utxos = makeMultiUtxos();
    const outputs: TxOutput[] = [{ address: RECIPIENT, value: 80_000n }];
    expect(() =>
      buildPsbt(utxos, outputs, [aliceDerived.xOnlyPubkey], PRL_NET),
    ).toThrow(/length .* does not match/);
  });

  it("signAllInputs succeeds when per-input keys match (multi-address path)", () => {
    const utxos = makeMultiUtxos();
    const outputs: TxOutput[] = [{ address: RECIPIENT, value: 80_000n }];
    const wrapper = buildPsbt(
      utxos,
      outputs,
      [aliceDerived.xOnlyPubkey, bobDerived.xOnlyPubkey],
      PRL_NET,
    );
    const signers: InputSigner[] = [
      {
        childNode: aliceDerived.childNode,
        xOnlyPubkey: aliceDerived.xOnlyPubkey,
      },
      { childNode: bobDerived.childNode, xOnlyPubkey: bobDerived.xOnlyPubkey },
    ];
    expect(() => signAllInputs(wrapper, signers)).not.toThrow();
    const txHex = extract(wrapper);
    expect(txHex).toMatch(/^[0-9a-f]+$/);
  });

  it("signAllInputs FAILS LOUDLY when buildPsbt used a uniform key but signers diverge (regression: CR-3)", () => {
    // Reproduces the pre-fix behavior: a multi-address spend built with one
    // primary tapInternalKey. The new assertion must catch this before any
    // signature is written.
    const utxos = makeMultiUtxos();
    const outputs: TxOutput[] = [{ address: RECIPIENT, value: 80_000n }];
    const wrapper = buildPsbt(
      utxos,
      outputs,
      aliceDerived.xOnlyPubkey, // single key — wrong for multi-address
      PRL_NET,
    );
    const signers: InputSigner[] = [
      {
        childNode: aliceDerived.childNode,
        xOnlyPubkey: aliceDerived.xOnlyPubkey,
      },
      { childNode: bobDerived.childNode, xOnlyPubkey: bobDerived.xOnlyPubkey },
    ];
    expect(() => signAllInputs(wrapper, signers)).toThrow(
      /CR-3|tapInternalKey/,
    );
  });

  it("signAllInputs rejects when signer count != input count", () => {
    const utxos = makeMultiUtxos();
    const outputs: TxOutput[] = [{ address: RECIPIENT, value: 80_000n }];
    const wrapper = buildPsbt(
      utxos,
      outputs,
      [aliceDerived.xOnlyPubkey, bobDerived.xOnlyPubkey],
      PRL_NET,
    );
    const signers: InputSigner[] = [
      {
        childNode: aliceDerived.childNode,
        xOnlyPubkey: aliceDerived.xOnlyPubkey,
      },
    ];
    expect(() => signAllInputs(wrapper, signers)).toThrow(/signer count/);
  });

  it("single-address path (uniform key) still works end-to-end", () => {
    const derived = aliceDerived;
    const utxos: Utxo[] = [
      {
        txid: "c".repeat(64),
        vout: 0,
        value: 100_000n,
        script: mockP2TRScript(derived.xOnlyPubkey),
      },
    ];
    const outputs: TxOutput[] = [{ address: RECIPIENT, value: 90_000n }];
    const wrapper = buildPsbt(utxos, outputs, derived.xOnlyPubkey, PRL_NET);
    const signers: InputSigner[] = [
      { childNode: derived.childNode, xOnlyPubkey: derived.xOnlyPubkey },
    ];
    expect(() => signAllInputs(wrapper, signers)).not.toThrow();
    const txHex = extract(wrapper);
    expect(txHex).toMatch(/^[0-9a-f]+$/);
  });
});
