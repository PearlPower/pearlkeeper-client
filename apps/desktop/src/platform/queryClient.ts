// apps/desktop/src/platform/queryClient.ts
//
// ( + ) — desktop QueryClient defaults.
// retry: skip NetworkOfflineError; standard 3-attempt backoff for everything else.
// refetchOnWindowFocus: false (desktop user explicitly controls refetch).
// refetchOnReconnect: false (same reason).
//
// Mobile QueryClient defaults are NOT changed by this phase.

import { QueryClient } from "@tanstack/react-query";
import { NetworkOfflineError } from "@prl-wallet/api-client";

export function createDesktopQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: (failureCount, error) => {
          // instanceof is the precise check on desktop (no RN serialization);
          // .name is the serialization-safe fallback.
          if (error instanceof NetworkOfflineError) return false;
          if (
            (error as { name?: string } | null)?.name === "NetworkOfflineError"
          )
            return false;
          return failureCount < 3;
        },
      },
    },
  });
}
