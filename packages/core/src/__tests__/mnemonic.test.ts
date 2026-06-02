import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
} from "../mnemonic.js";
import { TEST_MNEMONIC } from "../__fixtures__/cryptoVectors.js";

describe("generateMnemonic", () => {
  it("generates a 12-word mnemonic by default", () => {
    const m = generateMnemonic();
    expect(m.split(" ")).toHaveLength(12);
  });
  it("generates a 24-word mnemonic when strength=256", () => {
    const m = generateMnemonic(256);
    expect(m.split(" ")).toHaveLength(24);
  });
  it("generates unique mnemonics on each call", () => {
    expect(generateMnemonic()).not.toBe(generateMnemonic());
  });
});

describe("validateMnemonic", () => {
  it("returns true for a valid BIP39 mnemonic", () => {
    const m = generateMnemonic();
    expect(validateMnemonic(m)).toBe(true);
  });
  it("returns false for an invalid mnemonic", () => {
    expect(validateMnemonic("invalid mnemonic words here")).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(validateMnemonic("")).toBe(false);
  });
});

describe("mnemonicToSeed", () => {
  it("returns a 64-byte Buffer for the abandon mnemonic", async () => {
    const mnemonic = TEST_MNEMONIC;
    const seed = await mnemonicToSeed(mnemonic);
    expect(seed).toBeInstanceOf(Buffer);
    expect(seed.length).toBe(64);
  });
  it("seed is deterministic for same mnemonic", async () => {
    const mnemonic = TEST_MNEMONIC;
    const s1 = await mnemonicToSeed(mnemonic);
    const s2 = await mnemonicToSeed(mnemonic);
    expect(s1.equals(s2)).toBe(true);
  });
});
