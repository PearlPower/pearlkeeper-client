import {
  storeMnemonic,
  getMnemonic,
  storeBIP32Seed,
  getBIP32Seed,
  storeXpub,
  getXpub,
  deleteWalletSecrets,
  storePinHash,
  getPinHash,
  createPinRecord,
  verifyPin,
} from "./secureStorage";
import { __resetStore } from "../__mocks__/expo-secure-store";

beforeEach(() => {
  __resetStore();
});

describe("per-wallet SecureStore isolation (SC-1)", () => {
  it("stores and retrieves mnemonic independently per wallet", async () => {
    await storeMnemonic(
      "wallet-a",
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    );
    await storeMnemonic(
      "wallet-b",
      "legal winner thank year wave sausage worth useful legal winner thank yellow",
    );
    expect(await getMnemonic("wallet-a")).toContain("abandon");
    expect(await getMnemonic("wallet-b")).toContain("legal winner");
    expect(await getMnemonic("wallet-a")).not.toContain("legal winner");
  });

  it("stores and retrieves bip32Seed independently per wallet", async () => {
    await storeBIP32Seed("wallet-a", "seed-a-hex");
    await storeBIP32Seed("wallet-b", "seed-b-hex");
    expect(await getBIP32Seed("wallet-a")).toBe("seed-a-hex");
    expect(await getBIP32Seed("wallet-b")).toBe("seed-b-hex");
  });

  it("stores and retrieves xpub independently per wallet", async () => {
    await storeXpub("wallet-a", "xpub-a");
    await storeXpub("wallet-b", "xpub-b");
    expect(await getXpub("wallet-a")).toBe("xpub-a");
    expect(await getXpub("wallet-b")).toBe("xpub-b");
  });
});

describe("deleteWalletSecrets scoping (SC-2)", () => {
  it("deletes only the target wallet secrets, leaves other wallet intact", async () => {
    await storeMnemonic("wallet-a", "mnemonic-a");
    await storeBIP32Seed("wallet-a", "seed-a");
    await storeMnemonic("wallet-b", "mnemonic-b");
    await storePinHash("pin-hash-global");

    await deleteWalletSecrets("wallet-a");

    expect(await getMnemonic("wallet-a")).toBeNull();
    expect(await getBIP32Seed("wallet-a")).toBeNull();
    expect(await getMnemonic("wallet-b")).toBe("mnemonic-b");
    expect(await getPinHash()).toBe("pin-hash-global");
  });

  it("deleteWalletSecrets does not touch prl_wallet_pin_hash", async () => {
    await storePinHash("my-pin-hash");
    await storeMnemonic("wallet-x", "mnemonic-x");
    await deleteWalletSecrets("wallet-x");
    expect(await getPinHash()).toBe("my-pin-hash");
  });
});

describe("PIN hashing round-trip", () => {
  // Runs through the @noble fallback (jest mock reports native as
  // unavailable). Locks in the record format and Argon2id parameters so any
  // future drift fails here instead of on a device. Native and JS paths are
  // byte-identical for these params, so passing here = the native path also
  // produces records that verify.
  //
  // Consolidated into one test (record format + correct/wrong verify +
  // malformed handling) to keep the suite under one extra Argon2 setup
  // overhead — pure-JS m=19MiB Argon2id takes ~7s per hash under jest's
  // babel-transformed @noble.

  it("creates, verifies, and rejects malformed records", async () => {
    const record = await createPinRecord("123456");
    expect(record).toMatch(/^argon2id-v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPin("123456", record)).toBe(true);
    expect(await verifyPin("654321", record)).toBe(false);
    expect(await verifyPin("123456", "not-a-record")).toBe(false);
    expect(await verifyPin("123456", "argon2id-v1$short$hash")).toBe(false);
    expect(await verifyPin("123456", "argon2id-v0$00$00")).toBe(false);
  }, 60_000);
});
