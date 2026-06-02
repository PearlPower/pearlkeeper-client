// packages/core/src/schnorr.ts
// Source: @bitcoinerlab/secp256k1 README

import { ecc } from "./ecc.js";
import { sha256 } from "@noble/hashes/sha256"; // Pure JS SHA256 — works in Hermes without Node polyfill

export const SCHNORR_TEST_MESSAGE = Buffer.from(
  "prl-wallet schnorr test message 2026",
  "utf8",
);

export interface SchnorrResult {
  signature: string; // hex
  pubkey: string; // hex x-only
  verified: boolean;
}

export function signSchnorr(
  privateKey: Buffer,
  message: Buffer = SCHNORR_TEST_MESSAGE,
): SchnorrResult {
  const msgHash = sha256(message); // Returns Uint8Array — compatible with ecc.signSchnorr/verifySchnorr
  const xOnlyPubkey = ecc.pointFromScalar(privateKey, true)!.slice(1);
  // Pass zero auxiliary randomness for deterministic signing (reproducible across platforms)
  const auxRand = Buffer.alloc(32, 0);
  const signature = ecc.signSchnorr(msgHash, privateKey, auxRand);
  const verified = ecc.verifySchnorr(msgHash, xOnlyPubkey, signature);
  return {
    signature: Buffer.from(signature).toString("hex"),
    pubkey: Buffer.from(xOnlyPubkey).toString("hex"),
    verified,
  };
}
