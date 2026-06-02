import {
  prepareCreateWallet as buildCreateWalletDraft,
  prepareImportWallet,
} from "./walletDrafts.js";
import { addWallet, listWallets, removeWallet } from "./walletRegistry.js";
import { storeCreatedSecret, storeImportedSecret } from "./secrets.js";
import type {
  CommitCreateWalletInput,
  ImportWalletInput,
  PrepareCreateWalletInput,
  WalletDraft,
  WalletRecord,
} from "../contracts/index.js";
import type { ServicesPorts } from "../ports/index.js";

export interface WalletService {
  prepareCreateWallet(input: PrepareCreateWalletInput): Promise<WalletDraft>;
  commitCreateWallet(input: CommitCreateWalletInput): Promise<WalletDraft>;
  importWallet(input: ImportWalletInput): Promise<WalletDraft>;
  deleteWallet(walletId: string): Promise<void>;
  listWallets(): Promise<WalletRecord[]>;
}

export function createWalletService(ports: ServicesPorts): WalletService {
  assertWalletServicePorts(ports);

  return {
    async prepareCreateWallet(input) {
      assertPrepareCreateWalletInput(input, "prepareCreateWallet");

      if (input.walletType !== "mnemonic") {
        throw new Error(`unsupported_wallet_type:${input.walletType}`);
      }

      return buildCreateWalletDraft({
        ports,
        networkId: input.networkId,
        walletType: input.walletType,
      });
    },

    async commitCreateWallet(input) {
      assertCommitCreateWalletInput(input, "commitCreateWallet");

      const record = {
        id: input.draft.walletId,
        name: input.name,
        networkId: input.draft.networkId,
        createdAt: ports.runtime.now(),
      };

      await storeCreatedSecret(ports.secrets, input.draft);
      await addWallet(ports.registry, record);

      return input.draft;
    },

    async importWallet(input) {
      assertImportWalletInput(input, "importWallet");

      const walletId = ports.runtime.createId();
      await storeImportedSecret(ports.secrets, walletId, input);
      const draft = await prepareImportWallet({ ports, walletId, input });

      await addWallet(ports.registry, {
        id: walletId,
        name: input.name,
        networkId: input.networkId,
        createdAt: ports.runtime.now(),
      });

      return draft;
    },

    async deleteWallet(walletId) {
      assertNonEmptyString(walletId, "deleteWallet", "walletId");

      await ports.secrets.deleteWalletSecrets(walletId);
      await removeWallet(ports.registry, walletId);
    },

    async listWallets() {
      return listWallets(ports.registry);
    },
  };
}

function assertWalletServicePorts(ports: ServicesPorts): void {
  if (!ports.secrets || !ports.registry || !ports.blockbook || !ports.runtime) {
    throw new Error(
      "createWalletService requires secrets, registry, blockbook, and runtime ports",
    );
  }
}

function assertWalletIdentityInput(
  input: { name: string; networkId: string },
  methodName: string,
): void {
  assertNonEmptyString(input.name, methodName, "name");
  assertNonEmptyString(input.networkId, methodName, "networkId");
}

function assertImportWalletInput(
  input: ImportWalletInput,
  methodName: string,
): void {
  assertWalletIdentityInput(input, methodName);

  if (input.walletType === "mnemonic") {
    assertNonEmptyString(input.mnemonic, methodName, "mnemonic");
    return;
  }

  if (input.walletType === "bip32Seed") {
    assertNonEmptyString(input.seed, methodName, "seed");
    return;
  }

  assertNonEmptyString(input.xpub, methodName, "xpub");
}

function assertPrepareCreateWalletInput(
  input: PrepareCreateWalletInput,
  methodName: string,
): void {
  assertNonEmptyString(input.networkId, methodName, "networkId");
}

function assertCommitCreateWalletInput(
  input: CommitCreateWalletInput,
  methodName: string,
): void {
  assertNonEmptyString(input.name, methodName, "name");
  assertNonEmptyString(input.draft.walletId, methodName, "draft.walletId");
  assertNonEmptyString(input.draft.networkId, methodName, "draft.networkId");
  assertNonEmptyString(input.draft.mnemonic, methodName, "draft.mnemonic");
  assertNonEmptyString(
    input.draft.firstReceiveAddress,
    methodName,
    "draft.firstReceiveAddress",
  );
}

function assertNonEmptyString(
  value: string,
  methodName: string,
  fieldName: string,
): void {
  if (!value.trim()) {
    throw new Error(`${methodName} requires a non-empty ${fieldName}`);
  }
}
