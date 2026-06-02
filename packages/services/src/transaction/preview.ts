import { selectUtxos as coreSelectUtxos } from "@prl-wallet/core";
import { address as btcAddress } from "bitcoinjs-lib";
import type { TxOutput, Utxo } from "@prl-wallet/core";

import {
  discoverFromRoot,
  discoverFromSeed,
  loadAddressCredentials,
} from "../address/index.js";
import type {
  SignableWalletReference,
  TransactionDraft,
  TransactionPreviewInput,
} from "../contracts/index.js";
import { resolveNetworkContext } from "../network/index.js";
import type { BlockbookPort, ServicesPorts } from "../ports/index.js";

import { assertScriptMatchesAddress } from "./utxoVerification.js";

export interface TaggedUtxo extends Utxo {
  addressIndex: number;
  address: string;
}

const COINBASE_MATURITY_CONFIRMATIONS = 100;

function isCoinbaseTransaction(
  tx: BlockbookPort extends never
    ? never
    : Awaited<ReturnType<BlockbookPort["getTransaction"]>>,
): boolean {
  return (
    tx.vin?.some((input) => Boolean(input.coinbase) || !input.txid) ?? false
  );
}

export interface PreparedTransactionPreview {
  draft: TransactionDraft;
  selectedUtxos: TaggedUtxo[];
  finalOutputs: TxOutput[];
}

interface PreparePreviewOptions extends Omit<
  TransactionPreviewInput,
  "feeRate"
> {
  ports: ServicesPorts;
  feeRate?: bigint;
}

export async function prepareTransactionPreview(
  options: PreparePreviewOptions,
): Promise<PreparedTransactionPreview> {
  const wallet = assertSignableWallet(options.wallet);
  const network = resolveNetworkContext(wallet.networkId);
  const client = options.ports.blockbook(wallet.networkId);
  const credentials = await loadAddressCredentials(
    wallet,
    options.ports.secrets,
    network,
  );

  const discovery =
    credentials.kind === "seed"
      ? await discoverFromSeed({ client, network, seed: credentials.seed })
      : credentials.kind === "root"
        ? await discoverFromRoot({ client, network, root: credentials.root })
        : (() => {
            throw new Error("watch_only_wallet");
          })();

  const spendableAddresses = discovery.derivedAddresses.filter(
    (entry) => entry.hasTransactions,
  );
  const utxos = await collectUtxos({
    client,
    spendableAddresses,
    network,
  });

  const feeRate = options.feeRate ?? (await resolveFeeRate(client));
  const outputs = options.recipients.map((recipient) => ({
    address: recipient.address,
    value: BigInt(recipient.value),
  }));
  const selection = selectUtxos(utxos, outputs, feeRate, options.changeAddress);

  if (!selection.success) {
    throw new Error(selection.reason);
  }

  const fee =
    selection.selected.reduce((sum, utxo) => sum + utxo.value, 0n) -
    outputs.reduce((sum, output) => sum + output.value, 0n) -
    selection.change;

  const finalOutputs =
    selection.change > 0n
      ? [
          ...outputs,
          { address: options.changeAddress, value: selection.change },
        ]
      : outputs;

  return {
    draft: {
      wallet,
      recipients: options.recipients,
      changeAddress: options.changeAddress,
      feeRate: feeRate.toString(),
      fee: fee.toString(),
    },
    selectedUtxos: selection.selected as TaggedUtxo[],
    finalOutputs,
  };
}

export function assertSignableWallet(
  wallet: TransactionPreviewInput["wallet"],
): SignableWalletReference {
  if (wallet.capability !== "signing") {
    throw new Error("watch_only_wallet");
  }

  return wallet;
}

export function selectUtxos(
  utxos: TaggedUtxo[],
  outputs: TxOutput[],
  feeRate: bigint,
  changeAddress: string,
) {
  return coreSelectUtxos(utxos, outputs, feeRate, changeAddress);
}

async function collectUtxos(options: {
  client: BlockbookPort;
  spendableAddresses: Array<{ index: number; address: string }>;
  network: ReturnType<typeof resolveNetworkContext>;
}): Promise<TaggedUtxo[]> {
  const utxos: TaggedUtxo[] = [];

  for (const entry of options.spendableAddresses) {
    const rawUtxos = await options.client.getUtxos(entry.address);
    const script = btcAddress.toOutputScript(
      entry.address,
      options.network.network,
    );

    for (const utxo of rawUtxos) {
      // / C-02 / INDEXER-02: belt-and-braces UTXO check —
      // throws BEFORE any backend-supplied UTXO can reach `selectUtxos` or
      // `buildPsbt`. Closes the controlled-bad-backend fund-theft vector
      // (negative test in `__tests__/transaction-service.test.ts`).
      assertScriptMatchesAddress(utxo, entry.address, options.network.network);

      const confirmations = utxo.confirmations ?? 0;

      if (confirmations >= COINBASE_MATURITY_CONFIRMATIONS) {
        utxos.push({
          txid: utxo.txid,
          vout: utxo.vout,
          value: BigInt(utxo.value),
          script,
          addressIndex: entry.index,
          address: entry.address,
        });
        continue;
      }

      const isCoinbase =
        utxo.coinbase ??
        isCoinbaseTransaction(await options.client.getTransaction(utxo.txid));

      if (isCoinbase) {
        continue;
      }

      utxos.push({
        txid: utxo.txid,
        vout: utxo.vout,
        value: BigInt(utxo.value),
        script,
        addressIndex: entry.index,
        address: entry.address,
      });
    }
  }

  return utxos;
}

async function resolveFeeRate(client: BlockbookPort): Promise<bigint> {
  const feeRate = await client.estimateFee(1);

  if (!Number.isFinite(feeRate) || feeRate <= 0) {
    throw new Error("invalid_fee_rate");
  }

  return BigInt(Math.ceil(feeRate));
}
