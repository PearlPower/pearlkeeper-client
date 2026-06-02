/* eslint-env node */
module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: { "^.+\\.(js|jsx|ts|tsx)$": "babel-jest" },
  transformIgnorePatterns: [
    // Negative lookahead: packages listed here ARE transformed (they ship ESM).
    // expo-application and expo-modules-core must be listed explicitly because
    // the bare "expo" entry only matches node_modules/expo/ (requires trailing /)
    // not node_modules/expo-application/ (a different package name).
    "node_modules/(?!((jest)?react-native|@react-native(community)?|@react-navigation|expo-application|expo-modules-core|expo|@expo|@noble/ed25519)/)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    // Local Expo module pulls in expo-modules-core, which can't initialize
    // under jest; force the @noble fallback path in tests.
    "modules/argon2-native$": "<rootDir>/src/__mocks__/argon2-native.ts",
    "^expo-application$": "<rootDir>/src/__mocks__/expo-application.ts",
    "^expo-secure-store$": "<rootDir>/src/__mocks__/expo-secure-store.ts",
    "^expo-in-app-updates$": "<rootDir>/src/__mocks__/expo-in-app-updates.ts",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/src/__mocks__/@react-native-async-storage/async-storage.ts",
    "^(\\.{1,2}/.+)\\.js$": "$1",
    "^@prl-wallet/app-adapters$":
      "<rootDir>/../../packages/app-adapters/src/index.ts",
    "^@prl-wallet/app-flows$":
      "<rootDir>/../../packages/app-flows/src/index.ts",
    "^@prl-wallet/app-state$":
      "<rootDir>/../../packages/app-state/src/index.ts",
    // analytics package source mapping for jest's CJS
    // runtime (the package ships ESM dist; mobile screens import
    // ANALYTICS_COPY + useAnalyticsFlow re-exported via @prl-wallet/app-flows
    // which transitively requires the analytics package to be resolvable
    // from src). Mirrors the api-client + api-schemas pattern above.
    "^@prl-wallet/analytics$":
      "<rootDir>/../../packages/analytics/src/index.ts",
    // api-client + api-schemas need source mapping for
    // mobile jest (the package ships ESM dist; jest's CJS runtime can't load
    // it directly). Mirror the api-client jest mapper pattern.
    "^@prl-wallet/api-client$":
      "<rootDir>/../../packages/api-client/src/index.ts",
    "^@prl-wallet/api-schemas$":
      "<rootDir>/../../packages/api-schemas/src/index.ts",
    // Refactor Change 2 — frontend never imports @prl-wallet/blockbook;
    // hooks moved to @prl-wallet/api-client. The blockbook package source
    // is still mapped so api-client's transitive type imports resolve at
    // test time.
    "^@prl-wallet/blockbook$":
      "<rootDir>/../../packages/blockbook/src/index.ts",
    "^@prl-wallet/config/blockchains.test.json$":
      "<rootDir>/../../packages/config/src/blockchains.test.json",
    "^@prl-wallet/config$": "<rootDir>/../../packages/config/src/index.ts",
    "^@prl-wallet/core$": "<rootDir>/src/__mocks__/@prl-wallet/core.ts",
    "^@prl-wallet/services$": "<rootDir>/../../packages/services/src/index.ts",
    "^bitcoinjs-lib$": "<rootDir>/src/__mocks__/bitcoinjs-lib.ts",
  },
};
