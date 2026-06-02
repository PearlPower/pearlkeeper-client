import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import * as services from "../index.js";
import type {
  AddressDiscoveryResult,
  CreateWalletDraft,
  DerivedAddress,
  SendTransactionInput,
  ServiceErrorCode,
  WatchOnlyWalletReference,
} from "../index.js";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

function assertType<T extends true>(value: T): T {
  return value;
}

assertType<
  Expect<
    Equal<
      DerivedAddress,
      {
        index: number;
        address: string;
        hasTransactions: boolean;
      }
    >
  >
>(true);

assertType<
  Expect<
    Equal<CreateWalletDraft["discovery"], AddressDiscoveryResult | undefined>
  >
>(true);

assertType<Expect<Equal<WatchOnlyWalletReference["capability"], "watchOnly">>>(
  true,
);

assertType<
  Expect<
    Equal<
      ServiceErrorCode,
      | "unknown_network"
      | "wallet_not_found"
      | "watch_only_wallet"
      | "missing_secret"
      | "address_discovery_failed"
      | "insufficient_funds"
      | "broadcast_failed"
      // / :
      | "utxo_verification_failed"
      // / :
      | "signed_config_unavailable"
    >
  >
>(true);

function listSourceFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath);

  return entries.flatMap((entry) => {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    return fullPath.endsWith(".ts") ? [fullPath] : [];
  });
}

describe("services package contracts", () => {
  it("exposes service-owned contracts from the package root", () => {
    expect(services).toMatchObject({
      SERVICE_ERROR_CODES: expect.arrayContaining([
        "watch_only_wallet",
        "broadcast_failed",
      ]),
      WALLET_CAPABILITIES: ["signing", "watchOnly"],
      SIGNABLE_WALLET_TYPES: ["mnemonic", "wif", "bip32Seed"],
      WATCH_ONLY_WALLET_TYPES: ["xpub"],
    });
  });

  it("defines shared address and wallet-flow contracts under service ownership", () => {
    const derivedAddress: DerivedAddress = {
      index: 0,
      address: "bc1ptestaddress",
      hasTransactions: false,
    };

    const walletDraft: CreateWalletDraft = {
      walletId: "wallet-1",
      networkId: "btc-mainnet",
      walletType: "mnemonic",
      capability: "signing",
      mnemonic:
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      firstReceiveAddress: derivedAddress.address,
      discovery: {
        derivedAddresses: [derivedAddress],
        receiveAddress: derivedAddress.address,
        receiveAddressIndex: 0,
        warnings: [],
      },
    };

    const sendInput: SendTransactionInput = {
      wallet: {
        walletId: walletDraft.walletId,
        networkId: walletDraft.networkId,
        walletType: walletDraft.walletType,
        capability: walletDraft.capability,
      },
      recipients: [{ address: derivedAddress.address, value: "1000" }],
      feeRate: "2",
      changeAddress: derivedAddress.address,
    };

    expect(walletDraft.discovery?.derivedAddresses).toEqual([derivedAddress]);
    expect(sendInput.wallet.capability).toBe("signing");
  });

  it("keeps service contracts independent from app-owned modules", () => {
    const sourceRoot = join(__dirname, "..");
    const files = listSourceFiles(sourceRoot).filter(
      (filePath) => !filePath.includes("__tests__"),
    );
    const forbiddenImports = [
      "apps/mobile",
      "expo-",
      "@react-navigation",
      "zustand",
      "RootStackParamList",
      "useWalletListStore",
    ];

    for (const filePath of files) {
      const source = readFileSync(filePath, "utf8");

      for (const forbiddenImport of forbiddenImports) {
        expect(source).not.toContain(forbiddenImport);
      }

      expect(relative(sourceRoot, filePath)).not.toContain("navigation");
    }
  });
});
