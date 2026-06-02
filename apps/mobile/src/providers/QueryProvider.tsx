import React, { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import * as Network from "expo-network";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
    },
  },
});

// Wire focusManager to AppState so queries refetch when app returns to foreground
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener(
    "change",
    (state: AppStateStatus) => {
      handleFocus(state === "active");
    },
  );
  return () => subscription.remove();
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Wire onlineManager inside a component so expo-network native module is
  // fully initialised before we call addNetworkStateListener.
  // Also seed the initial state with getNetworkStateAsync to avoid the race
  // where the listener fires false before native networking is ready.
  useEffect(() => {
    Network.getNetworkStateAsync()
      .then((state) => {
        onlineManager.setOnline(state.isConnected ?? true);
      })
      .catch(() => {
        onlineManager.setOnline(true);
      });

    const subscription = Network.addNetworkStateListener((state) => {
      onlineManager.setOnline(state.isConnected ?? true);
    });

    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
