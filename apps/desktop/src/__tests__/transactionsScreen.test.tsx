// apps/desktop/src/__tests__/transactionsScreen.test.tsx
//
// Contract tests for the TransactionsScreen extracted from WalletDetailScreen
// during the WalletDetail polish pass. Tests originally seeded under
// (txid hover-reveal copy + W-7 PRL no-explorer-link)
// + W-7 PRL no-explorer-link assertion are migrated here verbatim.

import { describe, test, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { TransactionsScreen } from "@/screens/Transactions/TransactionsScreen";
import { renderUnderHarness } from "./_harness/TestHarness";
import { seedWallet } from "./_harness/factories";

vi.mock("@prl-wallet/app-flows", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prl-wallet/app-flows")>();
  return { ...actual };
});

vi.mock("@prl-wallet/api-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@prl-wallet/api-client")>();
  return { ...actual };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const TXID_A =
  "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
const TXID_B =
  "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";

async function mockFlowAndHistory(opts: { networkId?: string } = {}) {
  const networkId = opts.networkId ?? "btc-testnet";
  const appFlows = await import("@prl-wallet/app-flows");
  const blockbook = await import("@prl-wallet/api-client");

  vi.spyOn(appFlows, "useWalletDetailFlow").mockReturnValue({
    wallet: {
      id: "w1",
      name: "My BTC",
      networkId,
      createdAt: 1700000000000,
    },
    walletType: "mnemonic",
    addresses: ["tb1qaddr1"],
    derivedAddresses: [],
    isDiscovering: false,
    isRefreshing: false,
    hasMultipleAddresses: false,
    usedAddressCount: 1,
    networkId,
    persistBalance: vi.fn(),
    refresh: vi.fn(),
    openSend: vi.fn(),
    openReceive: vi.fn(),
    openTransactionHistory: vi.fn(),
    openAddressList: vi.fn(),
    goBack: vi.fn(),
    deleteWallet: vi.fn(),
  } as ReturnType<typeof appFlows.useWalletDetailFlow>);

  vi.spyOn(blockbook, "useWalletTransactionHistory").mockReturnValue({
    transactions: [
      {
        txid: TXID_A,
        netSatoshis: 10000n,
        blockTime: 1700000000,
        version: 1,
        vin: [],
        vout: [],
        blockHash: "",
        blockHeight: 800000,
        confirmations: 1,
        value: "10000",
        valueIn: "0",
        fees: "0",
        hex: "",
      } as unknown as Awaited<
        ReturnType<typeof blockbook.useWalletTransactionHistory>
      >["transactions"][number],
      {
        txid: TXID_B,
        netSatoshis: -5000n,
        blockTime: 1699999000,
        version: 1,
        vin: [],
        vout: [],
        blockHash: "",
        blockHeight: 799999,
        confirmations: 2,
        value: "5000",
        valueIn: "0",
        fees: "0",
        hex: "",
      } as unknown as Awaited<
        ReturnType<typeof blockbook.useWalletTransactionHistory>
      >["transactions"][number],
    ],
    hasMore: false,
    isFetchingMore: false,
    fetchMore: vi.fn(),
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof blockbook.useWalletTransactionHistory>);
}

describe("TransactionsScreen", () => {
  test("each tx row contains a 'Copy transaction ID' button", async () => {
    await mockFlowAndHistory();
    renderUnderHarness({
      routes: [
        { path: "/wallet/:id/transactions", element: <TransactionsScreen /> },
      ],
      initialEntries: ["/wallet/w1/transactions"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", networkId: "btc-testnet" }));
      },
      networkGateOpen: true,
    });

    await screen.findByRole("heading", { level: 1, name: "Transactions" });

    const copyButtons = screen.getAllByRole("button", {
      name: /copy transaction id/i,
    });
    expect(copyButtons).toHaveLength(2);
  });

  test("clicking the txid copy icon writes that txid to the clipboard", async () => {
    await mockFlowAndHistory();
    const { bundle } = renderUnderHarness({
      routes: [
        { path: "/wallet/:id/transactions", element: <TransactionsScreen /> },
      ],
      initialEntries: ["/wallet/w1/transactions"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", networkId: "btc-testnet" }));
      },
      networkGateOpen: true,
    });

    await screen.findByRole("heading", { level: 1, name: "Transactions" });

    const setStringSpy = vi.spyOn(bundle.ports.clipboard, "setString");

    const copyButtons = screen.getAllByRole("button", {
      name: /copy transaction id/i,
    });
    fireEvent.click(copyButtons[0]);

    expect(setStringSpy).toHaveBeenCalledTimes(1);
    expect(setStringSpy).toHaveBeenCalledWith(TXID_A);
  });

  test("'View on explorer' anchor renders for BTC tx rows", async () => {
    await mockFlowAndHistory({ networkId: "btc-testnet" });
    renderUnderHarness({
      routes: [
        { path: "/wallet/:id/transactions", element: <TransactionsScreen /> },
      ],
      initialEntries: ["/wallet/w1/transactions"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", networkId: "btc-testnet" }));
      },
      networkGateOpen: true,
    });

    await screen.findByRole("heading", { level: 1, name: "Transactions" });

    const links = screen.getAllByText("View on explorer");
    expect(links.length).toBe(2);
  });

  test("W-7: PRL wallet rows do NOT render 'View on explorer' link", async () => {
    await mockFlowAndHistory({ networkId: "prl-mainnet" });
    renderUnderHarness({
      routes: [
        { path: "/wallet/:id/transactions", element: <TransactionsScreen /> },
      ],
      initialEntries: ["/wallet/w1/transactions"],
      prepopulate: (b) => {
        b.stores.walletList.getState().addWallet(
          seedWallet({
            id: "w1",
            name: "My PRL",
            networkId: "prl-mainnet",
          }),
        );
      },
      networkGateOpen: true,
    });

    await screen.findByRole("heading", { level: 1, name: "Transactions" });

    expect(screen.queryByText("View on explorer")).toBeNull();
  });
});
