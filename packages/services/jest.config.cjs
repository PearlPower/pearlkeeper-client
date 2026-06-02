/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/__tests__/fixtures/"],
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.ts$": [
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
    "^@prl-wallet/config/blockchains.test.json$":
      "<rootDir>/../../packages/config/src/blockchains.test.json",
    "^@prl-wallet/config$": "<rootDir>/../../packages/config/src/index.ts",
    "^@prl-wallet/core$": "<rootDir>/../../packages/core/src/index.ts",
  },
  setupFiles: ["<rootDir>/jest.setup.ts"],
  passWithNoTests: true,
};
