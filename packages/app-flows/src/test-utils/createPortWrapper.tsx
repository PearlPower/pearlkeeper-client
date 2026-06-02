import type { PropsWithChildren } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AdaptersProvider,
  type AdaptersBundle,
} from "@prl-wallet/app-adapters";

/**
 * Test wrapper that mounts `<QueryClientProvider>` + `<AdaptersProvider>` for
 * hook tests. Callers pass the full `AdaptersBundle` (ports/services/stores)
 * with fake implementations. Mirrors the mobile-app pattern in
 * `apps/mobile/src/hooks/test-utils/createHookWrapper.tsx`, extending it with
 * AdaptersProvider so ported hooks can read ports via `useAdapters()`.
 */
export function createPortWrapper(bundle: AdaptersBundle) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
      mutations: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });

  return function PortWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AdaptersProvider value={bundle}>{children}</AdaptersProvider>
      </QueryClientProvider>
    );
  };
}
