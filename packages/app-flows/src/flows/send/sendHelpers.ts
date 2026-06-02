import { address } from "bitcoinjs-lib";
import type { Network } from "bitcoinjs-lib";

type SendWalletLike = {
  id: string;
  networkId: string;
};

export function selectSendWallet<T extends SendWalletLike>(
  wallets: T[],
  walletId: string,
): T | null {
  return wallets.find((wallet) => wallet.id === walletId) ?? null;
}

export function validateRecipientAddress(
  value: string,
  network: Network | null,
): boolean {
  if (!network) {
    return false;
  }

  const recipientAddress = value.trim();
  if (!recipientAddress) {
    return false;
  }

  try {
    address.toOutputScript(recipientAddress, network);
    return true;
  } catch {
    return false;
  }
}
