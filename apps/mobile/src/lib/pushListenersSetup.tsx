// apps/mobile/src/lib/pushListenersSetup.tsx
// , .
//
// PushListenersSetup component: token-rotation re-registration listener
// () + Android foreground notification listener ().
//
// Extracted from App.tsx into its own module so unit tests can import it
// without pulling in the entire navigation tree (avoids the
// expo-modules-core ESM transform pitfall in jest CJS — deviation
// Rule 3 auto-fix).
//
// Locked behaviour:
// addPushTokenListener: REAL re-registration via services.push.registerPush
// when cache or server says { registered: true }; never auto-register a
// never-opted-in user.
// addNotificationReceivedListener: Android foreground path; iOS data-only
// payloads route through TaskManager (defined at module scope in App.tsx),
// not this listener.

import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useAdapters } from "@prl-wallet/app-adapters";
import type {
  PushPrefs,
  PushRegisterMeResponse,
  PushSubscription,
} from "@prl-wallet/api-schemas";
import { useWalletListStore } from "../store/walletListStore";
import { handlePushDataPayload } from "./pushTaskHandler";

export function PushListenersSetup(): null {
  const queryClient = useQueryClient();
  const { services } = useAdapters();
  const pushPort = services.push;

  useEffect(() => {
    // token rotation. Expo fires this when FCM/APNs issues a new token.
    const tokenSub = Notifications.addPushTokenListener(async (tokenInfo) => {
      try {
        if (!pushPort) return;
        // Step 1 — read cached prefs.
        const cached = queryClient.getQueryData<PushRegisterMeResponse>([
          "push-prefs",
        ]);

        // Step 2 — guard: never auto-register a never-opted-in user.
        let prefs: PushPrefs;
        if (cached?.registered && cached.prefs) {
          prefs = cached.prefs;
        } else {
          const serverState = await pushPort.getPushPrefs().catch(() => null);
          if (!serverState?.registered || !serverState.prefs) {
            return; // not opted in; do nothing
          }
          prefs = serverState.prefs;
        }

        // Step 3 — derive subscriptions from local Zustand store.
        const wallets = useWalletListStore.getState().wallets;
        const subscriptions: PushSubscription[] = wallets.flatMap((w) => {
          if (!w.nextReceiveAddress) return [];
          return [
            {
              networkId: w.networkId as PushSubscription["networkId"],
              address: w.nextReceiveAddress,
              walletId: w.id,
            },
          ];
        });

        // Defense-in-depth: backend rejects empty subscriptions arrays
        // ( / PushRegisterRequestSchema.subscriptions.min(1)).
        if (subscriptions.length === 0) return;

        // Step 4 — re-register with the new token.
        await pushPort.registerPush({
          token: tokenInfo.data,
          platform: tokenInfo.type as "ios" | "android",
          subscriptions,
          prefs,
        });

        // Step 5 — refresh the TanStack cache.
        queryClient.invalidateQueries({ queryKey: ["push-prefs"] });
      } catch (err) {
        // No UI surface for token-rotation errors — log only. User can
        // retry by toggling master OFF/ON in NotificationsScreen if delivery
        // breaks.
        console.warn("[push-token-rotation] re-register failed", err);
      }
    });

    // Android foreground path — listener fires; iOS data-only payloads route
    // through TaskManager (defined at module scope in App.tsx), not here.
    const recvSub = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const data = notification.request.content.data as {
          type?: string;
          walletId?: string;
        };
        await handlePushDataPayload(data);
      },
    );

    return () => {
      tokenSub.remove();
      recvSub.remove();
    };
  }, [queryClient, pushPort]);

  return null;
}
