import type { SignableWalletReference, WalletReference } from "./wallet.js";

export interface TransactionRecipient {
  address: string;
  value: string;
  label?: string;
}

export interface TransactionPreviewInput {
  wallet: WalletReference;
  recipients: TransactionRecipient[];
  changeAddress: string;
  feeRate?: string;
}

export interface SendTransactionInput extends TransactionPreviewInput {
  wallet: SignableWalletReference;
  feeRate: string;
}

export interface TransactionDraft {
  wallet: SignableWalletReference;
  recipients: TransactionRecipient[];
  changeAddress: string;
  feeRate: string;
  fee: string;
}

export interface BroadcastedTransaction {
  txid: string;
  hex: string;
}
