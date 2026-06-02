// packages/core/src/index.ts
// Barrel re-exports for internal use and backward compatibility.
// Preferred: import from submodules (@prl-wallet/core/mnemonic, etc.)
export * from "./mnemonic.js";
export * from "./keys.js";
export * from "./address.js";
export * from "./tx.js";
// Keep existing exports for DebugScreen compatibility
export { BIP32, ECPair } from "./ecc.js";
// Legacy exports from derive.ts and schnorr.ts ( PoC)
export { deriveP2TRAddress } from "./derive.js";
export type { DeriveResult } from "./derive.js";
export { signSchnorr, SCHNORR_TEST_MESSAGE } from "./schnorr.js";
export type { SchnorrResult } from "./schnorr.js";
// boot-time entropy helpers ()
export {
  assertSecureRandom,
  generateDistinctMnemonics,
  secureRandomInt,
} from "./entropy.js";
