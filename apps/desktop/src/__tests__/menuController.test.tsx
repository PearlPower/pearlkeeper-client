// apps/desktop/src/__tests__/menuController.test.tsx
//
// Task 2 — truth-table tests for MenuController.
//
// MenuController is a side-effect-only React component: it subscribes to
// lockStore.isLocked, pinStore.hasPIN, walletList.wallets.length, and
// useLocation(), and on every change calls item.setEnabled(...) per the
// truth table.
//
// Tests build a fake InstalledMenu whose item refs have vi.fn() setEnabled
// mocks, mount MenuController under various store states + routes, and
// assert the setEnabled call values that the most recent useEffect run made.
//
// Truth table (UI-SPEC §Interaction Contract → Native Menu ):
//
// | Item | Always | Locked | First-launch | On wizard | At /wallet/:id |
// | Settings… | enabled| disabled| disabled | enabled | enabled |
// | Lock | enabled| disabled| disabled | enabled | enabled |
// | New Wallet | enabled| disabled| disabled | disabled | enabled |
// | Copy |disabled| disabled| disabled | disabled | enabled (no sel)|

import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "@testing-library/react";

import { MenuController } from "@/components/MenuController";
import type { InstalledMenu } from "@/platform/installNativeMenu";
import { renderUnderHarness } from "./_harness/TestHarness";
import { seedWallet } from "./_harness/factories";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface FakeItem {
  setEnabled: ReturnType<typeof vi.fn>;
}
interface FakeInstalledMenu {
  menu: unknown;
  items: {
    settings: FakeItem;
    lock: FakeItem;
    newWallet: FakeItem;
    copy: FakeItem;
  };
}

function buildFakeInstalled(): FakeInstalledMenu {
  return {
    menu: {} as unknown,
    items: {
      settings: { setEnabled: vi.fn().mockResolvedValue(undefined) },
      lock: { setEnabled: vi.fn().mockResolvedValue(undefined) },
      newWallet: { setEnabled: vi.fn().mockResolvedValue(undefined) },
      copy: { setEnabled: vi.fn().mockResolvedValue(undefined) },
    },
  };
}

/**
 * Returns the most recent boolean argument that the given setEnabled mock
 * was called with. Throws if the mock was never called.
 */
function lastCall(mock: ReturnType<typeof vi.fn>): boolean {
  if (mock.mock.calls.length === 0) {
    throw new Error("setEnabled was never called");
  }
  const args = mock.mock.calls[mock.mock.calls.length - 1];
  return args[0] as boolean;
}

function mountWithRoute(opts: {
  installed: FakeInstalledMenu;
  initialPath: string;
  hasPIN: boolean;
  walletCount: number;
  isLocked?: boolean;
}) {
  return renderUnderHarness({
    routes: [
      {
        path: "*",
        element: (
          <MenuController installed={opts.installed as unknown as InstalledMenu} />
        ),
      },
    ],
    initialEntries: [opts.initialPath],
    prepopulate: (b) => {
      if (opts.hasPIN) {
        b.stores.pin.getState().setHasPIN(true);
      }
      for (let i = 0; i < opts.walletCount; i++) {
        b.stores.walletList.getState().addWallet(
          seedWallet({ id: `w${i + 1}` }),
        );
      }
      // lockStore boots with isLocked: true (anti-flash guard, lockStore.ts:53).
      // Tests that want the unlocked tree must explicitly unlock.
      if (opts.isLocked) {
        b.stores.lock.getState().lock();
      } else {
        b.stores.lock.getState().unlock();
      }
    },
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("MenuController ( truth table)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test A: first-launch tree (no wallet OR no PIN) -> all 4 items disabled", () => {
    const installed = buildFakeInstalled();
    mountWithRoute({
      installed,
      initialPath: "/",
      hasPIN: false,
      walletCount: 0,
    });

    expect(lastCall(installed.items.settings.setEnabled)).toBe(false);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(false);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(false);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(false);
  });

  it("Test B: locked tree -> all 4 items disabled", () => {
    const installed = buildFakeInstalled();
    mountWithRoute({
      installed,
      initialPath: "/pin/unlock",
      hasPIN: true,
      walletCount: 1,
      isLocked: true,
    });

    expect(lastCall(installed.items.settings.setEnabled)).toBe(false);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(false);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(false);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(false);
  });

  it("Test C: unlocked at /wallets -> settings/lock/newWallet enabled, copy disabled", () => {
    const installed = buildFakeInstalled();
    mountWithRoute({
      installed,
      initialPath: "/wallets",
      hasPIN: true,
      walletCount: 1,
    });

    expect(lastCall(installed.items.settings.setEnabled)).toBe(true);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(true);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(true);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(false);
  });

  it("Test D: unlocked at /wallet/:id -> all 4 items enabled", () => {
    const installed = buildFakeInstalled();
    mountWithRoute({
      installed,
      initialPath: "/wallet/w1",
      hasPIN: true,
      walletCount: 1,
    });

    expect(lastCall(installed.items.settings.setEnabled)).toBe(true);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(true);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(true);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(true);
  });

  it("Test E: unlocked at /wallet/new -> newWallet disabled (in wizard), copy disabled (not on /wallet/:id)", () => {
    const installed = buildFakeInstalled();
    mountWithRoute({
      installed,
      initialPath: "/wallet/new",
      hasPIN: true,
      walletCount: 1,
    });

    expect(lastCall(installed.items.settings.setEnabled)).toBe(true);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(true);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(false);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(false);
  });

  it("Test F: unlocked at /wallet/import/mnemonic -> same disable shape as Test E", () => {
    const installed = buildFakeInstalled();
    mountWithRoute({
      installed,
      initialPath: "/wallet/import/mnemonic",
      hasPIN: true,
      walletCount: 1,
    });

    expect(lastCall(installed.items.settings.setEnabled)).toBe(true);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(true);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(false);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(false);
  });

  it("Test G: unlocked at /wallet/:id/send/address -> copy disabled (only enabled at exact /wallet/:id)", () => {
    const installed = buildFakeInstalled();
    mountWithRoute({
      installed,
      initialPath: "/wallet/w1/send/address",
      hasPIN: true,
      walletCount: 1,
    });

    // Settings/lock still enabled; new-wallet enabled (not in wizard route);
    // copy disabled because path is not exactly /wallet/:id.
    expect(lastCall(installed.items.settings.setEnabled)).toBe(true);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(true);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(true);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(false);
  });

  it("Test H: state change re-fires setEnabled (unlock -> lock transition)", () => {
    const installed = buildFakeInstalled();
    const { bundle } = mountWithRoute({
      installed,
      initialPath: "/wallets",
      hasPIN: true,
      walletCount: 1,
    });

    // Initial: settings/lock/newWallet enabled.
    expect(lastCall(installed.items.settings.setEnabled)).toBe(true);

    // Snapshot the call counts so we can verify the next mutation produced new calls.
    const settingsCallsBefore = installed.items.settings.setEnabled.mock.calls.length;

    act(() => {
      bundle.stores.lock.getState().lock();
    });

    // After lock: every item disabled.
    expect(installed.items.settings.setEnabled.mock.calls.length).toBeGreaterThan(
      settingsCallsBefore,
    );
    expect(lastCall(installed.items.settings.setEnabled)).toBe(false);
    expect(lastCall(installed.items.lock.setEnabled)).toBe(false);
    expect(lastCall(installed.items.newWallet.setEnabled)).toBe(false);
    expect(lastCall(installed.items.copy.setEnabled)).toBe(false);
  });

  it("Test I: defensive — setEnabled rejection does NOT crash subsequent mutations", () => {
    const installed = buildFakeInstalled();
    // First call rejects; subsequent calls resolve.
    installed.items.settings.setEnabled
      .mockRejectedValueOnce(new Error("ipc fail"))
      .mockResolvedValue(undefined);

    const { bundle } = mountWithRoute({
      installed,
      initialPath: "/wallets",
      hasPIN: true,
      walletCount: 1,
    });

    // Mutate to trigger another effect run; if the previous rejection had
    // crashed the controller, this call would never happen.
    act(() => {
      bundle.stores.lock.getState().lock();
    });

    expect(installed.items.settings.setEnabled.mock.calls.length).toBeGreaterThan(1);
    // Last call should reflect the locked state.
    expect(lastCall(installed.items.settings.setEnabled)).toBe(false);
  });
});
