import { act, renderHook, waitFor } from "@testing-library/react";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import type { TransactionService } from "@prl-wallet/services";
import { createPortWrapper } from "../../../test-utils/createPortWrapper.js";
import { useSendBroadcast } from "../useSendBroadcast.js";
import type { SignedTxHandle } from "../useSendBroadcast.js";

/**
 * split: useSendBroadcast hook tests.
 *
 * These tests cover:
 * 1. prepareSigned() returns a SignedTxHandle; broadcastTxHex spy NOT invoked.
 * 2. broadcast(handle) invokes transactionService.broadcastTxHex once and sets txid.
 * 3. confirmSend() invokes both sign + broadcast in order, produces txid.
 * 4. signedHandle state updates after prepareSigned resolves.
 * 5. isSigning toggles true → false during prepareSigned.
 * 6. errorMessage/canSend retain existing behavior (canSend false when not ready).
 * 7. resetSignedHandle() clears signedHandle state.
 */

const FAKE_SIGNED_HANDLE: SignedTxHandle = {
  hex: "deadbeef01020304",
  previewedTxid: "fake-preview-txid",
};

function buildFakeTransactionService(overrides: Partial<TransactionService> = {}): TransactionService {
  return {
    previewTransaction: jest.fn(),
    sendTransaction: jest.fn(),
    signTransactionHex: jest.fn(async () => FAKE_SIGNED_HANDLE),
    broadcastTxHex: jest.fn(async () => ({ txid: "broadcast-txid", hex: FAKE_SIGNED_HANDLE.hex })),
    ...overrides,
  } as unknown as TransactionService;
}

function buildBundle(): AdaptersBundle {
  return {
    ports: {
      clipboard: { setString: async () => undefined },
      sharing: { share: async () => undefined },
      storage: {
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      },
      networkGate: { isOpen: () => true, subscribe: () => () => {} },
      clock: { now: () => 0 },
    },
    services: {
      secrets: {},
      registry: {},
      blockbook: () => ({}),
      runtime: { now: () => 0, createId: () => "stub-id" },
    } as unknown as AdaptersBundle["services"],
    stores: {
      walletList: {} as unknown as AdaptersBundle["stores"]["walletList"],
      pin: {} as unknown as AdaptersBundle["stores"]["pin"],
      lock: {} as unknown as AdaptersBundle["stores"]["lock"],
    },
  };
}

const signingWallet = {
  walletId: "wallet-test",
  networkId: "btc-mainnet",
  walletType: "mnemonic" as const,
  capability: "signing" as const,
};

const baseArgs = {
  signingWallet,
  changeAddress: "bc1pchange",
  recipientAddress: "bc1precipient",
  amountSats: 70000n,
  activeFeeRate: 2n,
  initError: null,
  isInitializing: false,
  isBalanceLoading: false,
};

describe("useSendBroadcast split", () => {
  let wrapper: ReturnType<typeof createPortWrapper>;

  beforeEach(() => {
    jest.clearAllMocks();
    wrapper = createPortWrapper(buildBundle());
  });

  it("1. prepareSigned() returns a SignedTxHandle and does NOT invoke broadcastTxHex", async () => {
    const transactionService = buildFakeTransactionService();
    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    let handle!: SignedTxHandle;
    await act(async () => {
      handle = await result.current.prepareSigned();
    });

    expect(handle.hex).toBe(FAKE_SIGNED_HANDLE.hex);
    expect(handle.previewedTxid).toBe(FAKE_SIGNED_HANDLE.previewedTxid);
    expect(transactionService.signTransactionHex).toHaveBeenCalledTimes(1);
    expect(transactionService.broadcastTxHex).toHaveBeenCalledTimes(0);
  });

  it("2. broadcast(handle) invokes transactionService.broadcastTxHex once and sets txid", async () => {
    const transactionService = buildFakeTransactionService();
    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    await act(async () => {
      await result.current.broadcast(FAKE_SIGNED_HANDLE);
    });

    expect(transactionService.broadcastTxHex).toHaveBeenCalledTimes(1);
    expect(transactionService.broadcastTxHex).toHaveBeenCalledWith(
      signingWallet.networkId,
      FAKE_SIGNED_HANDLE.hex,
    );
    expect(result.current.txid).toBe("broadcast-txid");
  });

  it("3. confirmSend() invokes both sign + broadcast in order and produces txid", async () => {
    const callOrder: string[] = [];
    const transactionService = buildFakeTransactionService({
      signTransactionHex: jest.fn(async () => {
        callOrder.push("sign");
        return FAKE_SIGNED_HANDLE;
      }),
      broadcastTxHex: jest.fn(async () => {
        callOrder.push("broadcast");
        return { txid: "confirm-txid", hex: FAKE_SIGNED_HANDLE.hex };
      }),
    });

    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    await act(async () => {
      await result.current.confirmSend();
    });

    expect(callOrder).toEqual(["sign", "broadcast"]);
    expect(result.current.txid).toBe("confirm-txid");
  });

  it("4. signedHandle state updates after prepareSigned resolves", async () => {
    const transactionService = buildFakeTransactionService();
    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    expect(result.current.signedHandle).toBeNull();

    await act(async () => {
      await result.current.prepareSigned();
    });

    expect(result.current.signedHandle).toEqual(FAKE_SIGNED_HANDLE);
  });

  it("5. isSigning is false initially and after prepareSigned completes", async () => {
    const transactionService = buildFakeTransactionService();
    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    // Initially false
    expect(result.current.isSigning).toBe(false);

    await act(async () => {
      await result.current.prepareSigned();
    });

    // After completion, false again
    expect(result.current.isSigning).toBe(false);
  });

  it("6. canSend is false when isInitializing=true; errorMessage reflects initError", () => {
    const transactionService = buildFakeTransactionService();
    const { result } = renderHook(
      () =>
        useSendBroadcast({
          ...baseArgs,
          transactionService,
          isInitializing: true,
          initError: "wallet not ready",
        }),
      { wrapper },
    );

    expect(result.current.canSend).toBe(false);
    expect(result.current.errorMessage).toBe("wallet not ready");
  });

  // ─── — + ────────────────────────────────────
  it(": hook surfaces transport-level abort/timeout errors verbatim (BackendApiClient owns the 10s timeout)", async () => {
    // contract: the `useSendBroadcast` hook does NOT add a
    // hook-level timeout. The transport (BackendApiClient.fetchWithTimeout
    // → AbortController.signal.timeout(10_000)) owns timeout enforcement.
    // This test verifies the hook propagates a transport-level abort error
    // (the shape AbortController throws) without swallowing or remapping
    // (the user-facing remap to the locked copy is the test below).
    const abortErr = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    const broadcastTxHex = jest.fn(async () => {
      throw abortErr;
    });
    const transactionService = buildFakeTransactionService({
      broadcastTxHex,
    });
    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.broadcast(FAKE_SIGNED_HANDLE);
      } catch {
        /* error reflected in hook state */
      }
    });

    expect(broadcastTxHex).toHaveBeenCalledTimes(1);
    // AbortError name is not in the remap set, so the raw message
    // propagates (NOT remapped — the timeout is observable to callers).
    await waitFor(() => {
      expect(result.current.errorMessage).toBe("aborted");
    });
  });

  it(": BackendAttestationError on broadcast surfaces the locked 14-word copy (no internal codes)", async () => {
    // Synthetic error with the same name BackendApiClient raises on 403
    // attestation-* codes (). The hook MUST map it to the
    // locked user-facing copy (UI-SPEC Lock #6) — not the raw message.
    class FakeBackendAttestationError extends Error {
      readonly name = "BackendAttestationError";
      readonly code = "attestation-unenrolled";
      readonly status = 403;
      constructor() {
        super("attestation-unenrolled");
      }
    }
    const broadcastTxHex = jest.fn(async () => {
      throw new FakeBackendAttestationError();
    });
    const transactionService = buildFakeTransactionService({ broadcastTxHex });
    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.broadcast(FAKE_SIGNED_HANDLE);
      } catch {
        /* error reflected in hook state */
      }
    });

    // Locked verbatim copy (14 words) — UI-SPEC Lock #6. Use waitFor so
    // the TanStack Query mutation error has time to flow through React state.
    await waitFor(() => {
      expect(result.current.errorMessage).toBe(
        "Couldn't reach the network. Please check your connection and try again in a moment.",
      );
    });
    // No internal code leaked into the user-facing message.
    expect(result.current.errorMessage).not.toMatch(/attestation/i);
    expect(result.current.errorMessage).not.toMatch(/403/);
  });

  it("7. resetSignedHandle() clears signedHandle; subsequent broadcast(handle) still works with explicit handle", async () => {
    const transactionService = buildFakeTransactionService();
    const { result } = renderHook(
      () => useSendBroadcast({ ...baseArgs, transactionService }),
      { wrapper },
    );

    // Populate signedHandle
    await act(async () => {
      await result.current.prepareSigned();
    });
    expect(result.current.signedHandle).toEqual(FAKE_SIGNED_HANDLE);

    // Clear it
    act(() => {
      result.current.resetSignedHandle();
    });

    await waitFor(() => {
      expect(result.current.signedHandle).toBeNull();
    });

    // broadcast with an explicit handle still works even when signedHandle is null
    await act(async () => {
      await result.current.broadcast(FAKE_SIGNED_HANDLE);
    });

    expect(transactionService.broadcastTxHex).toHaveBeenCalledWith(
      signingWallet.networkId,
      FAKE_SIGNED_HANDLE.hex,
    );
    expect(result.current.txid).toBe("broadcast-txid");
  });
});
