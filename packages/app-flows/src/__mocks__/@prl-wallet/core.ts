/**
 * Jest stub for @prl-wallet/core inside the app-flows test environment.
 * The real core package emits native ESM that ts-jest (CommonJS-targeted)
 * cannot parse. None of the app-flows hook tests exercise real crypto —
 * services like walletService are replaced wholesale in the AdaptersBundle
 * fakes, so this stub only needs to satisfy the transitive re-export from
 * @prl-wallet/services (createWalletService -> walletDrafts.ts imports).
 *
 * `isValidMnemonic` is a jest.fn() so tests can override its return value
 * per case (see useMnemonicImportFlow invalid-checksum test).
 */
export const deriveP2TRAddress = () => "stub-address";
export const generateMnemonic = () => "stub mnemonic";
export const isValidMnemonic = jest.fn(() => true);
export const BIP32 = {};
export const ECPair = {};
export const p2trAddress = () => "stub-p2tr";
export const selectUtxos = () => ({ selected: [], change: 0n });
export const estimateFee = () => 0n;
export const signSchnorr = () => new Uint8Array();
export const SCHNORR_TEST_MESSAGE = "stub";
// CR-2 — used by useSeedVerifyFlow. Must route through globalThis.crypto so
// the test can assert "no Math.random calls". Mirrors the real
// secureRandomInt with the rejection-sampling stripped (Node's
// jest jsdom env always exposes a real CSPRNG).
export const secureRandomInt = (maxExclusive: number): number => {
  const buf = new Uint32Array(1);
  (
    globalThis as {
      crypto: { getRandomValues: (b: Uint32Array) => Uint32Array };
    }
  ).crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
};
