import { generateChallenge } from "../useSeedVerifyFlow.js";

const FIXTURE_MNEMONIC = [
  "abandon",
  "ability",
  "able",
  "about",
  "above",
  "absent",
  "absorb",
  "abstract",
  "absurd",
  "abuse",
  "access",
  "accident",
];

describe("CR-2 — useSeedVerifyFlow.generateChallenge", () => {
  it("produces exactly 4 blanks with 4 unique choices each, one being correct", () => {
    const c = generateChallenge(FIXTURE_MNEMONIC);
    expect(c.blanks).toHaveLength(4);
    const positions = c.blanks.map((b) => b.position);
    expect(new Set(positions).size).toBe(4);
    for (const b of c.blanks) {
      expect(b.choices).toHaveLength(4);
      expect(new Set(b.choices).size).toBe(4);
      expect(b.choices).toContain(b.correct);
      expect(b.correct).toBe(FIXTURE_MNEMONIC[b.position]);
    }
  });

  it("blanks are sorted ascending by position", () => {
    const c = generateChallenge(FIXTURE_MNEMONIC);
    for (let i = 1; i < c.blanks.length; i += 1) {
      expect(c.blanks[i].position).toBeGreaterThan(c.blanks[i - 1].position);
    }
  });

  it("does NOT call Math.random (regression: CR-2 — CSPRNG only)", () => {
    const originalRandom = Math.random;
    const spy = jest.fn(() => 0.5);
    Math.random = spy as typeof Math.random;
    try {
      generateChallenge(FIXTURE_MNEMONIC);
      // Many iterations to be sure no Fisher-Yates branch slipped through.
      for (let i = 0; i < 50; i += 1) {
        generateChallenge(FIXTURE_MNEMONIC);
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      Math.random = originalRandom;
    }
  });

  it("produces different challenges across invocations (uses CSPRNG, not a fixed seed)", () => {
    // 12-position picks of 4 yield C(12, 4) = 495 distinct unordered sets,
    // and with random within-choices ordering the per-call signature has
    // far more than enough entropy that 50 calls should produce at least
    // 5 distinct signatures.
    const sigs = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const c = generateChallenge(FIXTURE_MNEMONIC);
      sigs.add(
        c.blanks.map((b) => `${b.position}:${b.choices.join(",")}`).join("|"),
      );
    }
    expect(sigs.size).toBeGreaterThan(5);
  });

  it("distractors never include any word from the mnemonic", () => {
    const mnemonicSet = new Set(FIXTURE_MNEMONIC);
    for (let i = 0; i < 100; i += 1) {
      const c = generateChallenge(FIXTURE_MNEMONIC);
      for (const b of c.blanks) {
        for (const choice of b.choices) {
          if (choice === b.correct) continue;
          expect(mnemonicSet.has(choice)).toBe(false);
        }
      }
    }
  });
});
