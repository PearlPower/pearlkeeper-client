// packages/core/src/entropy.ts
//
// Boot-time entropy helpers (). Consumed by both apps' boot sequences so
// the / mobile equivalent uses literally the same code.

import { generateMnemonic } from "./mnemonic.js";

/**
 * Asserts the runtime exposes a working CSPRNG. Called once at app boot.
 * Throws if absent so React never mounts — a wallet without secure random
 * is unusable and any silent fallback (Math.random) is fund-loss territory
 * (P7 from research/).
 */
export function assertSecureRandom(): void {
  const g = globalThis as {
    crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array };
  };
  if (!g.crypto || typeof g.crypto.getRandomValues !== "function") {
    throw new Error(
      "FATAL: globalThis.crypto.getRandomValues is unavailable. Refusing to start.",
    );
  }
  const buf = new Uint8Array(32);
  g.crypto.getRandomValues(buf);
  if (buf.every((b) => b === 0)) {
    throw new Error(
      "FATAL: globalThis.crypto.getRandomValues returned all-zero buffer.",
    );
  }
}

/**
 * Generates `n` 12-word mnemonics. Caller asserts uniqueness — keeps
 * this minimal: `assertSecureRandom` validates the RNG pipeline,
 * `generateDistinctMnemonics(100)` + Set-size check validates that
 * `@scure/bip39`'s entropy path actually consumes that RNG.
 */
export function generateDistinctMnemonics(n: number): string[] {
  const mnemonics: string[] = [];
  for (let i = 0; i < n; i += 1) {
    mnemonics.push(generateMnemonic(128));
  }
  return mnemonics;
}

/**
 * Cryptographically-secure uniform integer in `[0, maxExclusive)`.
 *
 * Why this exists: `Math.random()` is not a CSPRNG and is observable from
 * co-installed processes on some RN runtimes (CR-2). Every "random" pick in
 * the wallet codebase that affects security — including the seed-verify
 * challenge — MUST route through this helper.
 *
 * Implementation note: uses rejection sampling to remove modulo bias. For
 * the small moduli we use in practice (12, 24, 2048, 4) the rejection rate
 * is effectively zero, so the cost is one `getRandomValues` call.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (
    !Number.isInteger(maxExclusive) ||
    maxExclusive <= 0 ||
    maxExclusive > 0x1_0000_0000
  ) {
    throw new Error(
      `secureRandomInt: maxExclusive must be an integer in (0, 2^32], got ${maxExclusive}`,
    );
  }
  const g = globalThis as {
    crypto?: { getRandomValues?: (b: Uint32Array) => Uint32Array };
  };
  if (!g.crypto || typeof g.crypto.getRandomValues !== "function") {
    throw new Error(
      "secureRandomInt: globalThis.crypto.getRandomValues is unavailable",
    );
  }
  // Largest multiple of maxExclusive that fits in 2^32; reject draws above
  // that threshold so the remaining range is exactly divisible.
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    g.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
}
