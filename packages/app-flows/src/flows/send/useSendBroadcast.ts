import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TransactionService } from "@prl-wallet/services";
import {
  getAddressQueryKey,
  getWalletTxHistoryQueryKey,
} from "../queryKeys.js";
import type { SigningWalletReference } from "./sendUtils.js";

// locked broadcast 403 copy (UI-SPEC Lock #6, 14 words
// verbatim). Triggered by BackendAttestationError ( routing) AND
// by transport-level offline/timeout/network errors so the user sees one
// consistent failure paradigm regardless of the underlying root cause.
const BROADCAST_NETWORK_FAILURE_MESSAGE =
  "Couldn't reach the network. Please check your connection and try again in a moment.";

// Error class names this hook treats as "couldn't reach the network".
// We match by name (NOT by `instanceof`) because @prl-wallet/api-client ships
// as ESM dist while consumers may resolve different copies of the module —
// instanceof can spuriously fail across realm boundaries.
const NETWORK_FAILURE_ERROR_NAMES: ReadonlySet<string> = new Set([
  "BackendAttestationError",
  "BackendOfflineError",
  "BackendNetworkError",
]);

function mapBroadcastError(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = (err as { name?: string }).name;
    if (typeof name === "string" && NETWORK_FAILURE_ERROR_NAMES.has(name)) {
      return BROADCAST_NETWORK_FAILURE_MESSAGE;
    }
  }
  if (err instanceof Error) return err.message;
  if (err) return String(err);
  return "";
}

type UseSendBroadcastArgs = {
  transactionService: TransactionService;
  signingWallet: SigningWalletReference | null;
  changeAddress: string | null;
  recipientAddress: string;
  amountSats: bigint;
  activeFeeRate: bigint;
  initError: string | null;
  isInitializing: boolean;
  isBalanceLoading: boolean;
};

export type SignedTxHandle = {
  hex: string;
  previewedTxid: string;
};

export type SendBroadcastResult = {
  // EXISTING (mobile call sites unchanged):
  confirmSend: () => Promise<void>;
  retrySend: () => Promise<void>;
  isBroadcasting: boolean;
  canSend: boolean;
  canRetry: boolean;
  errorMessage: string | null;
  txid: string | null;
  // NEW ():
  prepareSigned: () => Promise<SignedTxHandle>;
  broadcast: (handle: SignedTxHandle) => Promise<void>;
  isSigning: boolean;
  signedHandle: SignedTxHandle | null;
  resetSignedHandle: () => void;
};

export function useSendBroadcast({
  transactionService,
  signingWallet,
  changeAddress,
  recipientAddress,
  amountSats,
  activeFeeRate,
  initError,
  isInitializing,
  isBalanceLoading,
}: UseSendBroadcastArgs): SendBroadcastResult {
  const queryClient = useQueryClient();
  const [txid, setTxid] = useState<string | null>(null);
  const [signedHandle, setSignedHandle] = useState<SignedTxHandle | null>(null);

  // --- : sign-only mutation ---
  const signMutation = useMutation({
    mutationFn: async (): Promise<SignedTxHandle> => {
      if (!signingWallet || !changeAddress) {
        throw new Error(initError ?? "Unable to prepare transaction");
      }

      return transactionService.signTransactionHex({
        wallet: signingWallet,
        recipients: [
          {
            address: recipientAddress,
            value: amountSats.toString(),
          },
        ],
        changeAddress,
        feeRate: activeFeeRate.toString(),
      });
    },
    onSuccess: (handle) => {
      setSignedHandle(handle);
    },
  });

  // --- : broadcast-only mutation ---
  const broadcastMutation = useMutation({
    mutationFn: async (handle: SignedTxHandle) => {
      if (!signingWallet) {
        throw new Error(initError ?? "Unable to broadcast transaction");
      }

      return transactionService.broadcastTxHex(
        signingWallet.networkId,
        handle.hex,
      );
    },
    onSuccess: async (result) => {
      setTxid(result.txid);
      await queryClient.invalidateQueries({ queryKey: getAddressQueryKey() });
      await queryClient.invalidateQueries({
        queryKey: getWalletTxHistoryQueryKey(),
      });
    },
  });

  // --- : exposed primitives ---
  const prepareSigned = useCallback(async (): Promise<SignedTxHandle> => {
    return signMutation.mutateAsync();
  }, [signMutation]);

  const broadcast = useCallback(
    async (handle: SignedTxHandle): Promise<void> => {
      await broadcastMutation.mutateAsync(handle);
    },
    [broadcastMutation],
  );

  const resetSignedHandle = useCallback((): void => {
    setSignedHandle(null);
  }, []);

  // --- Preserved mobile contract ---
  const canSend =
    !isInitializing &&
    !isBalanceLoading &&
    !signMutation.isPending &&
    !broadcastMutation.isPending &&
    !initError &&
    signingWallet !== null &&
    changeAddress !== null;

  const confirmSend = useCallback(async () => {
    if (!canSend) return;
    try {
      const handle = await prepareSigned();
      await broadcast(handle);
    } catch {
      // error handled by mutation state
    }
  }, [canSend, prepareSigned, broadcast]);

  const retrySend = useCallback(async () => {
    signMutation.reset();
    broadcastMutation.reset();
    try {
      const handle = await prepareSigned();
      await broadcast(handle);
    } catch {
      // error handled by mutation state
    }
  }, [signMutation, broadcastMutation, prepareSigned, broadcast]);

  // broadcastMutation errors that name-match
  // BackendAttestationError / BackendOfflineError / BackendNetworkError are
  // remapped to the locked 14-word user-facing copy (UI-SPEC Lock #6). The
  // raw error code (`attestation-unenrolled`, `403`, etc.) NEVER reaches the
  // user. signMutation errors are local-signing failures and pass through
  // verbatim — they're not network errors.
  const errorMessage =
    initError ??
    (signMutation.error
      ? signMutation.error instanceof Error
        ? signMutation.error.message
        : String(signMutation.error)
      : broadcastMutation.error
        ? mapBroadcastError(broadcastMutation.error)
        : null);

  return {
    // Preserved existing fields
    confirmSend,
    retrySend,
    isBroadcasting: broadcastMutation.isPending,
    canSend,
    canRetry: Boolean(signMutation.error || broadcastMutation.error),
    errorMessage,
    txid,
    // New fields
    prepareSigned,
    broadcast,
    isSigning: signMutation.isPending,
    signedHandle,
    resetSignedHandle,
  };
}
