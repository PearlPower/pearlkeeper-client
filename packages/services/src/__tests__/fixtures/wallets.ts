import type {
  AddressDiscoveryResult,
  DerivedAddress,
  SignableWalletReference,
  WalletRecord,
  WatchOnlyWalletReference,
} from "../../index.js";

import { TEST_NOW, TEST_WALLET_ID } from "./servicePorts.js";

const mnemonic =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const bip32Seed =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const xpub =
  "xpub661MyMwAqRbcF8tzwS4XqXWiwxupCSvJzpuG1HsRvN7kYMFKfNwCuWHa3gwxMZ2ymlk4EYBLETymFcpnSUsctNk6heAQ7EzWLKJ6C5Evhcz";

const receiveAddress: DerivedAddress = {
  index: 0,
  address: "bc1ptestreceiveaddress0000000000000000000000000",
  hasTransactions: false,
};

const usedAddress: DerivedAddress = {
  index: 1,
  address: "bc1ptestusedaddress00000000000000000000000000000",
  hasTransactions: true,
};

const discovery: AddressDiscoveryResult = {
  derivedAddresses: [receiveAddress, usedAddress],
  receiveAddressIndex: receiveAddress.index,
  receiveAddress: receiveAddress.address,
  warnings: [],
};

const signingWallet: SignableWalletReference = {
  walletId: TEST_WALLET_ID,
  networkId: "btc-mainnet",
  walletType: "mnemonic",
  capability: "signing",
};

const bip32SeedWallet: SignableWalletReference = {
  walletId: "wallet-bip32-seed",
  networkId: "btc-testnet",
  walletType: "bip32Seed",
  capability: "signing",
};

const watchOnlyWallet: WatchOnlyWalletReference = {
  walletId: "wallet-watch-only",
  networkId: "btc-mainnet",
  walletType: "xpub",
  capability: "watchOnly",
};

const walletRecord: WalletRecord = {
  id: TEST_WALLET_ID,
  name: "Primary",
  networkId: signingWallet.networkId,
  createdAt: TEST_NOW,
  lastKnownBalance: "0",
};

export const walletFixtures = {
  now: TEST_NOW,
  walletId: TEST_WALLET_ID,
  mnemonic,
  bip32Seed,
  xpub,
  signingWallet,
  bip32SeedWallet,
  watchOnlyWallet,
  walletRecord,
  derivedAddresses: discovery.derivedAddresses,
  discovery,
};
