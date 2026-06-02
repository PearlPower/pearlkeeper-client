// apps/mobile/src/__tests__/pushTokenRotation.test.tsx
// LOCK acceptance test.
//
// Locked re-registration contract under test:
// addPushTokenListener fires → services.push.registerPush called with new
// token + derived subscriptions + cached prefs
// never-opted-in guard: when getPushPrefs returns {registered: false} AND
// cache is empty, the listener does NOT call registerPush

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { AdaptersProvider } from "@prl-wallet/app-adapters";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";
import type {
  PushRegisterMeResponse,
  PushRegisterRequest,
} from "@prl-wallet/api-schemas";

// Capture the listener callback that the App component registers.
const tokenListeners: Array<
  (info: { data: string; type: string }) => Promise<void> | void
> = [];
const recvListeners: Array<(notification: unknown) => unknown> = [];

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  registerTaskAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "notification-id"),
  addPushTokenListener: jest.fn((cb) => {
    tokenListeners.push(cb);
    return { remove: jest.fn() };
  }),
  addNotificationReceivedListener: jest.fn((cb) => {
    recvListeners.push(cb);
    return { remove: jest.fn() };
  }),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
}));

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
}));

const TEST_WALLET_ID = "11111111-1111-4111-8111-111111111111";

jest.mock("../store/walletListStore", () => ({
  __esModule: true,
  useWalletListStore: {
    getState: jest.fn(() => ({
      wallets: [
        {
          id: TEST_WALLET_ID,
          name: "Rotation Wallet",
          networkId: "btc-mainnet",
          createdAt: 0,
          nextReceiveAddress: "tb1q-rotation-test",
        },
      ],
    })),
  },
}));

// Import PushListenersSetup AFTER mocks. Lives in its own module so this
// test does not pull the entire App + navigation tree ( Rule 3
// deviation — avoids expo-modules-core ESM transform pitfall).
import { PushListenersSetup } from "../lib/pushListenersSetup";

function makePushPort(initial: PushRegisterMeResponse) {
  const registerPush = jest.fn(
    async (_req: PushRegisterRequest) => ({ ok: true as const }),
  );
  const unregisterPush = jest.fn(async () => ({ ok: true as const }));
  const getPushPrefs = jest.fn(async () => initial);
  return { registerPush, unregisterPush, getPushPrefs };
}

function renderListeners(opts: {
  port: ReturnType<typeof makePushPort>;
  seedCache?: PushRegisterMeResponse;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (opts.seedCache) {
    qc.setQueryData(["push-prefs"], opts.seedCache);
  }
  const bundle = {
    ports: {
      clipboard: { setString: async () => undefined },
      sharing: { share: async () => undefined },
      storage: {
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      },
      networkGate: { isOpen: () => true, subscribe: () => () => undefined },
      clock: { now: () => 0 },
    },
    services: { push: opts.port },
    stores: {},
  } as unknown as AdaptersBundle;

  return render(
    <QueryClientProvider client={qc}>
      <AdaptersProvider value={bundle}>
        <PushListenersSetup />
      </AdaptersProvider>
    </QueryClientProvider>,
  );
}

describe("PushListenersSetup token-rotation (LOCK)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenListeners.length = 0;
    recvListeners.length = 0;
  });

  it(" — re-registers via services.push.registerPush when token-rotation listener fires AND cache shows registered: true", async () => {
    const port = makePushPort({
      registered: true,
      prefs: { incomingTx: true, securityEvent: true, versionUpdate: true },
    });
    renderListeners({
      port,
      seedCache: {
        registered: true,
        prefs: { incomingTx: true, securityEvent: true, versionUpdate: true },
      },
    });

    // Capture the listener callback registered by useEffect.
    await waitFor(() => expect(tokenListeners.length).toBeGreaterThan(0));
    const listener = tokenListeners[0]!;

    // Fire the listener with a new token.
    await act(async () => {
      await listener({ data: "fcm-rotated-token", type: "ios" });
    });

    expect(port.registerPush).toHaveBeenCalledTimes(1);
    const body = port.registerPush.mock.calls[0]![0]!;
    expect(body.token).toBe("fcm-rotated-token");
    expect(body.platform).toBe("ios");
    expect(body.prefs).toEqual({
      incomingTx: true,
      securityEvent: true,
      versionUpdate: true,
    });
    expect(body.subscriptions).toEqual([
      {
        networkId: "btc-mainnet",
        address: "tb1q-rotation-test",
        walletId: TEST_WALLET_ID,
      },
    ]);
  });

  it(" NEVER-OPTED-IN GUARD — does NOT call registerPush when cache is empty AND server returns {registered: false}", async () => {
    const port = makePushPort({ registered: false, prefs: null });
    renderListeners({ port }); // no seedCache

    await waitFor(() => expect(tokenListeners.length).toBeGreaterThan(0));
    const listener = tokenListeners[0]!;

    await act(async () => {
      await listener({ data: "fcm-rotated-token", type: "ios" });
    });

    // Server was consulted (cache empty), but registerPush MUST NOT fire.
    expect(port.getPushPrefs).toHaveBeenCalledTimes(1);
    expect(port.registerPush).not.toHaveBeenCalled();
  });
});
