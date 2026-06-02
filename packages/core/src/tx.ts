// packages/core/src/tx.ts
// UTXO selection, fee estimation, PSBT build/sign/extract — pure functions
// All satoshi amounts are bigint throughout (no number for monetary values)

import { Psbt, crypto as btcCrypto } from "bitcoinjs-lib";
import type { Network } from "bitcoinjs-lib";
import type { BIP32Interface } from "bip32";
// Importing ecc.ts ensures initEccLib() is called before bitcoinjs-lib operations
import "./ecc.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Utxo {
  txid: string;
  vout: number;
  value: bigint; // satoshis
  script: Uint8Array; // scriptPubKey (P2TR output script)
}

export interface TxOutput {
  address: string;
  value: bigint; // satoshis
}

export type SelectResult =
  | { success: true; selected: Utxo[]; change: bigint }
  | { success: false; reason: "insufficient_funds" };

// Wrapper to carry the PSBT and associated tapInternalKey through sign → extract
export interface PsbtWrapper {
  psbt: Psbt;
  tapInternalKey: Buffer; // 32-byte x-only pubkey
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Dust threshold for P2TR outputs: 294 satoshis */
const DUST_THRESHOLD = 294n;

/** Taproot vsize weights (vbytes) */
const OVERHEAD_VBYTES = 10.5;
const INPUT_VBYTES = 57.5;
const OUTPUT_VBYTES = 43.0;

// ---------------------------------------------------------------------------
// estimateFee
// ---------------------------------------------------------------------------

/**
 * Estimate transaction fee for a given set of inputs/outputs and fee rate.
 *
 * Formula: ceil(10.5 + n_inputs * 57.5 + n_outputs * 43.0) * feeRate
 * All P2TR key-path spend weights (from Bitcoin CoreDev research).
 *
 * @param utxos - Input UTXOs being spent
 * @param outputs - Transaction outputs
 * @param feeRate - Fee rate in satoshis per vbyte (bigint)
 * @returns Estimated fee in satoshis (bigint)
 */
export function estimateFee(
  utxos: Utxo[],
  outputs: TxOutput[],
  feeRate: bigint,
): bigint {
  const vbytes =
    OVERHEAD_VBYTES +
    utxos.length * INPUT_VBYTES +
    outputs.length * OUTPUT_VBYTES;
  const vbytesRounded = BigInt(Math.ceil(vbytes));
  return vbytesRounded * feeRate;
}

// ---------------------------------------------------------------------------
// selectUtxos
// ---------------------------------------------------------------------------

/**
 * Select UTXOs using smallest-first coin selection.
 *
 * Algorithm:
 * 1. Sort UTXOs ascending by value
 * 2. Accumulate until sum >= target output value + estimated fee (without change)
 * 3. Calculate change = sum - target - fee_without_change
 * 4. Re-estimate fee WITH a change output
 * 5. Recalculate change = sum - target - fee_with_change
 * 6. If change < DUST_THRESHOLD, fold into miner fee (change = 0n, no change output)
 *
 * @param utxos - Available UTXOs
 * @param outputs - Desired outputs (not including change)
 * @param feeRate - Fee rate in sat/vbyte (bigint)
 * @param changeAddress - Address to send change to (used only for fee estimation)
 * @returns SelectResult with selected UTXOs and change amount (0n = folded)
 */
export function selectUtxos(
  utxos: Utxo[],
  outputs: TxOutput[],
  feeRate: bigint,
  changeAddress: string,
): SelectResult {
  // Sort smallest-first
  const sorted = [...utxos].sort((a, b) => {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return 0;
  });

  const targetTotal = outputs.reduce((sum, o) => sum + o.value, 0n);

  const selected: Utxo[] = [];
  let accumulated = 0n;

  for (const utxo of sorted) {
    selected.push(utxo);
    accumulated += utxo.value;

    // Estimate fee WITHOUT change output first
    const feeNoChange = estimateFee(selected, outputs, feeRate);

    if (accumulated >= targetTotal + feeNoChange) {
      // We have enough — now determine if change is needed
      const changeAmount = accumulated - targetTotal - feeNoChange;

      if (changeAmount === 0n) {
        // Exact fit — no change
        return { success: true, selected, change: 0n };
      }

      // Re-estimate fee WITH a change output
      const changeOutput: TxOutput[] = [
        { address: changeAddress, value: changeAmount },
      ];
      const feeWithChange = estimateFee(
        selected,
        [...outputs, ...changeOutput],
        feeRate,
      );
      const changeWithFee = accumulated - targetTotal - feeWithChange;

      if (changeWithFee < DUST_THRESHOLD) {
        // Dust — fold into miner fee, no change output
        return { success: true, selected, change: 0n };
      }

      return { success: true, selected, change: changeWithFee };
    }
  }

  // Could not accumulate enough
  return { success: false, reason: "insufficient_funds" };
}

// ---------------------------------------------------------------------------
// buildPsbt
// ---------------------------------------------------------------------------

/**
 * Build a PSBT from UTXOs and outputs.
 *
 * Each input gets:
 * witnessUtxo: { script, value: bigint } (bitcoinjs-lib v7)
 * tapInternalKey: 32-byte x-only pubkey
 *
 * `xOnlyPubkey` accepts either:
 * A single `Uint8Array` — same internal key recorded on every input
 * (single-address wallet; legacy path used with `sign()`).
 * A `Uint8Array[]` whose length matches `utxos.length` — per-input
 * internal keys for multi-address HD wallets. Required by `signAllInputs`
 * so the recorded `tapInternalKey` matches the per-input tweaked signer
 * (CR-3 — without this, an `i > 0` input is signed against the primary
 * signer's key, producing an invalid tx that broadcasts and burns the fee).
 *
 * @param utxos - Selected UTXOs to spend
 * @param outputs - Transaction outputs (NOT including change — caller provides final output list)
 * @param xOnlyPubkey - 32-byte x-only pubkey, or array of one-per-utxo
 * @param network - Bitcoin/PRL network
 * @returns PsbtWrapper containing the unsigned PSBT and the primary internal key
 */
export function buildPsbt(
  utxos: Utxo[],
  outputs: TxOutput[],
  xOnlyPubkey: Uint8Array | Uint8Array[],
  network: Network,
): PsbtWrapper {
  const psbt = new Psbt({ network });

  let perInput: Buffer[];
  if (Array.isArray(xOnlyPubkey)) {
    if (xOnlyPubkey.length !== utxos.length) {
      throw new Error(
        `buildPsbt: tapInternalKeys length (${xOnlyPubkey.length}) does not match utxos length (${utxos.length})`,
      );
    }
    perInput = xOnlyPubkey.map((k) => Buffer.from(k));
  } else {
    const uniform = Buffer.from(xOnlyPubkey);
    perInput = utxos.map(() => uniform);
  }

  for (let i = 0; i < utxos.length; i++) {
    psbt.addInput({
      hash: utxos[i].txid,
      index: utxos[i].vout,
      witnessUtxo: {
        script: utxos[i].script,
        value: utxos[i].value,
      },
      tapInternalKey: perInput[i],
    });
  }

  for (const output of outputs) {
    psbt.addOutput({
      address: output.address,
      value: output.value,
    });
  }

  // For backward compatibility, the wrapper exposes the FIRST input's internal
  // key. Callers using `sign()` (single-address legacy path) supply a single
  // key, so this is meaningful; callers using `signAllInputs` (multi-address)
  // should not rely on `wrapper.tapInternalKey` and instead pass per-input
  // signers explicitly.
  return { psbt, tapInternalKey: perInput[0] };
}

// ---------------------------------------------------------------------------
// sign
// ---------------------------------------------------------------------------

/**
 * Sign all inputs of a PSBT using Taproot key-path spending.
 *
 * Protocol (from RESEARCH.md):
 * 1. Apply TapTweak to the child node: childNode.tweak(taggedHash('TapTweak', xOnly))
 * 2. Use signTaprootInput (NOT signInput) — Taproot uses Schnorr, not ECDSA
 * 3. The tweaked signer's publicKey is used for the key-path spend
 *
 * @param wrapper - PsbtWrapper from buildPsbt
 * @param childNode - BIP32Interface for the signing key
 * @param xOnlyPubkey - 32-byte x-only pubkey (must match tapInternalKey)
 * @returns Updated PsbtWrapper with all inputs signed
 */
export function sign(
  wrapper: PsbtWrapper,
  childNode: BIP32Interface,
  xOnlyPubkey: Uint8Array,
): PsbtWrapper {
  const { psbt } = wrapper;

  // Pre-tweak: apply TapTweak tagged hash of the x-only pubkey
  const tweakHash = btcCrypto.taggedHash("TapTweak", Buffer.from(xOnlyPubkey));
  const tweakedSigner = childNode.tweak(tweakHash);

  for (let i = 0; i < psbt.data.inputs.length; i++) {
    psbt.signTaprootInput(i, tweakedSigner);
  }

  return wrapper;
}

// ---------------------------------------------------------------------------
// signAllInputs
// ---------------------------------------------------------------------------

export interface InputSigner {
  childNode: BIP32Interface;
  xOnlyPubkey: Uint8Array;
}

/**
 * Sign each PSBT input with its own derived key (multi-address HD wallet support).
 *
 * Use this function when UTXOs come from more than one derived address.
 * Each element of `inputSigners` corresponds to the PSBT input at the same index,
 * and must contain the BIP32 child node and x-only pubkey for that input's address.
 *
 * The existing sign() function signs ALL inputs with a single key — only correct
 * for single-address wallets. This function handles multi-address spending.
 *
 * @param wrapper - PsbtWrapper from buildPsbt
 * @param inputSigners - One InputSigner per PSBT input, in same order as utxos[]
 * @returns Updated PsbtWrapper with all inputs signed
 */
export function signAllInputs(
  wrapper: PsbtWrapper,
  inputSigners: InputSigner[],
): PsbtWrapper {
  const { psbt } = wrapper;

  // CR-3: assert per-input alignment BEFORE any signature is written. Without
  // this, a wallet that derives signers from multiple addresses (i > 0) but
  // built the PSBT with a single primary `tapInternalKey` will silently
  // produce a tx that fails at `finalizeAllInputs`, OR — depending on the
  // bitcoinjs-lib version — broadcasts an invalid signature that burns the
  // fee. Fail loud, fail before broadcast.
  if (inputSigners.length !== psbt.data.inputs.length) {
    throw new Error(
      `signAllInputs: signer count (${inputSigners.length}) does not match PSBT input count (${psbt.data.inputs.length})`,
    );
  }
  for (let i = 0; i < psbt.data.inputs.length; i++) {
    const signer = inputSigners[i];
    if (!signer) {
      throw new Error(`signAllInputs: missing signer for input ${i}`);
    }
    const declared = psbt.data.inputs[i].tapInternalKey;
    if (
      !declared ||
      !Buffer.from(signer.xOnlyPubkey).equals(Buffer.from(declared))
    ) {
      throw new Error(
        `signAllInputs: signer ${i} xOnlyPubkey does not match the PSBT's tapInternalKey — buildPsbt was called with a uniform key for a multi-address spend (see CR-3)`,
      );
    }
  }

  for (let i = 0; i < psbt.data.inputs.length; i++) {
    const { childNode, xOnlyPubkey } = inputSigners[i];
    const tweakHash = btcCrypto.taggedHash(
      "TapTweak",
      Buffer.from(xOnlyPubkey),
    );
    const tweakedSigner = childNode.tweak(tweakHash);
    psbt.signTaprootInput(i, tweakedSigner);
  }
  return wrapper;
}

// ---------------------------------------------------------------------------
// extract
// ---------------------------------------------------------------------------

/**
 * Finalize all inputs and extract the raw transaction hex.
 *
 * @param wrapper - PsbtWrapper with signed PSBT
 * @returns Raw transaction hex string
 */
export function extract(wrapper: PsbtWrapper): string {
  const { psbt } = wrapper;
  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}
