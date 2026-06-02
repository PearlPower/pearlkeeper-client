/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  // Refactor Change 2 — useSendAmount/useSendFee now import from
  // @prl-wallet/api-client which transitively pulls in
  // `@noble/ed25519@^3.1.0` (ESM-only). Allow the noble package through
  // ts-jest so its bare `export {...}` statement compiles to CJS.
  // (Mirrors packages/api-client/jest.config.cjs:12.)
  transformIgnorePatterns: ["/node_modules/(?!@noble/ed25519)"],
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          jsx: "react-jsx",
          esModuleInterop: true,
          allowJs: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@prl-wallet/app-adapters$":
      "<rootDir>/../../packages/app-adapters/src/index.ts",
    "^@prl-wallet/app-state$":
      "<rootDir>/../../packages/app-state/src/index.ts",
    "^@prl-wallet/services$": "<rootDir>/../../packages/services/src/index.ts",
    "^@prl-wallet/config$": "<rootDir>/../../packages/config/src/index.ts",
    "^@prl-wallet/core$": "<rootDir>/src/__mocks__/@prl-wallet/core.ts",
    "^bitcoinjs-lib$": "<rootDir>/src/__mocks__/bitcoinjs-lib.ts",
    "^@prl-wallet/blockbook$":
      "<rootDir>/../../packages/blockbook/src/index.ts",
    // Refactor Change 2 — useAnalyticsFlow + satoshisToPrl re-exported via
    // @prl-wallet/api-client; analytics types via @prl-wallet/analytics.
    "^@prl-wallet/api-client$":
      "<rootDir>/../../packages/api-client/src/index.ts",
    "^@prl-wallet/api-schemas$":
      "<rootDir>/../../packages/api-schemas/src/index.ts",
    "^@prl-wallet/analytics$":
      "<rootDir>/../../packages/analytics/src/index.ts",
  },
  passWithNoTests: true,
};
