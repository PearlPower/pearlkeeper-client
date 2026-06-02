/**
 * Entry point for the React Native app.
 *
 * Polyfill imports are ordered carefully — Babel hoists 'import' declarations
 * to the top of the module as require() calls, executed in source order.
 * Each polyfill module sets its globals during its own evaluation, so by the
 * time App.tsx (and its crypto dependencies) load, all globals are ready.
 *
 * 1. fast-text-encoding — TextEncoder / TextDecoder
 * (bitcoinjs-lib → uint8array-tools/browser.js needs these at module init)
 * 2. setup-globals — Buffer global
 * (ecpair/testecc.js and bip32 use Buffer.from at module init via ECPairFactory)
 * 3. react-native-get-random-values — crypto.getRandomValues
 * (@scure/bip39 and @noble/hashes need this at runtime)
 */
import "fast-text-encoding";
import "./setup-globals";
import "react-native-get-random-values";

import { AppRegistry } from "react-native";
import App from "./App";

// Native AppDelegate.swift calls runApplication('main', ...) — must match.
AppRegistry.registerComponent("main", () => App);
