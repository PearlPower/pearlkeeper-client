/**
 * Jest stub for bitcoinjs-lib inside the app-flows test environment.
 * The real package depends on uint8array-tools which ships ESM-only under
 * the `browser` export condition (jsdom picks that) and ts-jest cannot
 * parse it. app-flows hook tests never exercise real Bitcoin crypto —
 * services are replaced wholesale in the fake AdaptersBundle — so this
 * stub only needs to export the `address` / `networks` / `payments`
 * surface that transitive imports reach for at module-load time.
 *
 * `address.toOutputScript` performs a coarse shape check so that
 * `validateRecipientAddress` exercises both branches in tests:
 * strings starting with bc1/tb1/bcrt1 of at least 8 chars succeed
 * (this passes for placeholder bech32-shaped strings used in tests).
 * everything else throws, matching real bitcoinjs-lib behaviour for
 * malformed input.
 * Tests that need stricter behaviour can override this mock locally.
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
