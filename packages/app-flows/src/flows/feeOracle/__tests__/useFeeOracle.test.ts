// packages/app-flows/src/flows/feeOracle/__tests__/useFeeOracle.test.ts
// flips RED stubs to GREEN.
//
// Coverage map ():
// returns LiveRates from FeeOraclePort.getFees on live
// returns null data + isUnavailable=true when port returns rates=null
// returns isStale=true when port returns source=stale
// queryKey is ['fee-oracle', networkId] with staleTime 30_000ms
//
// The hook reads the FeeOraclePort from useAdapters().services.feeOracle.
// Tests build a minimal AdaptersBundle and mount via createPortWrapper
// (matches the existing useReceiveFlow test pattern in the same package).

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
  FeeOraclePort,
  LiveRatesWithMeta,
  ServicesPorts,
} from "@prl-wallet/services";
import { useFeeOracle } from "../useFeeOracle.js";

function makeFeeOraclePort(
  getFees: jest.Mock<Promise<LiveRatesWithMeta>, [string]>,
): FeeOraclePort {
  return { getFees };
}

interface BundleWithCache {
  bundle: AdaptersBundle;
  queryCache: QueryCache;
  queryClient: QueryClient;
  wrapper: (props: PropsWithChildren) => React.ReactElement;
}

function makeBundle(feeOraclePort: FeeOraclePort | undefined): BundleWithCache {
  const services = {
    secrets: {} as unknown,
    registry: {} as unknown,
    blockbook: () => ({}) as unknown,
    runtime: { now: () => 0, createId: () => "stub-id" },
    feeOracle: feeOraclePort,
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

describe("useFeeOracle", () => {
  it("useFeeOracle(networkId) returns LiveRates from FeeOraclePort.getFees", async () => {
    const liveSnapshot: LiveRatesWithMeta = {
      rates: { slow: 1, medium: 3, fast: 6 },
      source: "live",
      asOf: 1715200000000,
    };
    const getFees = jest.fn(async () => liveSnapshot);
    const port = makeFeeOraclePort(getFees);
    const { wrapper } = makeBundle(port);

    const { result } = renderHook(() => useFeeOracle("btc-mainnet"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getFees).toHaveBeenCalledWith("btc-mainnet");
    expect(result.current.data).toEqual({ slow: 1, medium: 3, fast: 6 });
    expect(result.current.isStale).toBe(false);
    expect(result.current.isUnavailable).toBe(false);
    expect(result.current.asOf).toBe(1715200000000);
  });

  it("useFeeOracle returns null data + isUnavailable=true when port returns rates=null", async () => {
    const unavailableSnapshot: LiveRatesWithMeta = {
      rates: null,
      source: "unavailable",
      asOf: null,
    };
    const port = makeFeeOraclePort(jest.fn(async () => unavailableSnapshot));
    const { wrapper } = makeBundle(port);

    const { result } = renderHook(() => useFeeOracle("btc-mainnet"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isUnavailable).toBe(true);
    expect(result.current.isStale).toBe(false);
    expect(result.current.asOf).toBeNull();
  });

  it("useFeeOracle returns isStale=true when port returns source=stale", async () => {
    const staleSnapshot: LiveRatesWithMeta = {
      rates: { slow: 2, medium: 4, fast: 8 },
      source: "stale",
      asOf: 1715190000000,
    };
    const port = makeFeeOraclePort(jest.fn(async () => staleSnapshot));
    const { wrapper } = makeBundle(port);

    const { result } = renderHook(() => useFeeOracle("btc-mainnet"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.data).toEqual({ slow: 2, medium: 4, fast: 8 });
    expect(result.current.isUnavailable).toBe(false);
    expect(result.current.asOf).toBe(1715190000000);
  });

  it("useFeeOracle queryKey is ['fee-oracle', networkId] with staleTime 30_000ms", async () => {
    const port = makeFeeOraclePort(
      jest.fn(async () => ({
        rates: { slow: 1, medium: 3, fast: 6 },
        source: "live" as const,
        asOf: 1,
      })),
    );
    const { wrapper, queryCache } = makeBundle(port);

    const { result } = renderHook(() => useFeeOracle("prl-testnet"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const entries = queryCache.findAll({
      queryKey: ["fee-oracle", "prl-testnet"],
    });
    expect(entries).toHaveLength(1);
    // Cache key isolation: a different networkId would produce a separate
    // cache entry. We assert the literal queryKey shape here.
    expect(entries[0].queryKey).toEqual(["fee-oracle", "prl-testnet"]);
    // staleTime is configured on the query options — TanStack stores it on
    // the `options.staleTime` of each cache entry.
    expect(entries[0].options.staleTime).toBe(30_000);
  });
});
