import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BalanceSection } from "./BalanceSection";

jest.mock("@prl-wallet/api-client", () => ({
  satoshisToPrl: jest.fn((satoshis: string) => {
    const parsed = Number.parseInt(satoshis, 10);
    if (!Number.isFinite(parsed)) {
      return "0";
    }

    return (parsed / 100_000_000).toFixed(8).replace(/\.?0+$/, "");
  }),
  useWalletBalance: jest.fn(),
}));

// usePrice hook is mocked here; production tests rely
// on the unavailable shape unless overridden per-test.
jest.mock("@prl-wallet/app-flows", () => {
  const actual = jest.requireActual("@prl-wallet/app-flows");
  return {
    ...actual,
    usePrice: jest.fn(() => ({
      usd: null,
      isStale: false,
      isUnavailable: true,
      asOf: null,
      isLoading: false,
    })),
  };
});

jest.mock("../services/blockbookClient", () => ({
  getBlockbookClient: jest.fn(() => ({ mocked: true })),
}));

const { useWalletBalance } = jest.requireMock("@prl-wallet/api-client") as {
  useWalletBalance: jest.Mock;
};
const { usePrice } = jest.requireMock("@prl-wallet/app-flows") as {
  usePrice: jest.Mock;
};

describe("BalanceSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset usePrice to the default unavailable shape between tests.
    usePrice.mockReturnValue({
      usd: null,
      isStale: false,
      isUnavailable: true,
      asOf: null,
      isLoading: false,
    });
  });

  it("shows last known balance with a loader while updated balance is still loading", () => {
    useWalletBalance.mockReturnValue({
      confirmed: 0n,
      unconfirmed: 0n,
      hasData: false,
      isError: false,
      error: null,
      isFetching: false,
      isLoading: true,
      refetch: jest.fn(),
    });

    render(
      <BalanceSection
        addresses={["bc1qexample"]}
        initialConfirmedSats="1000"
        networkId="prl-mainnet"
        showLoadingIndicator
      />,
    );

    expect(screen.getByText("Last known balance")).toBeTruthy();
    expect(screen.getByLabelText("Loading updated balance")).toBeTruthy();
    expect(screen.getByText("0.00001 PRL")).toBeTruthy();
  });

  it("shows updated balance without the stale title once fresh data is available", () => {
    useWalletBalance.mockReturnValue({
      confirmed: 2500n,
      unconfirmed: 0n,
      hasData: true,
      isError: false,
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <BalanceSection
        addresses={["bc1qexample"]}
        initialConfirmedSats="1000"
        networkId="prl-mainnet"
      />,
    );

    expect(screen.getByText("Balance")).toBeTruthy();
    expect(screen.queryByText("Last known balance")).toBeNull();
    expect(screen.queryByLabelText("Loading updated balance")).toBeNull();
    expect(screen.getByText("0.000025 PRL")).toBeTruthy();
  });

  it("keeps showing a loader instead of 0 PRL during the first fetch with no stored balance", () => {
    useWalletBalance.mockReturnValue({
      confirmed: 0n,
      unconfirmed: 0n,
      hasData: false,
      isError: false,
      error: null,
      isFetching: true,
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <BalanceSection
        addresses={["bc1qexample"]}
        networkId="prl-mainnet"
        showLoadingIndicator
      />,
    );

    expect(screen.getByLabelText("Loading balance")).toBeTruthy();
    expect(screen.queryByText("Balance")).toBeNull();
    expect(screen.queryByText("0 PRL")).toBeNull();
  });

  // , , — fiat balance sublabel render tests.

  it("renders fiat sublabel ≈ $X.XX USD when usePrice returns a usd value", () => {
    useWalletBalance.mockReturnValue({
      confirmed: 100_000_000n, // 1 BTC
      unconfirmed: 0n,
      hasData: true,
      isError: false,
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: jest.fn(),
    });
    usePrice.mockReturnValue({
      usd: 65432,
      isStale: false,
      isUnavailable: false,
      asOf: 1730000000000,
      isLoading: false,
    });

    render(
      <BalanceSection addresses={["bc1qexample"]} networkId="btc-mainnet" />,
    );

    expect(screen.getByText(/≈ \$65,432\.00 USD/)).toBeTruthy();
  });

  it("renders `≈ —` when usePrice returns usd=null ( em-dash unavailable token)", () => {
    useWalletBalance.mockReturnValue({
      confirmed: 100_000_000n,
      unconfirmed: 0n,
      hasData: true,
      isError: false,
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: jest.fn(),
    });
    usePrice.mockReturnValue({
      usd: null,
      isStale: false,
      isUnavailable: true,
      asOf: null,
      isLoading: false,
    });

    render(
      <BalanceSection addresses={["bc1qexample"]} networkId="prl-mainnet" />,
    );

    expect(screen.getByText("≈ —")).toBeTruthy();
  });

  it("renders `(stale)` suffix when usePrice reports isStale=true", () => {
    useWalletBalance.mockReturnValue({
      confirmed: 100_000_000n,
      unconfirmed: 0n,
      hasData: true,
      isError: false,
      error: null,
      isFetching: false,
      isLoading: false,
      refetch: jest.fn(),
    });
    usePrice.mockReturnValue({
      usd: 65432,
      isStale: true,
      isUnavailable: false,
      asOf: 1730000000000,
      isLoading: false,
    });

    render(
      <BalanceSection addresses={["bc1qexample"]} networkId="btc-mainnet" />,
    );

    expect(screen.getByText(/≈ \$65,432\.00 USD \(stale\)/)).toBeTruthy();
  });

  it("shows inline updated-balance error details when refresh fails after a stored balance exists", () => {
    useWalletBalance.mockReturnValue({
      confirmed: 0n,
      unconfirmed: 0n,
      hasData: false,
      isError: true,
      error: new Error("blockbook timeout"),
      isFetching: false,
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <BalanceSection
        addresses={["bc1qexample"]}
        initialConfirmedSats="1000"
        networkId="prl-mainnet"
      />,
    );

    expect(screen.getByText("Last known balance")).toBeTruthy();
    expect(screen.getByText("Error fetching updated balance.")).toBeTruthy();
    expect(screen.getByText("Show details")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Show balance error details"));

    expect(screen.getByText("blockbook timeout")).toBeTruthy();
  });
});
