// packages/app-flows/src/flows/priceFeed/__tests__/usePrice.test.ts
// flips RED stubs to GREEN.
//
// Coverage map ():
// usePrice('BTC') returns USD value from PriceFeedPort.getPrices
// usePrice('PRL') returns usd=null when PRL_USD is null ( fallback)
// returns isStale=true when port returns source=stale
// queryKey is ['price-feed'] with staleTime 60_000ms (single shared query)

import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import React, { type PropsWithChildren } from "react";
import {
  AdaptersProvider,
  type AdaptersBundle,
} from "@prl-wallet/app-adapters";
import type {
  PriceFeedPort,
  PriceSnapshotWithMeta,
  ServicesPorts,
} from "@prl-wallet/services";
import { usePrice } from "../usePrice.js";

function makePriceFeedPort(
  getPrices: jest.Mock<Promise<PriceSnapshotWithMeta>, []>,
): PriceFeedPort {
  return { getPrices };
}

interface BundleWithCache {
  bundle: AdaptersBundle;
  queryCache: QueryCache;
  queryClient: QueryClient;
  wrapper: (props: PropsWithChildren) => React.ReactElement;
}

function makeBundle(priceFeedPort: PriceFeedPort | undefined): BundleWithCache {
  const services = {
    secrets: {} as unknown,
    registry: {} as unknown,
    blockbook: () => ({}) as unknown,
    runtime: { now: () => 0, createId: () => "stub-id" },
    priceFeed: priceFeedPort,
  } as unknown as ServicesPorts;

  const bundle: AdaptersBundle = {
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
    services,
    stores: {
      walletList: {} as unknown,
      pin: {} as unknown,
      lock: {} as unknown,
      networkGate: {} as unknown,
    } as unknown as AdaptersBundle["stores"],
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const queryCache = queryClient.getQueryCache();

  function Wrapper({ children }: PropsWithChildren): React.ReactElement {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AdaptersProvider, { value: bundle }, children),
    );
  }

  return { bundle, queryCache, queryClient, wrapper: Wrapper };
}

describe("usePrice", () => {
  it("usePrice('BTC') returns USD value from PriceFeedPort.getPrices", async () => {
    const liveSnapshot: PriceSnapshotWithMeta = {
      BTC_USD: 65432.1,
      PRL_USD: null,
      source: "live",
      asOf: 1715200000000,
    };
    const getPrices = jest.fn(async () => liveSnapshot);
    const port = makePriceFeedPort(getPrices);
    const { wrapper } = makeBundle(port);

    const { result } = renderHook(() => usePrice("BTC"), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getPrices).toHaveBeenCalledTimes(1);
    expect(result.current.usd).toBe(65432.1);
    expect(result.current.isStale).toBe(false);
    expect(result.current.isUnavailable).toBe(false);
    expect(result.current.asOf).toBe(1715200000000);
  });

  it("usePrice('PRL') returns usd=null when PRL_USD is null", async () => {
    const liveSnapshot: PriceSnapshotWithMeta = {
      BTC_USD: 65432.1,
      PRL_USD: null,
      source: "live",
      asOf: 1715200000000,
    };
    const port = makePriceFeedPort(jest.fn(async () => liveSnapshot));
    const { wrapper } = makeBundle(port);

    const { result } = renderHook(() => usePrice("PRL"), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.usd).toBeNull();
    // Even on null PRL the snapshot is "live" — isStale should remain false.
    expect(result.current.isStale).toBe(false);
    expect(result.current.isUnavailable).toBe(false);
  });

  it("usePrice returns isStale=true when port returns source=stale", async () => {
    const staleSnapshot: PriceSnapshotWithMeta = {
      BTC_USD: 60000,
      PRL_USD: 0.5,
      source: "stale",
      asOf: 1715190000000,
    };
    const port = makePriceFeedPort(jest.fn(async () => staleSnapshot));
    const { wrapper } = makeBundle(port);

    const { result } = renderHook(() => usePrice("BTC"), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.usd).toBe(60000);
    expect(result.current.asOf).toBe(1715190000000);
  });

  it("usePrice queryKey is ['price-feed'] with staleTime 60_000ms (, single shared query)", async () => {
    const liveSnapshot: PriceSnapshotWithMeta = {
      BTC_USD: 70000,
      PRL_USD: 1.25,
      source: "live",
      asOf: 1715200000000,
    };
    const port = makePriceFeedPort(jest.fn(async () => liveSnapshot));
    const { wrapper, queryCache } = makeBundle(port);

    // Render BOTH symbols — they should share a single cache entry.
    const { result: btc } = renderHook(() => usePrice("BTC"), { wrapper });
    const { result: prl } = renderHook(() => usePrice("PRL"), { wrapper });

    await waitFor(() => {
      expect(btc.current.isLoading).toBe(false);
      expect(prl.current.isLoading).toBe(false);
    });

    // CRITICAL : single shared queryKey for both symbols.
    const entries = queryCache.findAll({ queryKey: ["price-feed"] });
    expect(entries).toHaveLength(1);
    expect(entries[0].queryKey).toEqual(["price-feed"]);
    expect(entries[0].options.staleTime).toBe(60_000);

    // Both hooks read from the SAME cached snapshot.
    expect(btc.current.usd).toBe(70000);
    expect(prl.current.usd).toBe(1.25);
  });
});
