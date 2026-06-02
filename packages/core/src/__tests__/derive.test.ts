import {
  generateMnemonic,
  isValidMnemonic,
  deriveP2TRAddress,
} from "../index.js";
import {
  TEST_MNEMONIC,
  PRL_MAINNET as PRL_MAINNET_FIXTURE,
  PRL_TESTNET as PRL_TESTNET_NET,
} from "../__fixtures__/cryptoVectors.js";

const bip86MainnetPath = (a = 0, c = 0, i = 0) =>
  `m/86'/808276'/${a}'/${c}/${i}`;

const bip86TestnetPath = (a = 0, c = 0, i = 0) => `m/86'/1'/${a}'/${c}/${i}`;

describe("mnemonic generation", () => {
  it("generates a valid 12-word mnemonic", () => {
    // generateMnemonic takes strength (bits): 128 = 12 words, 256 = 24 words
    const mnemonic = generateMnemonic(128);
    const words = mnemonic.split(" ");
    expect(words).toHaveLength(12);
    expect(isValidMnemonic(mnemonic)).toBe(true);
  });

  it("generates a valid 24-word mnemonic", () => {
    const mnemonic = generateMnemonic(256);
    expect(mnemonic.split(" ")).toHaveLength(24);
    expect(isValidMnemonic(mnemonic)).toBe(true);
  });

  it("generates different mnemonics on each call", () => {
    const a = generateMnemonic();
    const b = generateMnemonic();
    expect(a).not.toBe(b);
  });
});

describe("P2TR address derivation", () => {
  it("derives a mainnet prl1... address", async () => {
    const result = await deriveP2TRAddress(
      TEST_MNEMONIC,
      PRL_MAINNET_FIXTURE,
      bip86MainnetPath,
    );
    expect(result.address).toMatch(/^prl1/);
  });

  it("derives a testnet tprl1... address", async () => {
    const result = await deriveP2TRAddress(
      TEST_MNEMONIC,
      PRL_TESTNET_NET,
      bip86TestnetPath,
    );
    expect(result.address).toMatch(/^tprl1/);
  });

  it("returns seed, rootXpub, and internalPubkey", async () => {
    const result = await deriveP2TRAddress(
      TEST_MNEMONIC,
      PRL_TESTNET_NET,
      bip86TestnetPath,
    );
    expect(result.seed).toMatch(/^[0-9a-f]+$/);
    // PRL uses custom bip32 version bytes — xpub prefix differs from Bitcoin xpub/tpub.
    // Check it is a non-empty base58 string of expected length (111 chars for xpub).
    expect(result.rootXpub).toMatch(/^[1-9A-HJ-NP-Za-km-z]{100,}$/);
    expect(result.internalPubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic addresses from same mnemonic", async () => {
    const r1 = await deriveP2TRAddress(
      TEST_MNEMONIC,
      PRL_TESTNET_NET,
      bip86TestnetPath,
    );
    const r2 = await deriveP2TRAddress(
      TEST_MNEMONIC,
      PRL_TESTNET_NET,
      bip86TestnetPath,
    );
    expect(r1.address).toBe(r2.address);
  });
});
