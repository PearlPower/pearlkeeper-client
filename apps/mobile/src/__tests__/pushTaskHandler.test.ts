// apps/mobile/src/__tests__/pushTaskHandler.test.ts
// flips RED stubs GREEN.
//
// Locked TaskManager handler contract under test:
// Locked title + body strings per event type ( / UI-SPEC)
// walletId dereference via walletListStore lookup ()
// Silent drop when walletId unknown ( paragraph 4)
// Silent drop on unknown 'type' value (defense)
// Notifications.scheduleNotificationAsync({trigger: null}) for immediate render

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(async () => "notification-id"),
}));

const TEST_WALLET_ID = "abc-123";
const UNKNOWN_WALLET_ID = "deleted-wallet-uuid";

jest.mock("../store/walletListStore", () => ({
  __esModule: true,
  useWalletListStore: {
    getState: jest.fn(() => ({
      wallets: [
        {
          id: TEST_WALLET_ID,
          name: "My Wallet",
          networkId: "btc-mainnet",
          createdAt: 0,
          nextReceiveAddress: "bc1qexample",
        },
      ],
    })),
  },
}));

import * as Notifications from "expo-notifications";
import { handlePushDataPayload } from "../lib/pushTaskHandler";

const scheduleMock = Notifications.scheduleNotificationAsync as jest.Mock;

describe("pushTaskHandler (, , )", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("TaskManager handler renders LOCKED 'Incoming transaction' title + \"New activity in '{walletName}'\" body for incoming-tx", async () => {
    const ok = await handlePushDataPayload({
      type: "incoming-tx",
      walletId: TEST_WALLET_ID,
    });
    expect(ok).toBe(true);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const arg = scheduleMock.mock.calls[0]![0]!;
    expect(arg.content.title).toBe("Incoming transaction");
    expect(arg.content.body).toBe("New activity in 'My Wallet'");
    expect(arg.trigger).toBeNull();
  });

  it("TaskManager handler renders LOCKED 'Security alert' title + 'Your wallet was accessed from a new location.' body for security-event", async () => {
    const ok = await handlePushDataPayload({
      type: "security-event",
      walletId: TEST_WALLET_ID,
    });
    expect(ok).toBe(true);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const arg = scheduleMock.mock.calls[0]![0]!;
    expect(arg.content.title).toBe("Security alert");
    expect(arg.content.body).toBe(
      "Your wallet was accessed from a new location.",
    );
    expect(arg.trigger).toBeNull();
  });

  it("TaskManager handler renders LOCKED 'Update available' title + 'A new version of Pearl Keeper is available.' body for version-update", async () => {
    const ok = await handlePushDataPayload({
      type: "version-update",
      walletId: TEST_WALLET_ID,
    });
    expect(ok).toBe(true);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const arg = scheduleMock.mock.calls[0]![0]!;
    expect(arg.content.title).toBe("Update available");
    expect(arg.content.body).toBe(
      "A new version of Pearl Keeper is available.",
    );
    expect(arg.trigger).toBeNull();
  });

  it("TaskManager handler dereferences walletId via walletListStore lookup", async () => {
    // The body for incoming-tx interpolates `walletName` from walletListStore.
    await handlePushDataPayload({
      type: "incoming-tx",
      walletId: TEST_WALLET_ID,
    });
    const arg = scheduleMock.mock.calls[0]![0]!;
    expect(arg.content.body).toContain("My Wallet");
  });

  it("TaskManager handler drops local notification SILENTLY when walletId is unknown locally ( paragraph 4)", async () => {
    const ok = await handlePushDataPayload({
      type: "incoming-tx",
      walletId: UNKNOWN_WALLET_ID,
    });
    expect(ok).toBe(false);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("TaskManager handler ignores unknown 'type' value (defense — drops silently)", async () => {
    const ok = await handlePushDataPayload({
      type: "fake-event",
      walletId: TEST_WALLET_ID,
    });
    expect(ok).toBe(false);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("TaskManager handler calls Notifications.scheduleNotificationAsync with trigger: null (immediate render)", async () => {
    await handlePushDataPayload({
      type: "incoming-tx",
      walletId: TEST_WALLET_ID,
    });
    const arg = scheduleMock.mock.calls[0]![0]!;
    expect(arg.trigger).toBeNull();
  });
});
