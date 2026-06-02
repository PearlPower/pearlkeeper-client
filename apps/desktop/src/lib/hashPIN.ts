// apps/desktop/src/lib/hashPIN.ts
//
// S-CRITICAL-1 fix — PIN is hashed with Argon2id + a per-install 16-byte
// random salt. The previous scheme was raw SHA-256(pin); for a 6-digit PIN
// the 10^6 keyspace was trivially reversible from any exfiltrated hash
// (full rainbow table ~32MB, ~1s on a modern CPU). Mirror of
// `apps/mobile/src/services/secureStorage.ts` PIN helpers (mobile parity).
//
// Storage record (opaque to callers; persisted verbatim via
// `services.secrets.storePinHash`):
//
// argon2id-v1$<saltHex:32>$<hashHex:64>
//
// Argon2id parameters — OWASP ASVS minimum (Argon2 v1.3, 2023):
// t=2 iterations, m=19 MiB, p=1 lanes, dkLen=32 bytes
//
// We use the OWASP minimum rather than the OWASP "recommended" tier (m=64MB)
// because @noble/hashes' pure-JS Argon2id is single-threaded and would
// freeze the RN UI thread for several seconds at m=64MB. Brute-force cost
// against a 6-digit PIN at these params is still ~hours on a high-end GPU
// and ~weeks on commodity CPU — combined with the rate-limit + 10-attempt
// lockout in lockStore, this raises the captured-hash recovery cost from
// "seconds" (the SHA-256 baseline) to "infeasible under realistic threats".
//
// No migration path — pre-release, no users on the legacy SHA-256 scheme.

import { argon2idAsync } from "@noble/hashes/argon2";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils";

const ARGON2ID_RECORD_PREFIX = "argon2id-v1";
const ARGON2ID_PARAMS = { t: 2, m: 19 * 1024, p: 1, dkLen: 32 } as const;
const PIN_SALT_BYTES = 16;
const PIN_ENCODER = new TextEncoder();

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) acc |= a[i] ^ b[i];
  return acc === 0;
}

/**
 * Generate a fresh PIN record for first-time setup or PIN change. The
 * returned string is opaque to callers; store it verbatim via
 * `services.secrets.storePinHash(record)` and verify with
 * `verifyPin(pin, record)`.
 */
export async function createPinRecord(pin: string): Promise<string> {
  const salt = randomBytes(PIN_SALT_BYTES);
  const hash = await argon2idAsync(
    PIN_ENCODER.encode(pin),
    salt,
    ARGON2ID_PARAMS,
  );
  return `${ARGON2ID_RECORD_PREFIX}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

/**
 * Verify a PIN against a stored record. Returns false on any parse/length
 * mismatch or hash divergence; never throws.
 */
export async function verifyPin(pin: string, record: string): Promise<boolean> {
  const parts = record.split("$");
  if (parts.length !== 3 || parts[0] !== ARGON2ID_RECORD_PREFIX) return false;
  const [, saltHex, expectedHex] = parts;
  if (saltHex.length !== PIN_SALT_BYTES * 2) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = hexToBytes(saltHex);
    expected = hexToBytes(expectedHex);
  } catch {
    return false;
  }
  const computed = await argon2idAsync(
    PIN_ENCODER.encode(pin),
    salt,
    ARGON2ID_PARAMS,
  );
  return timingSafeEqualBytes(computed, expected);
}
