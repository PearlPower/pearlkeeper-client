// vite-plugin-node-polyfills injects Buffer as a global in the jsdom realm,
// but the injected Buffer does not pass `instanceof Uint8Array` because
// jsdom's window has a different Uint8Array prototype chain than the
// Node/polyfill Buffer class. @bitcoinerlab/secp256k1 validates inputs with
// `instanceof Uint8Array` — the check fails for the polyfill-injected
// Buffer, causing "ecc library invalid" at init time.
//
// Solution: replace the global Buffer with the one from the `buffer` package
// which explicitly extends Uint8Array and passes the instanceof check in
// every environment.
//
// This polyfill MUST execute before any module that loads `bitcoinjs-lib` /
// `ecpair` (e.g. `@prl-wallet/services`, `@prl-wallet/app-flows`) — those
// run their ECC validation at module-init time and crash if Buffer is wrong.
// Putting the assignment in its own module lets `setup.ts` order it via
// import position (imports execute in source order before any subsequent
// import's evaluation).
import { Buffer as BufferPolyfill } from "buffer";

(globalThis as unknown as Record<string, unknown>).Buffer = BufferPolyfill;
