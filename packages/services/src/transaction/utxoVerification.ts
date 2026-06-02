// packages/services/src/transaction/utxoVerification.ts
// / C-02 / INDEXER-02 — Belt-and-braces UTXO scriptPubKey re-derive check.
//
// The backend's UTXO wire shape OMITS scriptPubKey (the field is
// stripped at the routes/v1/indexer.ts boundary so the client cannot
// accidentally trust a backend-supplied locking script). The client
// re-derives the script locally from the xpub-known address before signing.
//
// This file is the explicit invariant assertion that runs BEFORE any UTXO
// can reach `selectUtxos` or `buildPsbt`. Three checks:
// 1. Round-trip identity:
// btcAddress.toOutputScript(expectedAddress) → fromOutputScript → expectedAddress.
// Any malformed/network-mismatched address fails here.
// 2. Decode-back validity (folded into the round-trip — the
// `fromOutputScript` call throws if the derived script is not a valid
// output script for any address shape).
// 3. Cross-check: when the backend volunteers a `utxo.address`, it MUST
// equal `expectedAddress`. (Defense-in-depth — omits the field
// from the wire today, but if a future backend includes it, this is
// the gate.)
//
// On any check failure, throws `UtxoVerificationError` ( stable name)
// with the offending utxo + expectedAddress attached for forensic logging.

import { address as btcAddress, type Network } from "bitcoinjs-lib";

import { UtxoVerificationError } from "../contracts/errors.js";

/**
 * Minimal shape we actually inspect. Both `BlockbookUtxo` (legacy direct
 * client) and `BackendUtxo` (+ wire shape) match this; the function
 * works uniformly across the cutover boundary.
 */
export interface UtxoLike {
  txid: string;
  vout: number;
  value: string | number;
  confirmations?: number;
  coinbase?: boolean;
  /**
   * When present, MUST equal `expectedAddress`. Undefined is allowed —
   * the wire shape () omits the field today; this hook only fires
   * if a future backend includes it.
   */
  address?: string;
}

/**
 * / C-02 / INDEXER-02: assert that a backend-returned UTXO is consistent
 * with the locally-known xpub-derived `expectedAddress`. Throws
 * `UtxoVerificationError` BEFORE any UTXO data can reach `selectUtxos()` or
 * `buildPsbt()` — fund-theft mitigation.
 */
export function assertScriptMatchesAddress(
  utxo: UtxoLike,
  expectedAddress: string,
  network: Network,
): void {
  // 1. Round-trip identity: the address must re-derive to a script that
  // decodes back to the same address. Any malformed/network-mismatched
  // address fails here. (bitcoinjs-lib v7 returns Uint8Array, not Buffer
  // we only need it as opaque bytes for the round-trip.)
  let script: Uint8Array;
  try {
    script = btcAddress.toOutputScript(expectedAddress, network);
  } catch {
    throw new UtxoVerificationError(
      `expectedAddress ${expectedAddress} is not valid for the network`,
      utxo,
      expectedAddress,
    );
  }

  let roundTripped: string;
  try {
    roundTripped = btcAddress.fromOutputScript(script, network);
  } catch {
    throw new UtxoVerificationError(
      `address ${expectedAddress} produced a script that does not decode back to a valid address`,
      utxo,
      expectedAddress,
    );
  }

  if (roundTripped !== expectedAddress) {
    throw new UtxoVerificationError(
      `address round-trip mismatch: expected ${expectedAddress} got ${roundTripped}`,
      utxo,
      expectedAddress,
    );
  }

  // 2. Cross-check: when the backend volunteers an `address` field, it MUST
  // equal the queried address. (Defense-in-depth; omits scriptPubKey
  // from the wire, but if a future backend includes a mismatched
  // `address`, this is the gate.)
  if (utxo.address !== undefined && utxo.address !== expectedAddress) {
    throw new UtxoVerificationError(
      `backend-supplied UTXO.address ${utxo.address} does not match queried address ${expectedAddress}`,
      utxo,
      expectedAddress,
    );
  }
}
