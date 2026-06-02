/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["ts", "tsx", "js"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // No @prl-wallet/app-adapters mapper: 17-06 broke the app-state ↔
    // app-adapters cycle and walletListStore.test.ts now imports StoragePort
    // from ../storagePort.js. Re-adding this mapper would silently restitch
    // the runtime dependency edge (app-state test → app-adapters/index.ts →
    // storage.js shim → app-state) that the package.json no longer claims.
    // Let any stray import of @prl-wallet/app-adapters from app-state tests
    // fail loudly with "cannot find module".
    "^@prl-wallet/services$": "<rootDir>/../../packages/services/src/index.ts",
  },
  passWithNoTests: true,
};
