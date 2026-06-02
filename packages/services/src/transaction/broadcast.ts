import { buildPsbt, extract, signAllInputs } from "@prl-wallet/core";
import { Transaction } from "bitcoinjs-lib";

import type { BroadcastedTransaction } from "../contracts/index.js";
import type { BlockbookPort } from "../ports/index.js";

import type { TaggedUtxo } from "./preview.js";

type SignTransactionOptions = {
  utxos: TaggedUtxo[];
  outputs: Array<{ address: string; value: bigint }>;
  inputSigners: Parameters<typeof signAllInputs>[1];
  network: import("../network/index.js").NetworkContext;
};

/**
 * Signs the transaction locally and returns { hex, previewedTxid }.
 * Does NOT touch the network — pure cryptographic operation (TX-03).
 */
export function signTransactionToHex(options: SignTransactionOptions): {
  hex: string;
  previewedTxid: string;
} {
  const primarySigner = options.inputSigners[0];

  if (!primarySigner) {
    throw new Error("insufficient_funds");
  }

  // CR-3: build the PSBT with one `tapInternalKey` per input, matching the
  // per-input signer. Previously this passed `primarySigner.xOnlyPubkey` for
  // every input — fine for single-address wallets, but the moment a
  // multi-address spend ships the signature/key mismatch silently breaks
  // finalization. `signAllInputs` also asserts the alignment as a second
  // line of defense.
  const wrapper = buildPsbt(
    options.utxos,
    options.outputs,
    options.inputSigners.map((s) => s.xOnlyPubkey),
    options.network.network,
  );
  signAllInputs(wrapper, options.inputSigners);
  const hex = extract(wrapper);
  const previewedTxid = Transaction.fromHex(hex).getId();

  return { hex, previewedTxid };
}

export async function sendTransaction(options: {
  client: BlockbookPort;
  utxos: TaggedUtxo[];
  outputs: Array<{ address: string; value: bigint }>;
  inputSigners: Parameters<typeof signAllInputs>[1];
  network: import("../network/index.js").NetworkContext;
}): Promise<BroadcastedTransaction> {
  const { hex } = signTransactionToHex(options);
  const txid = await options.client.sendTransaction(hex);

  // Return the actual txid from the network. For standard Taproot transactions
  // this matches the locally-computed signTransactionToHex previewedTxid, but
  // we trust the relay's response on unusual setups.
  return { txid, hex };
}
