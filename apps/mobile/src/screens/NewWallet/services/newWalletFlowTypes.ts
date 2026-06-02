import type { ImportWalletType } from "@prl-wallet/app-flows";

export type { ImportWalletType };

export type NewWalletStackParamList = {
  WalletSetup: undefined;
  SeedPhrase: { mnemonic: string };
  SeedVerify: { mnemonic: string };
  MnemonicImport: undefined;
  BIP32SeedImport: undefined;
  XpubImport: undefined;
  WalletName: {
    walletId: string;
    address: string;
    walletType: ImportWalletType;
  };
  SetupSuccess: {
    walletId: string;
    walletName: string;
    address: string;
  };
};

export type WalletNameNavigation = {
  navigate: (
    screen: "WalletName",
    params: {
      walletId: string;
      address: string;
      walletType: ImportWalletType;
    },
  ) => void;
};
