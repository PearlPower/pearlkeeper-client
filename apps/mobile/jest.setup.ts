import React from "react";

// env.ts now throws if EXPO_PUBLIC_BACKEND_BASE_URL is unset (no
// production URL fallback in source). Tests must set the env var before any
// module that imports env.ts loads. We do it at top-of-setup so it is in place
// before any test file's module imports run.
process.env.EXPO_PUBLIC_BACKEND_BASE_URL = "https://test.example.com";

// Production `BLOCKCHAINS` (built from blockchains.json) filters out chains
// and networks with `enabled: false` — currently `bitcoin` (chain) and
// `prl-testnet` (network). Many mobile tests hardcode `btc-mainnet` /
// `btc-testnet` (and screens like WalletList snapshot BLOCKCHAINS at
// render-time), so we splice the test fixture into the exported
// `BLOCKCHAINS` array in place. That mutates the same reference every
// consumer holds, including resolveNetworkContext's and getNetworkMetadata's
// activeBlockchains seams (both initialized to BLOCKCHAINS).
import type { BlockchainConfig } from "@prl-wallet/config";
import { BLOCKCHAINS } from "@prl-wallet/config";
import testBlockchains from "@prl-wallet/config/blockchains.test.json";

BLOCKCHAINS.splice(
  0,
  BLOCKCHAINS.length,
  ...(testBlockchains.blockchains as unknown as BlockchainConfig[]),
);

jest.mock("@react-navigation/native", () => {
  const createNavigation = () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    popToTop: jest.fn(),
  });

  return {
    useNavigation: createNavigation,
    useRoute: () => ({ params: {} }),
    useFocusEffect: jest.fn(),
    CommonActions: {
      reset: jest.fn((payload) => payload),
    },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaConsumer: ({
    children,
  }: {
    children: (insets: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }) => React.ReactNode;
  }) => children({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 0, height: 0 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  },
}));
