/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
      },
    }],
  },
  moduleNameMapper: {
    // Map .js imports to allow ts-jest to resolve .ts source files
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@prl-wallet/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@prl-wallet/core/mnemonic$': '<rootDir>/src/mnemonic.ts',
    '^@prl-wallet/core/keys$': '<rootDir>/src/keys.ts',
    '^@prl-wallet/core/address$': '<rootDir>/src/address.ts',
    '^@prl-wallet/core/tx$': '<rootDir>/src/tx.ts',
  },
  passWithNoTests: true,
};
