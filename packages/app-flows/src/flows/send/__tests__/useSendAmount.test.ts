import { parsePrlToSats } from "../useSendAmount.js";

describe("parsePrlToSats", () => {
  it("converts whole PRL to satoshis exactly", () => {
    expect(parsePrlToSats("1")).toBe(100_000_000n);
    expect(parsePrlToSats("0")).toBe(0n);
    expect(parsePrlToSats("21000000")).toBe(2_100_000_000_000_000n);
  });

  it("converts decimal PRL to satoshis exactly", () => {
    expect(parsePrlToSats("0.00000001")).toBe(1n);
    expect(parsePrlToSats("0.5")).toBe(50_000_000n);
    expect(parsePrlToSats("1.23456789")).toBe(123_456_789n);
  });

  it("preserves precision past Number.MAX_SAFE_INTEGER", () => {
    // 100,000,000 PRL → 1e16 sats, plus 0.12345678 PRL → 12,345,678 sats.
    // parseFloat("100000000.12345678") * 1e8 loses the trailing digits to
    // double-precision rounding; bigint string parsing is exact.
    expect(parsePrlToSats("100000000.12345678")).toBe(10_000_000_012_345_678n);
  });

  it("truncates fractional digits past 8 places without rounding", () => {
    expect(parsePrlToSats("1.123456789")).toBe(112_345_678n);
  });

  it("returns null for malformed input", () => {
    expect(parsePrlToSats("")).toBeNull();
    expect(parsePrlToSats(".")).toBeNull();
    expect(parsePrlToSats("-1")).toBeNull();
    expect(parsePrlToSats("1.2.3")).toBeNull();
    expect(parsePrlToSats("abc")).toBeNull();
    expect(parsePrlToSats("1e5")).toBeNull();
  });
});
