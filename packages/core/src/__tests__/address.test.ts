import { BIP32 } from "../ecc.js";
import { p2trAddress } from "../address.js";
import { mnemonicToSeedSync } from "@scure/bip39";
import {
  BTC_MAINNET,
  TEST_MNEMONIC as ABANDON_MNEMONIC,
} from "../__fixtures__/cryptoVectors.js";

const ABANDON_SEED = Buffer.from(mnemonicToSeedSync(ABANDON_MNEMONIC));

describe("p2trAddress — BIP86 official vectors", () => {
  it("m/86'/0'/0'/0/0 → bc1p5cyxnux...", () => {
    const root = BIP32.fromSeed(ABANDON_SEED, BTC_MAINNET);
    const child = root.derivePath("m/86'/0'/0'/0/0");
    const xOnly = child.publicKey.slice(1);
    const addr = p2trAddress(xOnly, BTC_MAINNET);
    expect(addr).toBe(
      "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
    );
  });
  it("m/86'/0'/0'/0/1 → bc1p4qhjn9z...", () => {
    const root = BIP32.fromSeed(ABANDON_SEED, BTC_MAINNET);
    const child = root.derivePath("m/86'/0'/0'/0/1");
    const xOnly = child.publicKey.slice(1);
    const addr = p2trAddress(xOnly, BTC_MAINNET);
    expect(addr).toBe(
      "bc1p4qhjn9zdvkux4e44uhx8tc55attvtyu358kutcqkudyccelu0was9fqzwh",
    );
  });
  it("m/86'/0'/0'/1/0 (change) → bc1p3qkhfews...", () => {
    const root = BIP32.fromSeed(ABANDON_SEED, BTC_MAINNET);
    const child = root.derivePath("m/86'/0'/0'/1/0");
    const xOnly = child.publicKey.slice(1);
    const addr = p2trAddress(xOnly, BTC_MAINNET);
    expect(addr).toBe(
      "bc1p3qkhfews2uk44qtvauqyr2ttdsw7svhkl9nkm9s9c3x4ax5h60wqwruhk7",
    );
  });
  it("result starts with bc1p (Taproot bech32m)", () => {
    const root = BIP32.fromSeed(ABANDON_SEED, BTC_MAINNET);
    const child = root.derivePath("m/86'/0'/0'/0/0");
    const xOnly = child.publicKey.slice(1);
    expect(p2trAddress(xOnly, BTC_MAINNET)).toMatch(/^bc1p/);
  });
});
