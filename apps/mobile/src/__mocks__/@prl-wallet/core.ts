/**
 * Jest stub for @prl-wallet/core inside the mobile test environment.
 *
 * The real @prl-wallet/core package ships as native ESM (packages/core/dist
 * uses `export ...`) and transitively pulls in bitcoinjs-lib +
 * uint8array-tools, neither of which survive mobile Jest's CommonJS
 * babel-jest pipeline. Every mobile test that needs real crypto mocks the
 * specific symbols it uses (see useMnemonicImportFlow.test.tsx and siblings);
 * this stub is the default resolver so a transitive import in
 * @prl-wallet/services (walletDrafts.ts) doesn't explode before the targeted
 * mock kicks in.
 *
 * Test files that need specific behavior can still override via
 * `jest.mock("@prl-wallet/core", ..., { virtual: false })` at the top of the
 * file (as in useMnemonicImportFlow.test.tsx).
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
