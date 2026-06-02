import type { PropsWithChildren } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createHookWrapper() {
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

  return function HookWrapper({ children }: PropsWithChildren) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}
