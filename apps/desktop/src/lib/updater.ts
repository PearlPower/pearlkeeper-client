// apps/desktop/src/lib/updater.ts
// .., .. — Tauri auto-updater wrapper.
//
// Public surface:
// checkForUpdate(): probe the configured manifest endpoint; return idle
// when no update; return available + cached `Update` handle otherwise.
// installAndRestart({ onProgress, desktopUpdateEndpoint }): call the
// plugin's downloadAndInstall, then relaunch. On error: map to
// locked-copy dialog (read-only fs / verification failure / generic).
// mapInstallError(err, desktopUpdateEndpoint): exported for unit tests
// and for callers that want to surface the dialog without retrying.
//
// Locked dialog copy from UI-SPEC §Tauri-plugin-dialog * messages.

import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { message } from "@tauri-apps/plugin-dialog";

export type UpdaterState =
  | { kind: "idle" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; percent: number }
  | { kind: "ready" };

let cachedUpdate: Update | null = null;

/**
 * , — probe the configured updater endpoint.
 *
 * Returns `idle` when no update is available OR the check fails (a failing
 * check should not surface to the user; it's a quiet no-op so the indicator
 * simply stays hidden). Use mapInstallError() to surface explicit dialogs.
 */
export async function checkForUpdate(): Promise<UpdaterState> {
  try {
    const update = await check();
    if (!update?.available) {
      cachedUpdate = null;
      return { kind: "idle" };
    }
    cachedUpdate = update;
    return { kind: "available", update };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[updater] check failed:", e);
    return { kind: "idle" };
  }
}

/**
 * , — download + install + relaunch flow. On any error throws after
 * surfacing a locked-copy dialog via mapInstallError().
 */
export async function installAndRestart(opts: {
  onProgress?: (percent: number) => void;
  desktopUpdateEndpoint?: string;
}): Promise<{ outcome: "installed" }> {
  if (!cachedUpdate) {
    throw new Error("[updater] no cached update — call checkForUpdate first");
  }
  try {
    let total = 0;
    let downloaded = 0;
    await cachedUpdate.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
      } else if (event.event === "Progress" && total > 0) {
        downloaded += event.data.chunkLength;
        opts.onProgress?.(Math.floor((downloaded / total) * 100));
      }
    });
    await relaunch();
    return { outcome: "installed" };
  } catch (err) {
    await mapInstallError(err, opts.desktopUpdateEndpoint);
    throw err;
  }
}

/**
 * , — translate plugin error into a locked-copy dialog message.
 * Three branches:
 * read-only / EROFS / Permission denied → AppImage relocation dialog.
 * signature / verification / invalid signer → verification-failed dialog.
 * default → generic install-error dialog (still actionable).
 */
export async function mapInstallError(
  err: unknown,
  desktopUpdateEndpoint?: string
): Promise<void> {
  const msg = String((err as Error)?.message ?? err);
  const downloadHint = desktopUpdateEndpoint
    ? ` from ${desktopUpdateEndpoint}`
    : "";
  if (/read-only|EROFS|Permission denied/i.test(msg)) {
    await message(
      `Update couldn't be installed automatically because the current AppImage location is read-only.\nPlease move Pearl Keeper to ~/.local/bin and re-run, or download the latest version manually${downloadHint}.`,
      { title: "Update couldn't install", kind: "error" }
    );
    return;
  }
  if (/signature|verification|invalid signer/i.test(msg)) {
    await message(
      `Update verification failed — please retry or update manually${downloadHint}.`,
      { title: "Update verification failed", kind: "error" }
    );
    return;
  }
  await message(`Update couldn't be installed: ${msg}`, {
    title: "Update error",
    kind: "error",
  });
}

/**
 * Test-only — clears the cached Update reference between tests so each test
 * starts from a known idle state.
 */
export function __resetForTests(): void {
  cachedUpdate = null;
}
