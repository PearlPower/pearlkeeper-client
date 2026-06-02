// apps/desktop/src/__tests__/cryptoParity.test.ts
//
// + contract. Strict equality against the locked fixtures
// from packages/core/__fixtures__/cryptoVectors. Round-trip / regex / verified-only
// is too weak — it would miss a silent crypto-lib divergence that produces a
// valid-but-different Schnorr signature (CONTEXT ).
//
// Runs under vitest+jsdom in apps/desktop. 's CI matrix runs this on
// macOS / Windows / Ubuntu () so any platform-specific Buffer / WebCrypto /
// jsdom edge case fails immediately.

import { describe, it, expect, beforeAll } from "vitest";
import { mnemonicToSeedSync } from "@scure/bip39";
import { BIP32, signSchnorr, p2trAddress } from "@prl-wallet/core";
import {
  TEST_MNEMONIC,
  BTC_MAINNET,
  PRL_MAINNET,
  BTC_BIP86_PATH,
  PRL_MAINNET_BIP86_PATH,
  EXPECTED_BTC_P2TR_ADDRESS,
  EXPECTED_BTC_INTERNAL_KEY,
  EXPECTED_SCHNORR_SIG_HEX,
  SCHNORR_TEST_MESSAGE,
} from "@prl-wallet/core/fixtures/cryptoVectors";

describe("crypto parity ( / )", () => {
  let seed: Buffer;

  beforeAll(() => {
    seed = Buffer.from(mnemonicToSeedSync(TEST_MNEMONIC));
  });

  it("derives the BIP86 canonical BTC P2TR address byte-identically", () => {
    const root = BIP32.fromSeed(seed, BTC_MAINNET);
    const child = root.derivePath(BTC_BIP86_PATH);
    const xOnly = Buffer.from(child.publicKey).slice(1);

    expect(xOnly.toString("hex")).toBe(EXPECTED_BTC_INTERNAL_KEY);
    expect(p2trAddress(xOnly, BTC_MAINNET)).toBe(EXPECTED_BTC_P2TR_ADDRESS);
  });

  it("produces a byte-identical PRL Schnorr signature", () => {
    const root = BIP32.fromSeed(seed, PRL_MAINNET);
    const child = root.derivePath(PRL_MAINNET_BIP86_PATH);
    if (!child.privateKey) {
      throw new Error("PRL_MAINNET derivation produced no private key");
    }
    const result = signSchnorr(
      Buffer.from(child.privateKey),
      SCHNORR_TEST_MESSAGE,
    );

    expect(result.verified).toBe(true);
    expect(result.signature).toBe(EXPECTED_SCHNORR_SIG_HEX);
  });

  it("guards against accidental fixture rollback", () => {
    expect(EXPECTED_SCHNORR_SIG_HEX).not.toBe("TODO_COMPUTE_AT_PLAN_TIME");
    expect(EXPECTED_SCHNORR_SIG_HEX).toMatch(/^[0-9a-f]{128}$/);
  });
});
