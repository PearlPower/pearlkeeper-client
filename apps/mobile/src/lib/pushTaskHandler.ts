// apps/mobile/src/lib/pushTaskHandler.ts — / , , .
//
// Locked copy (UI-SPEC §Mobile local notification copy — NEVER paraphrase):
// incoming-tx title: "Incoming transaction"
// incoming-tx body: "New activity in '{walletName}'"
// security-event title: "Security alert"
// security-event body: "Your wallet was accessed from a new location."
// version-update title: "Update available"
// version-update body: "A new version of Pearl Keeper is available."
//
// Drops local notification SILENTLY when the incoming-tx walletId is unknown
// locally ( paragraph 4 — wallet may have been deleted between push
// fan-out and receipt; do NOT show generic fallback). For security-event +
// version-update the body is literal — walletName is not dereferenced and
// no walletListStore lookup is performed.
//
// Runs OUTSIDE the React tree (TaskManager handler is module-scope on iOS
// per / ). Therefore uses zustand `.getState()` to read
// the wallet list synchronously, NOT a hook subscription.

import * as Notifications from "expo-notifications";
import { useWalletListStore } from "../store/walletListStore";

export type PushType = "incoming-tx" | "security-event" | "version-update";

interface LockedCopy {
  title: string;
  body: (walletName: string) => string;
}

const LOCKED_COPY: Record<PushType, LockedCopy> = {
  "incoming-tx": {
    title: "Incoming transaction",
    body: (walletName) => `New activity in '${walletName}'`,
  },
  "security-event": {
    title: "Security alert",
    body: () => "Your wallet was accessed from a new location.",
  },
  "version-update": {
    title: "Update available",
    body: () => "A new version of Pearl Keeper is available.",
  },
};

export interface PushDataPayload {
  type?: string;
  walletId?: string;
}

/**
 * Render a local notification using the locked copy.
 *
 * Returns `false` (drop) when:
 * payload.type is missing or not a known PushType (defense — silent drop)
 * For incoming-tx: payload.walletId is missing OR walletListStore has
 * no wallet with that id ( paragraph 4)
 *
 * Returns `true` after `Notifications.scheduleNotificationAsync` resolves.
 *
 * For security-event + version-update the wallet lookup is intentionally
 * skipped — the locked body strings are global per and the backend
 * may emit these with a sentinel walletId.
 */
export async function handlePushDataPayload(
  payload: PushDataPayload,
): Promise<boolean> {
  const t = payload.type as PushType | undefined;
  if (!t || !(t in LOCKED_COPY)) return false;

  const copy = LOCKED_COPY[t];
  let walletName = "";

  if (t === "incoming-tx") {
    if (!payload.walletId) return false;
    const wallet = useWalletListStore
      .getState()
      .wallets.find((w) => w.id === payload.walletId);
    if (!wallet) return false; // paragraph 4 — drop silently
    walletName = wallet.name;
  }
  // security-event + version-update: walletName isn't used by the body
  // function (returns a literal string) — pass empty string.

  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body(walletName),
    },
    trigger: null, // immediate (fires from TaskManager body or foreground listener)
  });

  return true;
}
