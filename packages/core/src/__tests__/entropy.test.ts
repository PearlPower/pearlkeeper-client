import {
  assertSecureRandom,
  generateDistinctMnemonics,
  secureRandomInt,
} from "../entropy.js";

describe("assertSecureRandom", () => {
  it("does not throw when globalThis.crypto.getRandomValues is functional", () => {
    expect(() => assertSecureRandom()).not.toThrow();
  });

  it("throws FATAL when globalThis.crypto is missing", () => {
    const realCrypto = (globalThis as { crypto?: unknown }).crypto;
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: undefined,
      });
      expect(() => assertSecureRandom()).toThrow(/^FATAL:/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: realCrypto,
      });
    }
  });

  it("throws FATAL when getRandomValues returns all zeros", () => {
    const realCrypto = (globalThis as { crypto?: unknown }).crypto;
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {
          getRandomValues(buf: Uint8Array) {
            buf.fill(0);
            return buf;
          },
        },
      });
      expect(() => assertSecureRandom()).toThrow(/^FATAL:/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: realCrypto,
      });
    }
  });
});

describe("generateDistinctMnemonics", () => {
  it("returns 100 distinct 12-word mnemonics", () => {
    const mnemonics = generateDistinctMnemonics(100);
    expect(mnemonics).toHaveLength(100);
    expect(new Set(mnemonics).size).toBe(100);
    for (const m of mnemonics) {
      expect(m.split(" ")).toHaveLength(12);
    }
  });

  it("returns an empty array for n=0", () => {
    expect(generateDistinctMnemonics(0)).toEqual([]);
  });
});

describe("secureRandomInt (CR-2)", () => {
  it("returns values strictly in [0, maxExclusive)", () => {
    for (let trial = 0; trial < 1000; trial += 1) {
      const v = secureRandomInt(12);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(12);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("produces a roughly uniform distribution over a small range", () => {
    const N = 10_000;
    const buckets = new Array(12).fill(0);
    for (let i = 0; i < N; i += 1) {
      buckets[secureRandomInt(12)] += 1;
    }
    // Expected = N/12 ≈ 833. With CSPRNG draws the per-bucket count should
    // never deviate by more than ~20% over 10k samples.
    for (const c of buckets) {
      expect(c).toBeGreaterThan(N / 12 / 2);
      expect(c).toBeLessThan((N / 12) * 2);
    }
  });

  it("rejects invalid bounds", () => {
    expect(() => secureRandomInt(0)).toThrow();
    expect(() => secureRandomInt(1)).toThrow();
    expect(() => secureRandomInt(1.5)).toThrow();
    expect(() => secureRandomInt(0x1_0000_0001)).toThrow();
  });

  it("throws when getRandomValues is unavailable", () => {
    const realCrypto = (globalThis as { crypto?: unknown }).crypto;
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: undefined,
      });
      expect(() => secureRandomInt(10)).toThrow(/getRandomValues/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: realCrypto,
      });
    }
  });
});
