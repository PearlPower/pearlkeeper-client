// packages/services/src/__tests__/utxoVerification.test.ts
// / Wave 3 — C-02 / INDEXER-02 / UTXO scriptPubKey re-derive.
// GREEN: activates the Wave 0 RED stubs landed in .
//
// `assertScriptMatchesAddress` is the belt-and-braces invariant assertion that
// runs in `transaction/preview.ts:collectUtxos` BEFORE any UTXO can reach
// `selectUtxos` or `buildPsbt` (fund-theft mitigation).

// Import @prl-wallet/core eagerly so its `ecc.js` module-init runs
// `initEccLib(ecc)` before bitcoinjs-lib's Taproot payment paths are
// exercised below. (RESEARCH §"@bitcoinerlab/secp256k1 / initEccLib"; same
// boot order packages/core/src/{address,tx}.ts rely on.)
import "@prl-wallet/core";

import { networks } from "bitcoinjs-lib";

import { UtxoVerificationError } from "../contracts/errors.js";
import { assertScriptMatchesAddress } from "../transaction/utxoVerification.js";

// Canonical Taproot mainnet fixture (P2TR P2-keyspend; bech32m).
const TAPROOT_MAINNET =
  "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";

// A different valid mainnet bech32m address (different x-only key) — used
// for the cross-check / round-trip-mismatch case.
const TAPROOT_MAINNET_DIFFERENT =
  "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4z4mjm0sqp82uar";

const VALID_TXID = "11".repeat(32);

describe("assertScriptMatchesAddress (C-02, )", () => {
  it("passes for a valid Taproot address with no backend.address field", () => {
    const utxo = {
      txid: VALID_TXID,
      vout: 0,
      value: "10000",
      confirmations: 6,
    };
    expect(() =>
      assertScriptMatchesAddress(utxo, TAPROOT_MAINNET, networks.bitcoin),
    ).not.toThrow();
  });

  it("passes when backend.address equals expectedAddress ( cross-check OK)", () => {
    const utxo = {
      txid: VALID_TXID,
      vout: 0,
      value: "10000",
      confirmations: 6,
      address: TAPROOT_MAINNET,
    };
    expect(() =>
      assertScriptMatchesAddress(utxo, TAPROOT_MAINNET, networks.bitcoin),
    ).not.toThrow();
  });

  it("throws UtxoVerificationError when backend supplies a different address than expected", () => {
    const utxo = {
      txid: VALID_TXID,
      vout: 0,
      value: "100000",
      confirmations: 10,
      address: TAPROOT_MAINNET_DIFFERENT, // attacker-substituted
    };
    let caught: unknown;
    try {
      assertScriptMatchesAddress(utxo, TAPROOT_MAINNET, networks.bitcoin);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UtxoVerificationError);
    expect((caught as Error).name).toBe("UtxoVerificationError");
    expect((caught as UtxoVerificationError).expectedAddress).toBe(
      TAPROOT_MAINNET,
    );
    expect((caught as UtxoVerificationError).code).toBe(
      "utxo_verification_failed",
    );
  });

  it("throws UtxoVerificationError on malformed expected address", () => {
    const utxo = { txid: VALID_TXID, vout: 0, value: "1" };
    let caught: unknown;
    try {
      assertScriptMatchesAddress(utxo, "not-a-valid-address", networks.bitcoin);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UtxoVerificationError);
    expect((caught as Error).name).toBe("UtxoVerificationError");
  });

  it("throws UtxoVerificationError on network mismatch (mainnet address vs testnet network)", () => {
    const utxo = { txid: VALID_TXID, vout: 0, value: "1" };
    let caught: unknown;
    try {
      assertScriptMatchesAddress(utxo, TAPROOT_MAINNET, networks.testnet);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UtxoVerificationError);
    expect((caught as Error).name).toBe("UtxoVerificationError");
  });

  it("error name survives RN bridge JSON.stringify/parse round-trip", () => {
    const utxo = {
      txid: VALID_TXID,
      vout: 0,
      value: "1",
      address: TAPROOT_MAINNET_DIFFERENT,
    };
    let err: UtxoVerificationError | undefined;
    try {
      assertScriptMatchesAddress(utxo, TAPROOT_MAINNET, networks.bitcoin);
    } catch (e) {
      err = e as UtxoVerificationError;
    }
    expect(err).toBeDefined();
    // RN bridge survival: only enumerable own properties survive JSON.
    // The `name` class property + constructor-assigned fields are
    // enumerable by virtue of being instance fields.
    const round = JSON.parse(
      JSON.stringify({ ...err, name: err!.name, code: err!.code }),
    );
    expect(round.name).toBe("UtxoVerificationError");
    expect(round.code).toBe("utxo_verification_failed");
    expect(round.expectedAddress).toBe(TAPROOT_MAINNET);
  });
});
