import { validateRecipientAddress, selectSendWallet } from "../sendHelpers.js";

jest.mock("bitcoinjs-lib", () => ({
  address: {
    toOutputScript: jest.fn((value: string) => {
      if (!value.startsWith("bc1")) {
        throw new Error("invalid address");
      }

      return new Uint8Array([0]);
    }),
  },
}));

describe("send shared helpers", () => {
  it("selects the current send wallet from wallet registry state", () => {
    const wallets = [
      { id: "wallet-1", networkId: "btc-mainnet", name: "Primary" },
      { id: "wallet-2", networkId: "prl-testnet", name: "Testnet" },
    ];

    expect(selectSendWallet(wallets, "wallet-2")).toEqual(wallets[1]);
    expect(selectSendWallet(wallets, "missing-wallet")).toBeNull();
  });

  it("validates recipient addresses against the active wallet network", () => {
    const network = {} as import("bitcoinjs-lib").Network;

    expect(validateRecipientAddress(" bc1validaddress ", network)).toBe(true);
    expect(validateRecipientAddress("not-an-address", network)).toBe(false);
    expect(validateRecipientAddress(" ", network)).toBe(false);
    expect(validateRecipientAddress("bc1validaddress", null)).toBe(false);
  });
});
