import { nextWalletName } from "../walletNames.js";

describe("nextWalletName", () => {
  it("empty list returns 'Wallet 1'", () => {
    expect(nextWalletName([])).toBe("Wallet 1");
  });

  it("array with 'Wallet 1' returns 'Wallet 2'", () => {
    expect(nextWalletName([{ name: "Wallet 1" }])).toBe("Wallet 2");
  });

  it("array with 'Wallet 1' and 'Wallet 2' returns 'Wallet 3'", () => {
    expect(nextWalletName([{ name: "Wallet 1" }, { name: "Wallet 2" }])).toBe(
      "Wallet 3",
    );
  });

  it("case-insensitive: 'wallet 1' (lowercase) causes skip to 'Wallet 2'", () => {
    expect(nextWalletName([{ name: "wallet 1" }])).toBe("Wallet 2");
  });

  it("fills gaps: 'Wallet 1' and 'Wallet 3' returns 'Wallet 2'", () => {
    expect(nextWalletName([{ name: "Wallet 1" }, { name: "Wallet 3" }])).toBe(
      "Wallet 2",
    );
  });

  it("ignores non-pattern names and starts at 1", () => {
    expect(nextWalletName([{ name: "My Savings" }])).toBe("Wallet 1");
  });
});
