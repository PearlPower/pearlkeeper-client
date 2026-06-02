/**
 * Sets up Node.js globals required by bitcoinjs-lib and its dependencies
 * in the Hermes (React Native) environment.
 *
 * This module sets globals during MODULE EVALUATION (when it is first required),
 * which ensures Buffer is available before any crypto library initializes.
 *
 * Import order in index.js:
 * 1. fast-text-encoding — sets global.TextEncoder / global.TextDecoder
 * 2. THIS FILE — sets global.Buffer
 * 3. react-native-get-random-values — sets global.crypto.getRandomValues
 *
 * Why a separate module?
 * Babel transforms 'import' declarations into require() calls that are hoisted
 * before any executable code. This means that `global.Buffer = Buffer` in
 * index.js would run AFTER App.tsx (and its transitive deps) have already loaded.
 * A separate module that sets global.Buffer during its own evaluation fixes this.
 */

/* eslint-disable @typescript-eslint/no-var-requires, no-undef */
const { Buffer } = require("buffer");
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}
