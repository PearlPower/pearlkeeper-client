export const BLOCKBOOK_PORT_METHODS = [
  "ping",
  "getAddress",
  "getTransaction",
  "getUtxos",
  "estimateFee",
  "sendTransaction",
] as const;

export interface BlockbookStatusInfo {
  healthy: boolean;
  networkId?: string;
  blockbook?: {
    bestHeight?: number;
    bestHash?: string;
    version?: string;
  };
}

export interface BlockbookAddressInfo {
  address: string;
  balance: string;
  txs: number;
  unconfirmedTxs?: number;
}

export interface BlockbookTransactionInfo {
  txid: string;
  blockHeight?: number;
  confirmations?: number;
  hex?: string;
  vin?: Array<{
    txid?: string;
    coinbase?: string;
  }>;
}

export interface BlockbookUtxo {
  txid: string;
  vout: number;
  value: string;
  height?: number;
  confirmations?: number;
  coinbase?: boolean;
  address?: string;
  path?: string;
}

export interface BlockbookPort {
  ping(): Promise<BlockbookStatusInfo>;
  getAddress(
    address: string,
    page?: number,
    pageSize?: number,
  ): Promise<BlockbookAddressInfo>;
  getTransaction(txid: string): Promise<BlockbookTransactionInfo>;
  getUtxos(address: string): Promise<BlockbookUtxo[]>;
  estimateFee(blocks: number): Promise<number>;
  sendTransaction(txHex: string): Promise<string>;
}

export type BlockbookPortFactory = (networkId: string) => BlockbookPort;
