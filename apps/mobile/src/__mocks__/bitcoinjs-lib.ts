/**
 * Jest stub for bitcoinjs-lib inside the mobile test environment.
 * The real package depends on uint8array-tools which ships ESM-only under
 * the `browser` export condition, which neither mobile's babel-jest nor
 * app-flows's ts-jest can parse. Mobile tests never exercise real Bitcoin
 * crypto — services are mocked or the hook contracts are replaced wholesale
 * so this stub only needs to satisfy transitive imports at module-load
 * time.
 *
 * `address.toOutputScript` performs a coarse shape check (matches the
 * app-flows stub) so consumers of `validateRecipientAddress` can exercise
 * both branches in tests instead of having every string treated as valid.
 */
export const address = {
  toOutputScript: (addr: string) => {
    if (
      typeof addr === "string" &&
      addr.length >= 8 &&
      /^(bc1|tb1|bcrt1)/i.test(addr)
    ) {
      return new Uint8Array();
    }
    throw new Error(`stub-bitcoinjs-lib: invalid address "${addr}"`);
  },
  fromOutputScript: () => "stub-address",
};
export const networks = {
  bitcoin: {},
  testnet: {},
  regtest: {},
};
export const payments = {
  p2tr: () => ({ address: "stub-p2tr" }),
};
export const initEccLib = () => undefined;
export const Psbt = class {};
export const Transaction = class {};
export type Network = unknown;
