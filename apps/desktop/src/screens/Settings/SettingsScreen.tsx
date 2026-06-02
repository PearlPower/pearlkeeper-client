// apps/desktop/src/screens/Settings/SettingsScreen.tsx
//
// () — original Change PIN-only Settings.
// ( /12, ) — adds auto-lock + theme Cards.
//
// Locked copy (UI-SPEC §Copywriting Contract — NEVER paraphrase):
// "Settings" / "Change PIN" / "Auto-lock" / "Theme" /
// "1 minute" / "5 minutes" / "15 minutes" / "30 minutes" / "60 minutes" / "Never" /
// "Wallet stays unlocked indefinitely — not recommended for wallets holding funds."
// (em-dash, U+2014 — NOT a hyphen) /
// "System" / "Light" / "Dark"
//
// Layout (UI-SPEC §Settings Screen Layout):
// Container `max-w-2xl mx-auto px-6 py-8` (preserved from ).
// Cards stacked with `gap-4`:
// 1. Change PIN (preserved verbatim; Card p-0 + inner button p-6)
// 2. Auto-lock (Select + conditional destructive Alert)
// 3. Theme (RadioGroup with System / Light / Dark)
// 4. Notifications (informational; )
// 5. Privacy & analytics (master Switch + grant/revoke AlertDialogs;
// / UI-SPEC §10)
//
// Bindings:
// Auto-lock Select ↔ lockStore.idleTimeoutMs / setIdleTimeoutMs
// (number | null where null === "Never")
// Theme RadioGroup ↔ next-themes useTheme/setTheme ( )
//
// Helper invariants (locked):
// msToValue(900_000) → "15" ( default; matches IDLE_LOCK_MS)
// msToValue(null) → "never"
// valueToMs("never") → null
// valueToMs("5") → 300_000
//
// (, ) — adds informational Notifications card.
//
// Locked copy (UI-SPEC §Copywriting Contract — NEVER paraphrase):
// Notifications card title: "Notifications"
// Notifications card helper: "Push notifications are mobile-only at this time."
//
// Per CONTEXT : desktop is informational-only; no interactive controls
// in this card. The muted-foreground helper colour is the only "disabled"
// cue needed (no `disabled` HTML attribute, no `aria-disabled`).
//
// Privacy & analytics card section added.
//
// Locked copy (UI-SPEC §5 — NEVER paraphrase; single source
// `packages/api-client/src/analytics/copy.ts` consumed via `@prl-wallet/api-client`):
// Card title: ANALYTICS_COPY.settingsRowLabel
// Card body: ANALYTICS_COPY.body
// Disclosure heading: ANALYTICS_COPY.disclosureHeading
// 8 bullets: ANALYTICS_COPY.bullet1 .. bullet8
// Switch label: ANALYTICS_COPY.switchLabel
// Grant modal title: ANALYTICS_COPY.modalGrantTitle
// Grant modal body: ANALYTICS_COPY.modalGrantBody
// Grant modal actions: ANALYTICS_COPY.modalGrantAccept / modalGrantCancel
// Revoke confirm title: ANALYTICS_COPY.modalRevokeTitle
// Revoke confirm actions: ANALYTICS_COPY.modalRevokeConfirm / modalRevokeCancel
//
// UI-SPEC §12 placement reconciliation: specifies "BELOW Notifications
// + ABOVE Theme" but the existing file order is Change PIN → Auto-lock →
// Theme → Notifications. The privacy card lands AFTER Notifications (last
// position), grouping the two privacy-adjacent surfaces together rather
// than re-ordering Theme/Notifications.
//
// UI-SPEC §4 + Dim 3: revoke action is NOT styled destructive — toggling
// off is reversible (toggle on again at any time). The default Button
// variant resolves to `--primary` accent (matches mobile's accent-blue
// "Confirm" button).

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useStore } from "zustand";
import { useTheme } from "next-themes";
import { useAdapters } from "@prl-wallet/app-adapters";
import { ANALYTICS_COPY } from "@prl-wallet/api-client";

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NEVER = "never" as const;
type AutoLockValue = "1" | "5" | "15" | "30" | "60" | typeof NEVER;

function msToValue(ms: number | null): AutoLockValue {
  if (ms === null) return NEVER;
  return String(Math.round(ms / 60_000)) as AutoLockValue;
}

function valueToMs(v: AutoLockValue): number | null {
  if (v === NEVER) return null;
  return parseInt(v, 10) * 60 * 1000;
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { stores, services } = useAdapters();
  const idleTimeoutMs = useStore(stores.lock, (s) => s.idleTimeoutMs);
  const setIdleTimeoutMs = useStore(stores.lock, (s) => s.setIdleTimeoutMs);
  const { theme, setTheme } = useTheme();

  const autoLockValue = msToValue(idleTimeoutMs);
  const isNever = autoLockValue === NEVER;

  // analytics consent state lives on walletListStore;
  // surface via Zustand selector so toggle reflects current granted state.
  const granted = useStore(
    stores.walletList,
    (s) => s.analyticsConsent.granted,
  );
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);

  // + — Switch onCheckedChange opens the appropriate
  // AlertDialog. The actual consent change happens only on Accept/Confirm
  // inside the dialog (Cancel returns the switch to its prior position
  // without firing any port method).
  const handleAnalyticsToggle = useCallback(
    (next: boolean) => {
      if (analyticsBusy) return;
      if (next) setGrantDialogOpen(true);
      else setRevokeDialogOpen(true);
    },
    [analyticsBusy],
  );

  const handleGrantAccept = useCallback(async () => {
    if (!services.analytics) {
      setGrantDialogOpen(false);
      return;
    }
    setAnalyticsBusy(true);
    try {
      await services.analytics.grantConsent();
    } finally {
      setAnalyticsBusy(false);
      setGrantDialogOpen(false);
    }
  }, [services]);

  const handleRevokeConfirm = useCallback(async () => {
    if (!services.analytics) {
      setRevokeDialogOpen(false);
      return;
    }
    setAnalyticsBusy(true);
    try {
      await services.analytics.revokeConsent();
    } finally {
      setAnalyticsBusy(false);
      setRevokeDialogOpen(false);
    }
  }, [services]);

  return (
    <main className="bg-background min-h-full">
      <section className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold leading-snug mb-6">Settings</h1>

        <div className="flex flex-col gap-4">
          {/* Card 1: Change PIN — preserved verbatim from */}
          <Card className="p-0">
            <button
              type="button"
              onClick={() => navigate("/settings/change-pin")}
              className="flex items-center justify-between w-full p-6 text-left hover:bg-primary/5 transition-colors rounded-lg"
            >
              <span className="text-sm font-normal">Change PIN</span>
              <ChevronRight
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </Card>

          {/* Card 2: Auto-lock — /12 */}
          <Card className="p-6 flex flex-col gap-3">
            <Label htmlFor="auto-lock-select" className="text-sm font-semibold">
              Auto-lock
            </Label>
            <Select
              value={autoLockValue}
              onValueChange={(v) =>
                setIdleTimeoutMs(valueToMs(v as AutoLockValue))
              }
            >
              <SelectTrigger
                id="auto-lock-select"
                className="w-full"
                aria-label="Auto-lock"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 minute</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value={NEVER}>Never</SelectItem>
              </SelectContent>
            </Select>
            {isNever && (
              <Alert variant="destructive">
                <AlertDescription>
                  Wallet stays unlocked indefinitely — not recommended for
                  wallets holding funds.
                </AlertDescription>
              </Alert>
            )}
          </Card>

          {/* Card 3: Theme — */}
          <Card className="p-6 flex flex-col gap-3">
            <Label className="text-sm font-semibold">Theme</Label>
            <RadioGroup
              value={theme ?? "system"}
              onValueChange={(v) => setTheme(v)}
              className="grid grid-cols-1 gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="theme-system" value="system" />
                <Label htmlFor="theme-system" className="text-sm font-normal">
                  System
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="theme-light" value="light" />
                <Label htmlFor="theme-light" className="text-sm font-normal">
                  Light
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="theme-dark" value="dark" />
                <Label htmlFor="theme-dark" className="text-sm font-normal">
                  Dark
                </Label>
              </div>
            </RadioGroup>
          </Card>

          {/* Card 4: Notifications — (informational, mobile-only) */}
          <Card className="p-6 flex flex-col gap-3">
            <Label className="text-sm font-semibold">Notifications</Label>
            <p className="text-sm font-normal text-muted-foreground">
              Push notifications are mobile-only at this time.
            </p>
          </Card>

          {/* Card 5: Privacy & analytics — + UI-SPEC §5/§10.
              All user-facing strings come from ANALYTICS_COPY (locked,
              single source). NEVER paraphrase any literal here. */}
          <Card className="p-6 flex flex-col gap-3">
            <Label className="text-sm font-semibold">
              {ANALYTICS_COPY.settingsRowLabel}
            </Label>
            <p className="text-sm font-normal">{ANALYTICS_COPY.body}</p>
            <Label className="text-sm font-semibold">
              {ANALYTICS_COPY.disclosureHeading}
            </Label>
            <ul className="text-sm font-normal text-muted-foreground space-y-2 list-disc list-inside">
              <li>{ANALYTICS_COPY.bullet1}</li>
              <li>{ANALYTICS_COPY.bullet2}</li>
              <li>{ANALYTICS_COPY.bullet3}</li>
              <li>{ANALYTICS_COPY.bullet4}</li>
              <li>{ANALYTICS_COPY.bullet5}</li>
              <li>{ANALYTICS_COPY.bullet6}</li>
              <li>{ANALYTICS_COPY.bullet7}</li>
              <li>{ANALYTICS_COPY.bullet8}</li>
            </ul>
            <div className="flex items-center justify-between">
              <Label htmlFor="analytics-switch" className="text-sm font-normal">
                {ANALYTICS_COPY.switchLabel}
              </Label>
              <Switch
                id="analytics-switch"
                checked={granted}
                onCheckedChange={handleAnalyticsToggle}
                disabled={analyticsBusy}
                aria-label={ANALYTICS_COPY.switchLabel}
              />
            </div>
          </Card>
        </div>
      </section>

      {/* — grant modal */}
      <AlertDialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ANALYTICS_COPY.modalGrantTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ANALYTICS_COPY.modalGrantBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {ANALYTICS_COPY.modalGrantCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleGrantAccept();
              }}
            >
              {ANALYTICS_COPY.modalGrantAccept}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* — revoke confirmation. NOT styled destructive
          (UI-SPEC §4 — revoke is reversible, not a danger action). */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ANALYTICS_COPY.modalRevokeTitle}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {ANALYTICS_COPY.modalRevokeCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevokeConfirm();
              }}
            >
              {ANALYTICS_COPY.modalRevokeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
