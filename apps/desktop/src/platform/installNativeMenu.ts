// apps/desktop/src/platform/installNativeMenu.ts
//
// .. — native OS menu install. React-side build via
// @tauri-apps/api/menu; called once from main.tsx::installPostRenderLocks
// after the AdaptersBundle is built. Action handlers close over the bundle —
// same closure pattern as lockOnClose.ts and idleLock.ts.
//
// W-2 (CHECKER): platform-branched menu shape per UI-SPEC.
// macOS : App submenu (About/Settings/Lock/Quit); File only has CloseWindow.
// Win/Lin: No App submenu; File hosts New-Wallet/Settings/Lock/Close/Quit.
// W-3 (CHECKER): View submenu DROPPED everywhere — empty submenus render
// unpredictably across OSes; deferred until v1.4 — see backlog .
// W-1 (CHECKER): subscribers notified after the async install resolves so
// MenuController can mount via useSyncExternalStore without racing the
// first paint.
//
// Edit submenu (RESEARCH §Pitfall 2 / Assumption A1): macOS requires Edit
// for Cmd+A text-select to work in the webview. We add it on every platform.
//
// Cmd+C is a CUSTOM MenuItem (NOT PredefinedMenuItem('Copy')) so we can
// branch on window.getSelection() per + .
//
// PLATFORM DETECTION DEVIATION (Rule 3 — blocking issue):
// The plan cites `import { platform } from "@tauri-apps/api/os"`, but the
// installed `@tauri-apps/api ^2.10.0` does NOT ship an `os` module — that
// API moved to a separate `@tauri-apps/plugin-os` package in Tauri v2. To
// avoid adding a new runtime dependency for a single-call macOS check, we
// detect the platform from `navigator.userAgent`, which is reliably set
// inside Tauri's WebView (WebKit on macOS, WebView2 on Windows, WebKitGTK
// on Linux). Behavioral contract (W-2: branch on macOS) is preserved.

import {
  Menu,
  Submenu,
  MenuItem,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import { toast } from "sonner";
import type { AdaptersBundle } from "@prl-wallet/app-adapters";

export interface InstalledMenu {
  menu: Menu;
  items: {
    settings: MenuItem;
    lock: MenuItem;
    newWallet: MenuItem;
    copy: MenuItem;
  };
}

export type NavigateFn = (path: string) => void;
export type GetCurrentRouteFn = () => string;

// ---- W-1: subscriber set + module-scope ref ----
//
// MenuController consumes the InstalledMenu via React's useSyncExternalStore:
// const menu = useSyncExternalStore(subscribeMenu, getInstalledMenu, () => null);
// When installNativeMenu's async builder resolves, we (a) assign the result
// to installedMenu and (b) notify every subscriber so React re-renders.
const subscribers = new Set<() => void>();
let installedMenu: InstalledMenu | null = null;

export function getInstalledMenu(): InstalledMenu | null {
  return installedMenu;
}

export function subscribeMenu(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/**
 * Test-only escape hatch: resets the module-scope `installedMenu` ref so
 * each test starts from null. Production code never imports this.
 */
export function __resetInstalledMenuForTests(): void {
  installedMenu = null;
}

/**
 * macOS detection from navigator.userAgent. Reliable inside Tauri WebView:
 * macOS WebKit UA contains "Macintosh" or "Mac OS X".
 * Windows / Linux UAs do not.
 */
function isMacPlatform(): boolean {
  const ua = (navigator?.userAgent ?? "").toLowerCase();
  return ua.includes("macintosh") || ua.includes("mac os x");
}

/**
 * Selection-aware Cmd+C handler. Exported separately so it is unit-testable.
 *
 * Branching:
 * window.getSelection() non-empty -> write the selection to clipboard
 * empty selection on /wallet/:id -> write the active wallet's next
 * receive address to clipboard
 * empty selection elsewhere -> no-op (defensive)
 *
 * Visual confirmation: sonner toast "Copied!" (1500ms) on either success
 * path. RESEARCH §OQ3 RESOLVED: toast is the chosen channel for both click
 * and Cmd+C — the icon-only CopyButton in 's surfaces also emits
 * this same toast so the visual is uniform across both interaction paths.
 */
export async function handleCopyShortcut(
  bundle: AdaptersBundle,
  getCurrentRoute: GetCurrentRouteFn,
): Promise<void> {
  try {
    const selection = window.getSelection?.()?.toString() ?? "";
    if (selection.length > 0) {
      await bundle.ports.clipboard.setString(selection);
      toast("Copied!", { duration: 1500 });
      return;
    }
    const route = getCurrentRoute();
    const match = route.match(/^\/wallet\/([^/]+)$/);
    if (!match) return;
    const walletId = match[1];
    if (walletId === "new" || walletId === "import") return;
    const wallet = bundle.stores.walletList
      .getState()
      .wallets.find((w) => w.id === walletId);
    if (!wallet?.nextReceiveAddress) return;
    await bundle.ports.clipboard.setString(wallet.nextReceiveAddress);
    toast("Copied!", { duration: 1500 });
  } catch {
    // Defensive — clipboard write failure must never crash the menu callback
    // (mirrors lockOnClose.ts T-20-12 / installLockClear.ts T-22-08 posture).
  }
}

export async function installNativeMenu(
  bundle: AdaptersBundle,
  navigate: NavigateFn,
  getCurrentRoute: GetCurrentRouteFn,
): Promise<InstalledMenu> {
  // W-2: detect platform once per install.
  const isMac = isMacPlatform();

  // -- Custom items shared across platforms --
  const settings = await MenuItem.new({
    id: "settings",
    text: "Settings…",
    accelerator: "CmdOrCtrl+,",
    action: () => {
      try {
        navigate("/settings");
      } catch {
        // Defensive (Pattern S-6).
      }
    },
  });

  const lock = await MenuItem.new({
    id: "lock",
    text: "Lock",
    accelerator: "CmdOrCtrl+L",
    action: () => {
      try {
        bundle.stores.lock.getState().lock();
      } catch {
        // Defensive — same posture as lockOnClose.ts T-20-12.
      }
    },
  });

  const newWallet = await MenuItem.new({
    id: "new-wallet",
    text: "New Wallet",
    accelerator: "CmdOrCtrl+N",
    action: () => {
      try {
        navigate("/wallet/new");
      } catch {
        // Defensive.
      }
    },
  });

  // Cmd+C — selection-aware ( + ). NOT PredefinedMenuItem('Copy').
  const copy = await MenuItem.new({
    id: "copy",
    text: "Copy",
    accelerator: "CmdOrCtrl+C",
    action: () => {
      void handleCopyShortcut(bundle, getCurrentRoute);
    },
  });

  // -- Edit submenu (every platform, RESEARCH §Pitfall 2) --
  // NOTE: we DO NOT add a predefined Copy here (would conflict with custom Cmd+C accelerator).
  const editSubmenu = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ],
  });

  // -- Help submenu (every platform) --
  // RESEARCH OQ-resolved: a single About-style entry; richer About dialog deferred.
  const helpSubmenu = await Submenu.new({
    text: "Help",
    items: [
      await PredefinedMenuItem.new({
        item: { About: { name: "Pearl Keeper" } },
      }),
    ],
  });

  // View submenu deferred until v1.4 — see backlog (W-3 fix).

  // -- Platform-branched top-level menu --
  let topLevelItems: Submenu[];
  if (isMac) {
    // macOS App submenu (first in items[]) per Apple HIG.
    const appSubmenu = await Submenu.new({
      text: "Pearl Keeper", // ignored on macOS; first submenu becomes App menu
      items: [
        await PredefinedMenuItem.new({
          item: { About: { name: "Pearl Keeper" } },
        }),
        await PredefinedMenuItem.new({ item: "Separator" }),
        settings,
        lock,
        await PredefinedMenuItem.new({ item: "Separator" }),
        await PredefinedMenuItem.new({ item: "Quit" }),
      ],
    });

    const fileSubmenu = await Submenu.new({
      text: "File",
      items: [await PredefinedMenuItem.new({ item: "CloseWindow" })],
    });

    const walletSubmenu = await Submenu.new({
      text: "Wallet",
      items: [newWallet, copy],
    });

    topLevelItems = [
      appSubmenu,
      fileSubmenu,
      editSubmenu,
      walletSubmenu,
      helpSubmenu,
    ];
  } else {
    // Windows / Linux: no App submenu. File hosts the app-level items.
    const fileSubmenu = await Submenu.new({
      text: "File",
      items: [
        newWallet,
        await PredefinedMenuItem.new({ item: "Separator" }),
        settings,
        lock,
        await PredefinedMenuItem.new({ item: "Separator" }),
        await PredefinedMenuItem.new({ item: "CloseWindow" }),
        await PredefinedMenuItem.new({ item: "Quit" }),
      ],
    });

    // Wallet submenu on Windows/Linux: hosts Copy only (since New Wallet is already in File).
    // Note: a single-item submenu is acceptable; W-3 only forbids EMPTY submenus.
    const walletSubmenu = await Submenu.new({
      text: "Wallet",
      items: [copy],
    });

    topLevelItems = [fileSubmenu, editSubmenu, walletSubmenu, helpSubmenu];
  }

  const menu = await Menu.new({ items: topLevelItems });
  await menu.setAsAppMenu();

  const result: InstalledMenu = {
    menu,
    items: { settings, lock, newWallet, copy },
  };

  // W-1: publish + notify subscribers so MenuController re-renders.
  installedMenu = result;
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // Defensive — a bad subscriber callback must not stop notification of others.
    }
  });

  return result;
}
