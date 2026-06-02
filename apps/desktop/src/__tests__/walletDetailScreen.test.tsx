// apps/desktop/src/__tests__/walletDetailScreen.test.tsx
//
// Task 3 — WalletDetailScreen contract tests.
// W-11: every wallet seeded via the type-safe `seedWallet` factory — NO `as never`.
// W-7: PRL wallet rows MUST NOT render a "View on explorer" link
// (blockchains.json has no blockExplorerUrl for any PRL network).
// Pitfall 8: tests requiring live data set networkGateOpen=true; cached-offline
// test sets networkGateOpen=false to exercise the marker.
//
// Task 3 — TX-04: Send button watch-only disabled state.
// TX-04 tests mock useWalletDetailFlow to control walletType directly without
// going through the real secrets+blockbook async chain (which throws in the
// test harness because blockbook fetch is not stubbed and discoverAddresses
// catches the error and resets walletType to null).
//
// ( ) — txid hover-reveal copy + inline
// next-receive-address row copy. Tests below mock @prl-wallet/api-client hooks
// to seed transactions deterministically.

import { describe, test, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletDetailScreen } from "@/screens/WalletDetail/WalletDetailScreen";
import { renderUnderHarness } from "./_harness/TestHarness";
import { seedWallet } from "./_harness/factories"; // W-11

// ---------------------------------------------------------------------------
// Module-level mock for app-flows — passes through real implementation by
// default. TX-04 tests override useWalletDetailFlow per-test via
// mockImplementationOnce so they can control walletType without the
// secrets+blockbook chain.
// ---------------------------------------------------------------------------
vi.mock("@prl-wallet/app-flows", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prl-wallet/app-flows")>();
  return { ...actual };
});

// / — mock @prl-wallet/api-client so tests can seed tx
// history deterministically without setting up Blockbook fetch stubs.
vi.mock("@prl-wallet/api-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@prl-wallet/api-client")>();
  return { ...actual };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WalletDetailScreen", () => {
  test("renders wallet name + cached balance + 'Cached balance · offline' marker when offline", async () => {
    renderUnderHarness({
      routes: [{ path: "/wallet/:id", element: <WalletDetailScreen /> }],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList.getState().addWallet(
          seedWallet({
            id: "w1",
            name: "My BTC",
            networkId: "btc-testnet",
            lastKnownBalance: "41234",
          }),
        );
      },
      networkGateOpen: false, // OFFLINE — cached only (T-20-32)
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "My BTC" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0.00041234")).toBeInTheDocument(); // cached
    expect(screen.getByText("Cached balance · offline")).toBeInTheDocument();
  });

  test("DangerZone is rendered at the bottom", async () => {
    renderUnderHarness({
      routes: [{ path: "/wallet/:id", element: <WalletDetailScreen /> }],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList.getState().addWallet(
          seedWallet({
            id: "w1",
            name: "My BTC",
            networkId: "btc-testnet",
          }),
        );
      },
      networkGateOpen: true, // Pitfall 8
    });
    // "Danger zone" heading present (UI-SPEC line 211)
    expect(
      await screen.findByRole("heading", { name: /Danger zone/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete wallet" }),
    ).toBeInTheDocument();
  });

  test("missing wallet (post-delete back-navigate) redirects to /wallets", async () => {
    renderUnderHarness({
      routes: [
        { path: "/wallet/:id", element: <WalletDetailScreen /> },
        { path: "/wallets", element: <div data-testid="list-marker" /> },
      ],
      initialEntries: ["/wallet/missing"],
      // no prepopulate — wallet "missing" doesn't exist
      networkGateOpen: true,
    });
    expect(await screen.findByTestId("list-marker")).toBeInTheDocument();
  });

  // W-7 PRL no-explorer-link assertion: lives in transactionsScreen.test.tsx
  // since the tx list moved off WalletDetail in the polish pass. WalletDetail
  // no longer renders tx rows.
});

// ---------------------------------------------------------------------------
// Task 3 — TX-04: Send button watch-only disabled state
//
// These tests mock useWalletDetailFlow to inject walletType directly.
// The real hook's async chain (secrets → discoverAddresses → blockbook) throws
// in the test harness because blockbook fetch is not stubbed; the catch block
// resets walletType to null. Mocking the hook is the only way to exercise the
// walletType === "xpub" branch reliably.
// ---------------------------------------------------------------------------
describe(" — Send button (TX-04)", () => {
  test("Send button is disabled with tooltip when walletType is xpub", async () => {
    // Import the mocked module and override useWalletDetailFlow for this test
    const appFlows = await import("@prl-wallet/app-flows");
    vi.spyOn(appFlows, "useWalletDetailFlow").mockReturnValue({
      wallet: {
        id: "w-xpub",
        name: "Watch-only BTC",
        networkId: "btc-testnet",
        createdAt: 1700000000000,
      },
      walletType: "xpub",
      addresses: [],
      derivedAddresses: [],
      isDiscovering: false,
      isRefreshing: false,
      hasMultipleAddresses: false,
      usedAddressCount: 0,
      networkId: "btc-testnet",
      persistBalance: vi.fn(),
      refresh: vi.fn(),
      openSend: vi.fn(),
      openReceive: vi.fn(),
      openTransactionHistory: vi.fn(),
      openAddressList: vi.fn(),
      goBack: vi.fn(),
      deleteWallet: vi.fn(),
    } as ReturnType<typeof appFlows.useWalletDetailFlow>);

    renderUnderHarness({
      routes: [{ path: "/wallet/:id", element: <WalletDetailScreen /> }],
      initialEntries: ["/wallet/w-xpub"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w-xpub", networkId: "btc-testnet" }));
      },
      networkGateOpen: true,
    });

    // Heading renders immediately with mocked wallet data
    await screen.findByRole("heading", { level: 1, name: "Watch-only BTC" });

    // Send button must be disabled (walletType === "xpub") — .
    // The button's aria-label encodes the locked tooltip copy so that
    // screen readers announce the reason even when the tooltip portal is not
    // open (Radix UI portals only render tooltip content on hover, which
    // requires ResizeObserver — not available in jsdom).
    const sendBtn = screen.getByRole("button", {
      name: /watch-only wallets cannot send/i,
    });
    expect(sendBtn).toBeDisabled();

    // The WalletDetailScreen renders a TooltipContent with the locked copy
    // "Watch-only wallets cannot send." — verify it exists in the source
    // (the plan's locked copy lives in TooltipContent, accessible via its
    // data-slot attribute in the DOM even when the portal is closed):
    // Radix UI TooltipContent uses a portal, so we assert the aria-label
    // on the button which encodes the same locked copy.
    expect(sendBtn).toHaveAttribute(
      "aria-label",
      "Send (watch-only wallets cannot send)",
    );
  });

  test("Send button is enabled and routes to /wallet/:id/send when walletType is mnemonic", async () => {
    const user = userEvent.setup();

    const appFlows = await import("@prl-wallet/app-flows");
    vi.spyOn(appFlows, "useWalletDetailFlow").mockReturnValue({
      wallet: {
        id: "w1",
        name: "My BTC",
        networkId: "btc-testnet",
        createdAt: 1700000000000,
      },
      walletType: "mnemonic",
      addresses: [],
      derivedAddresses: [],
      isDiscovering: false,
      isRefreshing: false,
      hasMultipleAddresses: false,
      usedAddressCount: 0,
      networkId: "btc-testnet",
      persistBalance: vi.fn(),
      refresh: vi.fn(),
      openSend: vi.fn(),
      openReceive: vi.fn(),
      openTransactionHistory: vi.fn(),
      openAddressList: vi.fn(),
      goBack: vi.fn(),
      deleteWallet: vi.fn(),
    } as ReturnType<typeof appFlows.useWalletDetailFlow>);

    renderUnderHarness({
      routes: [
        { path: "/wallet/:id", element: <WalletDetailScreen /> },
        // Sentinel route so we can assert navigation happened
        {
          path: "/wallet/:id/send",
          element: <div data-testid="send-screen-marker" />,
        },
      ],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", networkId: "btc-testnet" }));
      },
      networkGateOpen: true,
    });

    await screen.findByRole("heading", { level: 1, name: "My BTC" });

    // Send button is enabled for mnemonic wallets
    const sendBtn = screen.getByRole("button", { name: /^Send$/i });
    expect(sendBtn).not.toBeDisabled();

    // Clicking navigates to /wallet/:id/send
    await user.click(sendBtn);
    expect(await screen.findByTestId("send-screen-marker")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// (txid hover-reveal copy) + W-5 (inline
// next-receive-address row with icon-only copy).
//
// Tests mock useWalletDetailFlow + useWalletTransactionHistory so we can seed
// txid rows deterministically without driving the real Blockbook chain.
// ---------------------------------------------------------------------------
describe(" — (CopyButton wiring)", () => {
  const TXID_A =
    "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
  const TXID_B =
    "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";

  async function mockFlowAndHistory(
    opts: {
      nextReceiveAddress?: string;
    } = {},
  ) {
    const appFlows = await import("@prl-wallet/app-flows");
    const blockbook = await import("@prl-wallet/api-client");

    vi.spyOn(appFlows, "useWalletDetailFlow").mockReturnValue({
      wallet: {
        id: "w1",
        name: "My BTC",
        networkId: "btc-testnet",
        createdAt: 1700000000000,
        ...(opts.nextReceiveAddress !== undefined
          ? { nextReceiveAddress: opts.nextReceiveAddress }
          : {}),
      },
      walletType: "mnemonic",
      addresses: ["tb1qaddr1"],
      derivedAddresses: [],
      isDiscovering: false,
      isRefreshing: false,
      hasMultipleAddresses: false,
      usedAddressCount: 1,
      networkId: "btc-testnet",
      persistBalance: vi.fn(),
      refresh: vi.fn(),
      openSend: vi.fn(),
      openReceive: vi.fn(),
      openTransactionHistory: vi.fn(),
      openAddressList: vi.fn(),
      goBack: vi.fn(),
      deleteWallet: vi.fn(),
    } as ReturnType<typeof appFlows.useWalletDetailFlow>);

    vi.spyOn(blockbook, "useWalletBalance").mockReturnValue({
      confirmed: 41234n,
      unconfirmed: 0n,
      hasData: true,
      isFetching: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.spyOn(blockbook, "useWalletTransactionHistory").mockReturnValue({
      transactions: [
        {
          txid: TXID_A,
          netSatoshis: 10000n,
          blockTime: 1700000000,
          // Spread the rest of the BlockbookTx-shaped fields with safe defaults.
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
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof blockbook.useWalletTransactionHistory>);
  }

  test("Test 4 (W-5): next-receive-address row renders inline copy when wallet.nextReceiveAddress is populated", async () => {
    const ADDR = "tb1qtestaddress0000000000000000000000000000";
    await mockFlowAndHistory({ nextReceiveAddress: ADDR });

    const { bundle } = renderUnderHarness({
      routes: [{ path: "/wallet/:id", element: <WalletDetailScreen /> }],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList.getState().addWallet(
          seedWallet({
            id: "w1",
            networkId: "btc-testnet",
            nextReceiveAddress: ADDR,
          }),
        );
      },
      networkGateOpen: true,
    });

    await screen.findByRole("heading", { level: 1, name: "My BTC" });

    // Row presence + locked aria
    const copyAddressBtn = screen.getByRole("button", {
      name: /^copy address$/i,
    });
    expect(copyAddressBtn).toBeInTheDocument();

    // Address text rendered in the row
    expect(screen.getByText(ADDR)).toBeInTheDocument();

    // Click writes the address to the clipboard
    const setStringSpy = vi.spyOn(bundle.ports.clipboard, "setString");
    fireEvent.click(copyAddressBtn);
    expect(setStringSpy).toHaveBeenCalledTimes(1);
    expect(setStringSpy).toHaveBeenCalledWith(ADDR);
  });

  test("Test 5 (W-5): next-receive-address row is suppressed when nextReceiveAddress is undefined", async () => {
    await mockFlowAndHistory(); // nextReceiveAddress NOT populated
    renderUnderHarness({
      routes: [{ path: "/wallet/:id", element: <WalletDetailScreen /> }],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", networkId: "btc-testnet" }));
      },
      networkGateOpen: true,
    });

    await screen.findByRole("heading", { level: 1, name: "My BTC" });

    // No "Copy address" button — the row is conditionally suppressed.
    expect(
      screen.queryByRole("button", { name: /^copy address$/i }),
    ).toBeNull();
  });
});
