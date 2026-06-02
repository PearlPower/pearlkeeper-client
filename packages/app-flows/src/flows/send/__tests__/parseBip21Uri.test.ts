// packages/app-flows/src/flows/send/__tests__/parseBip21Uri.test.ts
// GREEN flip of the Wave-0 RED stubs ().

import { parseBip21Uri } from "../parseBip21Uri.js";

describe("parseBip21Uri ()", () => {
  it("strips bitcoin: prefix and extracts amount from BIP21 URI", () => {
    expect(parseBip21Uri("bitcoin:bc1q123?amount=0.1", "bitcoin")).toEqual({
      address: "bc1q123",
      amount: "0.1",
    });
  });

  it("strips prl: prefix when no query params (amount undefined)", () => {
    expect(parseBip21Uri("prl:prl1qabc", "prl")).toEqual({
      address: "prl1qabc",
      amount: undefined,
    });
  });

  it("returns null for non-matching prefix (bare address)", () => {
    expect(parseBip21Uri("bc1qbare", "bitcoin")).toBeNull();
  });

  it("returns null when bip21Prefix is empty string", () => {
    // Defense-in-depth: empty prefix => no scheme to strip => null.
    // Avoids returning the entire input as the address.
    expect(parseBip21Uri("anything", "")).toBeNull();
  });

  it("ignores extra query params and returns only amount", () => {
    expect(
      parseBip21Uri(
        "bitcoin:bc1qx?label=foo&amount=0.5&message=hi",
        "bitcoin",
      ),
    ).toEqual({ address: "bc1qx", amount: "0.5" });
  });

  it("scaffold loads (sanity)", () => {
    expect(typeof parseBip21Uri).toBe("function");
  });
});
