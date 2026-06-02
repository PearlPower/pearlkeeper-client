// packages/core/src/__fixtures__/cryptoVectors.ts
//
// Frozen crypto parity vectors. See ./README.md for purpose, update policy,
// and the contract these locks enforce.
//
// Consumers:
// packages/core/src/__tests__/{schnorr,address,derive,keys,mnemonic,tx}.test.ts
// apps/desktop/src/__tests__/cryptoParity.test.ts ( parity contract)
// apps/desktop/src/screens/Parity/ParityScreen.tsx ( dev-only panel)
//
// IMPORTANT: This module is intentionally self-contained — it does NOT import
// from @prl-wallet/config. The parity contract must survive product config
// changes (disabling/removing networks, renaming chains, etc.). See README.md
// section "Why not import from blockchains.json".

import type { Network } from "bitcoinjs-lib";

export const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// BTC mainnet — canonical Bitcoin Core constants. Required as input to the
// BIP86 spec test vectors below.
export const BTC_MAINNET: Network = {
  messagePrefix: "\x18Bitcoin Signed Message:\n",
  bech32: "bc",
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  wif: 0x80,
  pubKeyHash: 0x00,
  scriptHash: 0x05,
};

// PRL mainnet — frozen snapshot. Locks EXPECTED_SCHNORR_SIG_HEX below.
// messagePrefix is unused by P2TR/Schnorr derivation; the locked field is bip32.
export const PRL_MAINNET: Network = {
  messagePrefix: "\x19PRL Signed Message:\n",
  bech32: "prl",
  bip32: { public: 0x04b24746, private: 0x04b2430c },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
} as unknown as Network;

// PRL testnet — frozen snapshot. Proves the testnet code path (coin type 1,
// tprl1 HRP). Decoupled from blockchains.json so disabling/removing the
// network in product config does not break the contract.
export const PRL_TESTNET: Network = {
  messagePrefix: "\x16Pearl Signed Message:\n",
  bech32: "tprl",
  bip32: { public: 0x045f1cf6, private: 0x045f18bc },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
} as unknown as Network;

// BIP86 derivation paths — frozen alongside the expected outputs.
export const BTC_BIP86_PATH = "m/86'/0'/0'/0/0";
export const PRL_MAINNET_BIP86_PATH = "m/86'/808276'/0'/0/0";
export const PRL_TESTNET_BIP86_PATH = "m/86'/1'/0'/0/0";

// BIP86 official vectors for "abandon abandon … about".
// Source: https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki
export const EXPECTED_BTC_P2TR_ADDRESS =
  "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";
export const EXPECTED_BTC_INTERNAL_KEY =
  "cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115";
export const EXPECTED_BTC_OUTPUT_KEY =
  "a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c";

// Schnorr signature locked at planning time.
// privKey = BIP32.fromSeed(mnemonicToSeedSync(TEST_MNEMONIC), PRL_MAINNET)
// .derivePath(PRL_MAINNET_BIP86_PATH).privateKey
// sig = signSchnorr(privKey, SCHNORR_TEST_MESSAGE).signature
// auxRand= 32-byte zero buffer (deterministic — see schnorr.ts)
// To re-derive: see README.md "How to re-derive EXPECTED_SCHNORR_SIG_HEX".
export const EXPECTED_SCHNORR_SIG_HEX =
  "cd5423e10e1523f8b3c58b610681e03e7ff14e5a3c01ae9e64ff17b0703a1d4677b00b42b2eaae25f909c01dd8bf963dfcd7315032f983e64d0824c05cc93908";

// Re-export the message buffer so consumers don't need a second import.
export { SCHNORR_TEST_MESSAGE } from "../schnorr.js";
