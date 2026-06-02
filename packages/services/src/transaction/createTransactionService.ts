import type {
  BroadcastedTransaction,
  SendTransactionInput,
  TransactionDraft,
  TransactionPreviewInput,
} from "../contracts/index.js";
import { resolveNetworkContext } from "../network/index.js";
import type { ServicesPorts } from "../ports/index.js";

import { signTransactionToHex } from "./broadcast.js";
import { prepareTransactionPreview } from "./preview.js";
import { createInputSigners, loadSigningMaterial } from "./signing.js";

export interface TransactionService {
  previewTransaction(input: TransactionPreviewInput): Promise<TransactionDraft>;
  sendTransaction(input: SendTransactionInput): Promise<BroadcastedTransaction>;
  // additive split:
  signTransactionHex(
    input: SendTransactionInput,
  ): Promise<{ hex: string; previewedTxid: string }>;
  broadcastTxHex(
    networkId: string,
    hex: string,
  ): Promise<{ txid: string; hex: string }>;
}

export function createTransactionService(
  ports: ServicesPorts,
): TransactionService {
  assertTransactionServicePorts(ports);

  async function signTransactionHex(
    input: SendTransactionInput,
  ): Promise<{ hex: string; previewedTxid: string }> {
    assertTransactionPreviewInput(input, "signTransactionHex");
    assertNonEmptyString(input.feeRate, "signTransactionHex", "feeRate");
    const preview = await prepareTransactionPreview({
      ports,
      wallet: input.wallet,
      recipients: input.recipients,
      changeAddress: input.changeAddress,
      feeRate: BigInt(input.feeRate),
    });
    const network = resolveNetworkContext(input.wallet.networkId);
    const material = await loadSigningMaterial(
      input.wallet,
      ports.secrets,
      network,
    );
    const inputSigners = createInputSigners({
      utxos: preview.selectedUtxos,
      material,
      network,
    });

    return signTransactionToHex({
      utxos: preview.selectedUtxos,
      outputs: preview.finalOutputs,
      inputSigners,
      network,
    });
  }

  async function broadcastTxHex(
    networkId: string,
    hex: string,
  ): Promise<{ txid: string; hex: string }> {
    const client = ports.blockbook(networkId);
    const txid = await client.sendTransaction(hex);
    return { txid, hex };
  }

  return {
    async previewTransaction(input) {
      assertTransactionPreviewInput(input, "previewTransaction");
      const preview = await prepareTransactionPreview({
        ports,
        wallet: input.wallet,
        recipients: input.recipients,
        changeAddress: input.changeAddress,
        feeRate: input.feeRate ? BigInt(input.feeRate) : undefined,
      });

      return preview.draft;
    },

    async sendTransaction(input) {
      const signed = await signTransactionHex(input);
      const broadcasted = await broadcastTxHex(
        input.wallet.networkId,
        signed.hex,
      );
      return { txid: broadcasted.txid, hex: signed.hex };
    },

    signTransactionHex,

    broadcastTxHex,
  };
}

function assertTransactionServicePorts(ports: ServicesPorts): void {
  if (!ports.secrets || !ports.registry || !ports.blockbook || !ports.runtime) {
    throw new Error(
      "createTransactionService requires secrets, registry, blockbook, and runtime ports",
    );
  }
}

function assertTransactionPreviewInput(
  input: TransactionPreviewInput,
  methodName: string,
): void {
  assertNonEmptyString(input.wallet.walletId, methodName, "wallet.walletId");
  assertNonEmptyString(input.wallet.networkId, methodName, "wallet.networkId");
  assertNonEmptyString(input.changeAddress, methodName, "changeAddress");

  if (input.recipients.length === 0) {
    throw new Error(`${methodName} requires at least one recipient`);
  }

  input.recipients.forEach((recipient, index) => {
    assertNonEmptyString(
      recipient.address,
      methodName,
      `recipients[${index}].address`,
    );
    assertNonEmptyString(
      recipient.value,
      methodName,
      `recipients[${index}].value`,
    );
  });
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
