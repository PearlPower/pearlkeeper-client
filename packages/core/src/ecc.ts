// packages/core/src/ecc.ts
// Source: @bitcoinerlab/secp256k1 README + team decision

// EXPLICIT DECISION: tiny-secp256k1 uses WASM which Hermes does not support.
// We use @bitcoinerlab/secp256k1 (pure JS, noble-curves backed) as the primary
// implementation. If a future Hermes version supports WASM, revisit this.
import ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import { ECPairFactory } from "ecpair";
import { initEccLib } from "bitcoinjs-lib";

// Initialize bitcoinjs-lib with the ECC library (required for payments.p2tr and other ECC operations)
initEccLib(ecc);

export const BIP32 = BIP32Factory(ecc);
export const ECPair = ECPairFactory(ecc);
export { ecc };
