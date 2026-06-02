import type { DerivedAddress } from "../services/discoverAddresses";

export type { DerivedAddress };

export type RootStackParamList = {
  // Onboarding stack (no wallet yet)
  Welcome: undefined;
  // PIN setup sub-flow (standalone app startup gate — no wallet payload)
  PINCreate: undefined;
  PINConfirm: { pin: string };
  // New wallet flow (nested navigator — create or import)
  NewWalletFlow: undefined;
  // Main app — multi-wallet screens ()
  WalletList: undefined;
  WalletDetail: { walletId: string };
  AddressList: { derivedAddresses: DerivedAddress[] };
  TransactionList: { addresses: string[] };
  // H-1: addresses MUST flow from TransactionList — without them the
  // detail screen's "Your Addresses" filter is permanently empty.
  TransactionDetail: { txid: string; addresses: string[] };
  // : Receive
  Receive: { walletId: string };
  // : Send wizard (nested navigator)
  SendFlow: { walletId: string };
  // Lock screen
  PINUnlock: undefined;
  // : Settings
  Settings: undefined;
  ChangePIN: undefined;
  // Push notifications settings screen.
  Notifications: undefined;
  // opt-in analytics settings screen.
  Analytics: undefined;
};
