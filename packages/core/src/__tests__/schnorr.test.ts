import { BIP32, signSchnorr, SCHNORR_TEST_MESSAGE } from "../index.js";
import { mnemonicToSeedSync } from "@scure/bip39";
import {
  TEST_MNEMONIC,
  PRL_MAINNET as PRL_NET,
} from "../__fixtures__/cryptoVectors.js";

describe("Schnorr signing", () => {
  let privateKey: Buffer;

  beforeAll(() => {
    const seed = Buffer.from(mnemonicToSeedSync(TEST_MNEMONIC));
    const root = BIP32.fromSeed(seed, PRL_NET);
    const child = root.derivePath("m/86'/808276'/0'/0/0");
    if (!child.privateKey) throw new Error("No private key");
    privateKey = Buffer.from(child.privateKey);
  });

  it("signs and verifies the fixed test message", () => {
    const result = signSchnorr(privateKey);
    expect(result.verified).toBe(true);
    expect(result.signature).toMatch(/^[0-9a-f]{128}$/); // 64 bytes = 128 hex chars
    expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/); // 32 bytes x-only
  });

  it("produces deterministic signatures from same key", () => {
    const r1 = signSchnorr(privateKey);
    const r2 = signSchnorr(privateKey);
    expect(r1.signature).toBe(r2.signature);
  });

  it("SCHNORR_TEST_MESSAGE is a non-empty Buffer", () => {
    expect(Buffer.isBuffer(SCHNORR_TEST_MESSAGE)).toBe(true);
    expect(SCHNORR_TEST_MESSAGE.length).toBeGreaterThan(0);
  });
});
