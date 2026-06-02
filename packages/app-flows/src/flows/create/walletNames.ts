export type WalletNameRecord = {
  name: string;
};

export function nextWalletName(wallets: WalletNameRecord[]): string {
  const names = new Set(wallets.map((wallet) => wallet.name.toLowerCase()));
  let index = 1;

  while (names.has(`wallet ${index}`)) {
    index += 1;
  }

  return `Wallet ${index}`;
}
