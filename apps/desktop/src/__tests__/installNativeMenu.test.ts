// apps/desktop/src/__tests__/installNativeMenu.test.ts
//
// Task 1 — installNativeMenu platform-branching + W-1 subscriber
// notification tests.
//
// Test A (W-2 macOS branch): App submenu first, File submenu = CloseWindow only
// Test B (W-2 Windows branch): No App submenu; File hosts New-Wallet/Settings/Lock/Close/Quit
// Test C (W-3): No "View" submenu on either platform
// Test D (W-1): subscribeMenu callback fires after async install resolves;
// getInstalledMenu() returns null before, non-null after
//
// Mocking strategy: capture every Menu/Submenu/MenuItem/PredefinedMenuItem .new() call
// so we can introspect the constructed tree without touching real Tauri IPC.

import { describe, it, expect, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------------
// Mocks (must be hoisted before installNativeMenu import)
// -----------------------------------------------------------------------------

// Platform detection — installNativeMenu reads navigator.userAgent (since
// @tauri-apps/api v2 dropped the `os` module). Tests stub it per branch.

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

interface CapturedMenuArgs {
  items: unknown[];
}
interface CapturedSubmenuArgs {
  text: string;
  items: unknown[];
}
interface CapturedMenuItemArgs {
  id?: string;
  text: string;
  accelerator?: string;
  action?: (id: string) => void;
}

interface MenuCaptured {
  menus: CapturedMenuArgs[];
  submenus: CapturedSubmenuArgs[];
  menuItems: CapturedMenuItemArgs[];
  predefined: { item: unknown }[];
}

vi.mock("@tauri-apps/api/menu", () => {
  const captured: MenuCaptured = {
    menus: [],
    submenus: [],
    menuItems: [],
    predefined: [],
  };
  return {
    __captured: captured,
    Menu: {
      new: vi.fn(async (args: CapturedMenuArgs) => {
        captured.menus.push(args);
        return {
          _kind: "menu",
          items: args.items,
          setAsAppMenu: vi.fn().mockResolvedValue(null),
        };
      }),
    },
    Submenu: {
      new: vi.fn(async (args: CapturedSubmenuArgs) => {
        captured.submenus.push(args);
        return {
          _kind: "submenu",
          text: args.text,
          items: args.items,
        };
      }),
    },
    MenuItem: {
      new: vi.fn(async (args: CapturedMenuItemArgs) => {
        captured.menuItems.push(args);
        return {
          _kind: "item",
          id: args.id,
          text: args.text,
          accelerator: args.accelerator,
          setEnabled: vi.fn().mockResolvedValue(undefined),
        };
      }),
    },
    PredefinedMenuItem: {
      new: vi.fn(async (args: { item: unknown }) => {
        captured.predefined.push(args);
        return { _kind: "predefined", item: args.item };
      }),
    },
  };
});

import * as MenuMod from "@tauri-apps/api/menu";

import {
  installNativeMenu,
  subscribeMenu,
  getInstalledMenu,
  __resetInstalledMenuForTests,
} from "@/platform/installNativeMenu";
import { buildTestBundle } from "./_harness/factories";

interface CapturedAccess {
  __captured: MenuCaptured;
}

function getCaptured(): MenuCaptured {
  return (MenuMod as unknown as CapturedAccess).__captured;
}

function resetCaptured(): void {
  const c = getCaptured();
  c.menus.length = 0;
  c.submenus.length = 0;
  c.menuItems.length = 0;
  c.predefined.length = 0;
}

function setUserAgent(ua: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const WIN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("installNativeMenu ( W-1/W-2/W-3)", () => {
  beforeEach(() => {
    resetCaptured();
    __resetInstalledMenuForTests();
  });

  it("Test A (W-2 macOS): App submenu present first; File submenu only contains CloseWindow", async () => {
    setUserAgent(MAC_UA);
    const bundle = buildTestBundle();

    await installNativeMenu(bundle, vi.fn(), () => "/");

    const captured = getCaptured();
    expect(captured.menus.length).toBe(1);
    const topItems = captured.menus[0].items as Array<{
      _kind: string;
      text: string;
      items: unknown[];
    }>;

    // First submenu = App submenu (Apple HIG: first submenu becomes the App menu).
    const appSubmenu = topItems[0];
    expect(appSubmenu._kind).toBe("submenu");
    expect(appSubmenu.text).toBe("Pearl Keeper");

    // App submenu MUST contain the Settings + Lock + Quit slots.
    const appItems = appSubmenu.items as Array<{
      _kind?: string;
      id?: string;
      item?: unknown;
    }>;
    const settingsItem = appItems.find(
      (i) => i._kind === "item" && i.id === "settings",
    );
    const lockItem = appItems.find(
      (i) => i._kind === "item" && i.id === "lock",
    );
    expect(settingsItem).toBeDefined();
    expect(lockItem).toBeDefined();
    const hasQuit = appItems.some(
      (i) => i._kind === "predefined" && i.item === "Quit",
    );
    expect(hasQuit).toBe(true);

    // File submenu (second top-level submenu) = ONLY CloseWindow.
    const fileSubmenu = topItems[1];
    expect(fileSubmenu.text).toBe("File");
    const fileItems = fileSubmenu.items as Array<{
      _kind: string;
      item?: unknown;
    }>;
    expect(fileItems.length).toBe(1);
    expect(fileItems[0]._kind).toBe("predefined");
    expect(fileItems[0].item).toBe("CloseWindow");
  });

  it("Test B (W-2 Windows): NO App submenu; File hosts New-Wallet, Settings, Lock, CloseWindow, Quit", async () => {
    setUserAgent(WIN_UA);
    const bundle = buildTestBundle();

    await installNativeMenu(bundle, vi.fn(), () => "/");

    const captured = getCaptured();
    const topItems = captured.menus[0].items as Array<{
      text: string;
      items: unknown[];
    }>;

    // First top-level submenu must be File (no App submenu on Windows).
    expect(topItems[0].text).toBe("File");

    // No submenu at all should have text "Pearl Keeper" on Windows.
    const appLike = captured.submenus.find((s) => s.text === "Pearl Keeper");
    expect(appLike).toBeUndefined();

    // File submenu items contain Settings, Lock, New Wallet (custom), and CloseWindow + Quit (predefined).
    const fileItems = topItems[0].items as Array<{
      _kind: string;
      id?: string;
      item?: unknown;
    }>;
    const customIds = fileItems
      .filter((i) => i._kind === "item")
      .map((i) => i.id);
    expect(customIds).toContain("settings");
    expect(customIds).toContain("lock");
    expect(customIds).toContain("new-wallet");
    const predefinedNames = fileItems
      .filter((i) => i._kind === "predefined")
      .map((i) => i.item);
    expect(predefinedNames).toContain("CloseWindow");
    expect(predefinedNames).toContain("Quit");
  });

  it("Test C (W-3): No 'View' submenu on either platform", async () => {
    // macOS branch
    setUserAgent(MAC_UA);
    const bundle = buildTestBundle();
    await installNativeMenu(bundle, vi.fn(), () => "/");

    let viewSubmenu = getCaptured().submenus.find((s) => s.text === "View");
    expect(viewSubmenu).toBeUndefined();

    // Reset and verify Windows branch too.
    resetCaptured();
    __resetInstalledMenuForTests();
    setUserAgent(WIN_UA);
    await installNativeMenu(bundle, vi.fn(), () => "/");

    viewSubmenu = getCaptured().submenus.find((s) => s.text === "View");
    expect(viewSubmenu).toBeUndefined();
  });

  it("Test D (W-1): subscribeMenu callback fires after async install resolves; getInstalledMenu reflects state transition", async () => {
    setUserAgent(MAC_UA);
    const bundle = buildTestBundle();

    const cb = vi.fn();
    const unsubscribe = subscribeMenu(cb);

    // Pre-install: subscriber NOT yet invoked, getInstalledMenu returns null.
    expect(cb).not.toHaveBeenCalled();
    expect(getInstalledMenu()).toBeNull();

    await installNativeMenu(bundle, vi.fn(), () => "/");

    expect(cb).toHaveBeenCalledTimes(1);
    expect(getInstalledMenu()).not.toBeNull();

    unsubscribe();
  });
});
