import type { WalletRecord } from "../contracts/index.js";
import type { WalletRegistryPort } from "../ports/index.js";

export async function addWallet(
  registry: WalletRegistryPort,
  record: WalletRecord,
): Promise<void> {
  const existingWallet = await registry.getWallet(record.id);

  if (existingWallet) {
    throw new Error("wallet already exists");
  }

  await registry.addWallet(record);
}

export async function removeWallet(
  registry: WalletRegistryPort,
  walletId: string,
): Promise<void> {
  const activeWalletId = await registry.getActiveWalletId();

  await registry.removeWallet(walletId);

  if (activeWalletId === walletId) {
    await registry.setActiveWalletId(null);
  }
}

export function listWallets(
  registry: WalletRegistryPort,
): Promise<WalletRecord[]> {
  return registry.listWallets();
}
