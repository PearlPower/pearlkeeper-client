import type {
  CreateWalletDraft,
  ImportWalletInput,
  WalletType,
} from "../contracts/index.js";
import type { WalletSecretsPort } from "../ports/index.js";

export async function storeCreatedSecret(
  secrets: WalletSecretsPort,
  draft: CreateWalletDraft,
): Promise<void> {
  await secrets.storeMnemonic(draft.walletId, draft.mnemonic);
  await secrets.storeWalletType(draft.walletId, draft.walletType);
}

export async function storeImportedSecret(
  secrets: WalletSecretsPort,
  walletId: string,
  input: ImportWalletInput,
): Promise<void> {
  if (input.walletType === "mnemonic") {
    await secrets.storeMnemonic(walletId, input.mnemonic);
    await secrets.storeWalletType(walletId, input.walletType);
    return;
  }

  if (input.walletType === "bip32Seed") {
    await secrets.storeBIP32Seed(walletId, input.seed);
    await secrets.storeWalletType(walletId, input.walletType);
    return;
  }

  await secrets.storeXpub(walletId, input.xpub);
  await secrets.storeWalletType(walletId, input.walletType);
}

export async function assertStoredWalletType(
  secrets: WalletSecretsPort,
  walletId: string,
  expectedType: WalletType,
): Promise<void> {
  const storedType = await secrets.getWalletType(walletId);

  if (storedType !== expectedType) {
    throw new Error("missing_secret");
  }
}
