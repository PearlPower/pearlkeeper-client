// apps/desktop/src/__tests__/hashPIN.test.ts
//
// S-CRITICAL-1 fix — replaces the legacy SHA-256(pin) helper tests. The new
// PIN-record format is `argon2id-v1$<saltHex:32>$<hashHex:64>` with a fresh
// 16-byte random salt per record; verifyPin parses the record and re-hashes
// against the stored salt with constant-time comparison.

import { describe, test, expect } from "vitest";
import { createPinRecord, verifyPin } from "@/lib/hashPIN";

describe("createPinRecord (S-CRITICAL-1)", () => {
  test("returns a record in the documented format", async () => {
    const record = await createPinRecord("123456");
    expect(record).toMatch(/^argon2id-v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  });

  test("produces a DIFFERENT record for the same PIN on each call (fresh salt)", async () => {
    // The whole POINT of the salt: identical PINs must NOT produce identical
    // records on disk. A rainbow table built against one user's stored hash
    // must be useless against any other.
    const a = await createPinRecord("123456");
    const b = await createPinRecord("123456");
    expect(a).not.toBe(b);
    // Salt portion differs
    const [, saltA] = a.split("$");
    const [, saltB] = b.split("$");
    expect(saltA).not.toBe(saltB);
  });

  test("salt is 16 random bytes (32 hex chars) — regression on PIN_SALT_BYTES", async () => {
    const record = await createPinRecord("987654");
    const [, salt] = record.split("$");
    expect(salt.length).toBe(32);
  });
});

describe("verifyPin (S-CRITICAL-1)", () => {
  test("accepts the correct PIN", async () => {
    const record = await createPinRecord("123456");
    expect(await verifyPin("123456", record)).toBe(true);
  });

  test("rejects a wrong PIN", async () => {
    const record = await createPinRecord("123456");
    expect(await verifyPin("123457", record)).toBe(false);
    expect(await verifyPin("000000", record)).toBe(false);
    expect(await verifyPin("", record)).toBe(false);
  });

  test("rejects a malformed record (returns false, never throws)", async () => {
    expect(await verifyPin("123456", "")).toBe(false);
    expect(await verifyPin("123456", "argon2id-v1$nothex$nothex")).toBe(false);
    expect(await verifyPin("123456", "sha256-legacy$xx$yy")).toBe(false);
    expect(await verifyPin("123456", "argon2id-v1$abc$def")).toBe(false); // wrong salt length
    // Wrong algo version
    expect(
      await verifyPin(
        "123456",
        "argon2id-v2$" + "0".repeat(32) + "$" + "0".repeat(64),
      ),
    ).toBe(false);
  });

  test("symmetric: createPinRecord output verifies for the same PIN regardless of which call produced it", async () => {
    // Several round-trips — paranoid uniformity check across distinct salts.
    // Kept short because @noble/hashes' Argon2id is pure-JS and runs at
    // ~300-500ms/call on V8; the contract is fully covered by 3 iterations.
    for (let i = 0; i < 3; i += 1) {
      const r = await createPinRecord("424242");
      expect(await verifyPin("424242", r)).toBe(true);
    }
  }, 15_000);
});
