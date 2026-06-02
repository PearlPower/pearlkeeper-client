// apps/desktop/src/__tests__/settingsScreen.test.tsx
//
// Task 4 — SettingsScreen contract verification.
// ( /12, ) — extended with auto-lock
// Card (Select + conditional destructive Alert) + Theme Card (RadioGroup
// bound to next-themes useTheme/setTheme).
// (, ) — informational Notifications card.
// (, , , UI-SPEC §5/§6/§8/§11) — new
// "Privacy & analytics" Card consuming ANALYTICS_COPY verbatim with a
// master <Switch> that opens grant/revoke <AlertDialog> modals; Confirm
// handlers call services.analytics.{grantConsent,revokeConsent}.
//
// Locks:
// : 'Settings' H1 + 'Change PIN' nav row → /settings/change-pin
// : Auto-lock Select with 6 locked options
// : 'Never' renders <Alert variant="destructive"> with locked copy
// : store mutation via setIdleTimeoutMs reflects choice
// : Theme RadioGroup bound to useTheme/setTheme; default 'system';
// setTheme writes localStorage 'theme' + .dark class on <html>
// : 17 ANALYTICS_COPY strings render verbatim
// : ON → grant AlertDialog (Accept calls grantConsent)
// : OFF → revoke AlertDialog (Confirm calls revokeConsent)
// / UI-SPEC §11 Dim 1: source contains no inline locked-copy literals
// / UI-SPEC §4 + Dim 3: revoke action NOT styled destructive
//
// matchMedia polyfill at top is preserved verbatim — next-themes' enableSystem
// reads window.matchMedia on mount; jsdom does not implement it natively.
//
// No @prl-wallet/app-flows mocking ().

import { describe, test, expect, beforeAll, beforeEach, vi } from "vitest";
import { type ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import * as fs from "node:fs";
import * as path from "node:path";
import { ANALYTICS_COPY } from "@prl-wallet/api-client";
import { SettingsScreen } from "@/screens/Settings/SettingsScreen";
import { renderUnderHarness } from "./_harness/TestHarness";

beforeAll(() => {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia !== "function"
  ) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

// next-themes shares <html> classList + localStorage globally across tests in
// the same jsdom realm. Reset both between tests so theme state doesn't leak
// from one test into the next (mirrors themeProvider.test.tsx pattern).
beforeEach(() => {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.removeAttribute("style");
  try {
    window.localStorage.removeItem("theme");
  } catch {
    // jsdom always provides localStorage; defensive only.
  }
});

/**
 * Wraps the SettingsScreen route element in a fresh <ThemeProvider> so
 * `useTheme()` resolves inside the test render. ThemeProvider is mounted
 * app-wide in production via main.tsx ( ); the test
 * harness intentionally stays provider-agnostic, so each settings test
 * supplies its own wrapper.
 */
function withTheme(node: ReactNode): ReactNode {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {node}
    </ThemeProvider>
  );
}

describe("SettingsScreen", () => {
  test("renders 'Settings' H1 + 'Change PIN' nav row", () => {
    renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Change PIN/ }),
    ).toBeInTheDocument();
  });

  test("Test A: Change PIN row preserved — clicking navigates to /settings/change-pin", async () => {
    renderUnderHarness({
      routes: [
        { path: "/settings", element: withTheme(<SettingsScreen />) },
        {
          path: "/settings/change-pin",
          element: <div data-testid="change-pin-marker" />,
        },
      ],
      initialEntries: ["/settings"],
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Change PIN/ }));
    expect(await screen.findByTestId("change-pin-marker")).toBeInTheDocument();
  });

  // ------------------------------------------------------------------------
  // Auto-lock Card ( /12/13)
  // ------------------------------------------------------------------------

  test("Test B: auto-lock Select default visible value is '15 minutes'", () => {
    renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
      // default is 15 * 60 * 1000; assert without tampering.
    });

    // The Select's trigger surfaces the value via SelectValue. Radix renders
    // it inside the trigger button (combobox role).
    const trigger = screen.getByRole("combobox", { name: /Auto-lock/i });
    expect(trigger).toHaveTextContent("15 minutes");
  });

  test("Test C: choosing '5 minutes' calls setIdleTimeoutMs(300_000)", () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });

    // Open the Select. radix renders SelectContent in a portal; once open,
    // the option <div role="option"> elements become reachable via the
    // accessible-role tree even from inside jsdom.
    fireEvent.click(screen.getByRole("combobox", { name: /Auto-lock/i }));

    // Pick "5 minutes".
    const fiveMin = screen.getByRole("option", { name: "5 minutes" });
    fireEvent.click(fiveMin);

    expect(bundle.stores.lock.getState().idleTimeoutMs).toBe(5 * 60 * 1000);
  });

  test("Test D: choosing 'Never' sets idleTimeoutMs=null AND renders the destructive Alert with locked copy", async () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });

    fireEvent.click(screen.getByRole("combobox", { name: /Auto-lock/i }));
    fireEvent.click(screen.getByRole("option", { name: "Never" }));

    expect(bundle.stores.lock.getState().idleTimeoutMs).toBeNull();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Wallet stays unlocked indefinitely — not recommended for wallets holding funds.",
        ),
      ).toBeInTheDocument();
    });
  });

  test("Test E: from 'Never', choosing '30 minutes' sets idleTimeoutMs=1_800_000 AND removes the Alert", async () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
      prepopulate: (b) => {
        b.stores.lock.getState().setIdleTimeoutMs(null);
      },
    });

    // Sanity: Alert is initially present because we seeded null.
    expect(
      await screen.findByText(
        "Wallet stays unlocked indefinitely — not recommended for wallets holding funds.",
      ),
    ).toBeInTheDocument();

    // Re-open the Select and pick "30 minutes".
    fireEvent.click(screen.getByRole("combobox", { name: /Auto-lock/i }));
    fireEvent.click(screen.getByRole("option", { name: "30 minutes" }));

    expect(bundle.stores.lock.getState().idleTimeoutMs).toBe(30 * 60 * 1000);

    await waitFor(() => {
      expect(
        screen.queryByText(
          "Wallet stays unlocked indefinitely — not recommended for wallets holding funds.",
        ),
      ).not.toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // Theme Card ( )
  // ------------------------------------------------------------------------

  test("Test F: theme RadioGroup default is 'System' (checked)", () => {
    renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });

    const systemRadio = screen.getByRole("radio", { name: "System" });
    // Radix RadioGroupItem reflects checked state via aria-checked.
    expect(systemRadio).toHaveAttribute("aria-checked", "true");
  });

  test("Test G: clicking 'Dark' writes localStorage.theme='dark' AND adds .dark class to <html>", async () => {
    renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  test("Test H: clicking 'Light' writes localStorage.theme='light' AND adds .light class to <html>", async () => {
    renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("light");
      expect(document.documentElement.classList.contains("light")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  // ------------------------------------------------------------------------
  // Accessibility + invariants
  // ------------------------------------------------------------------------

  test("Test I: matchMedia polyfill is wired at the top of the file (next-themes pre-req)", () => {
    expect(typeof window.matchMedia).toBe("function");
  });

  test("Test J: Auto-lock Select and Theme RadioGroup each have an associated 'Auto-lock' / 'Theme' Label", () => {
    renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });

    // Card titles render as Labels with the locked copy.
    expect(screen.getByText("Auto-lock")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();

    // Auto-lock Label htmlFor binds to the Select trigger id.
    const autoLockLabel = screen.getByText("Auto-lock");
    const trigger = screen.getByRole("combobox", { name: /Auto-lock/i });
    expect(autoLockLabel).toHaveAttribute("for", trigger.id);
  });

  // ------------------------------------------------------------------------
  // Notifications informational Card (, )
  // ------------------------------------------------------------------------

  test("renders Notifications informational card with locked copy", () => {
    renderUnderHarness({
      routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
      initialEntries: ["/settings"],
    });

    // Locked title (UI-SPEC §Copywriting Contract — NEVER paraphrase).
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    // Locked helper sentence — verbatim, single sentence with period.
    expect(
      screen.getByText("Push notifications are mobile-only at this time."),
    ).toBeInTheDocument();

    // Defense-in-depth: the Notifications card is purely informational per
    // CONTEXT — no interactive controls. Assert no button / switch /
    // link / textbox / combobox / radio is rendered with the locked label
    // "Notifications" (the card title is a <Label>, not a control).
    expect(
      screen.queryByRole("button", { name: "Notifications" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Notifications" }),
    ).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------------------
  // Privacy & analytics Card ( / UI-SPEC §5–§11)
  // ------------------------------------------------------------------------

  describe("Privacy & analytics Card", () => {
    test("renders all 17 ANALYTICS_COPY strings verbatim", () => {
      renderUnderHarness({
        routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
        initialEntries: ["/settings"],
      });

      // 13 in-card strings (settingsRowLabel, body, disclosureHeading, 8
      // bullets, switchLabel — and switchLabel renders as the htmlFor
      // <Label>, so it appears at least once on the page).
      expect(
        screen.getByText(ANALYTICS_COPY.settingsRowLabel),
      ).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.body)).toBeInTheDocument();
      expect(
        screen.getByText(ANALYTICS_COPY.disclosureHeading),
      ).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet1)).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet2)).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet3)).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet4)).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet5)).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet6)).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet7)).toBeInTheDocument();
      expect(screen.getByText(ANALYTICS_COPY.bullet8)).toBeInTheDocument();
      // Switch label renders via <Label htmlFor=...> + aria-label on the
      // Switch — assert via the Switch's accessible name.
      expect(
        screen.getByRole("switch", { name: ANALYTICS_COPY.switchLabel }),
      ).toBeInTheDocument();
    });

    test("clicking Switch ON opens grant AlertDialog with locked title + body + actions", async () => {
      renderUnderHarness({
        routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
        initialEntries: ["/settings"],
      });

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("switch", { name: ANALYTICS_COPY.switchLabel }),
      );

      // Modal contents — Radix renders into a portal + announces via role.
      expect(
        await screen.findByText(ANALYTICS_COPY.modalGrantTitle),
      ).toBeInTheDocument();
      // modalGrantBody === body, so it renders twice (once in Card, once in
      // dialog). Use getAllByText.
      expect(
        screen.getAllByText(ANALYTICS_COPY.modalGrantBody).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByRole("button", { name: ANALYTICS_COPY.modalGrantAccept }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: ANALYTICS_COPY.modalGrantCancel }),
      ).toBeInTheDocument();
    });

    test("Accept in grant dialog calls services.analytics.grantConsent", async () => {
      const { bundle } = renderUnderHarness({
        routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
        initialEntries: ["/settings"],
      });

      // Spy on the live analytics port supplied by buildTestBundle (real
      // createAnalytics factory wired to the in-memory walletListStore).
      const grantSpy = vi
        .spyOn(bundle.services.analytics!, "grantConsent")
        .mockResolvedValue(undefined);

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("switch", { name: ANALYTICS_COPY.switchLabel }),
      );
      await user.click(
        await screen.findByRole("button", {
          name: ANALYTICS_COPY.modalGrantAccept,
        }),
      );

      await waitFor(() => expect(grantSpy).toHaveBeenCalledTimes(1));
    });

    test("Cancel in grant dialog does NOT call grantConsent", async () => {
      const { bundle } = renderUnderHarness({
        routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
        initialEntries: ["/settings"],
      });

      const grantSpy = vi
        .spyOn(bundle.services.analytics!, "grantConsent")
        .mockResolvedValue(undefined);

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("switch", { name: ANALYTICS_COPY.switchLabel }),
      );
      await user.click(
        await screen.findByRole("button", {
          name: ANALYTICS_COPY.modalGrantCancel,
        }),
      );

      // Modal closes without calling grantConsent.
      await waitFor(() => {
        expect(
          screen.queryByRole("button", {
            name: ANALYTICS_COPY.modalGrantAccept,
          }),
        ).not.toBeInTheDocument();
      });
      expect(grantSpy).not.toHaveBeenCalled();
    });

    test("toggling OFF (when granted=true) opens revoke AlertDialog", async () => {
      const { bundle } = renderUnderHarness({
        routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
        initialEntries: ["/settings"],
        prepopulate: (b) => {
          b.stores.walletList.getState().setAnalyticsConsent({
            granted: true,
            decidedAt: 1_700_000_000_000,
          });
        },
      });

      // Sanity — Switch should reflect granted=true.
      const switchEl = screen.getByRole("switch", {
        name: ANALYTICS_COPY.switchLabel,
      });
      expect(switchEl).toHaveAttribute("aria-checked", "true");

      const user = userEvent.setup();
      await user.click(switchEl);

      expect(
        await screen.findByText(ANALYTICS_COPY.modalRevokeTitle),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: ANALYTICS_COPY.modalRevokeConfirm }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: ANALYTICS_COPY.modalRevokeCancel }),
      ).toBeInTheDocument();
      // unused — referencing the bundle to avoid eslint unused-var lint while
      // documenting the seam used by prepopulate.
      void bundle;
    });

    test("Confirm in revoke dialog calls services.analytics.revokeConsent", async () => {
      const { bundle } = renderUnderHarness({
        routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
        initialEntries: ["/settings"],
        prepopulate: (b) => {
          b.stores.walletList.getState().setAnalyticsConsent({
            granted: true,
            decidedAt: 1_700_000_000_000,
          });
        },
      });

      const revokeSpy = vi
        .spyOn(bundle.services.analytics!, "revokeConsent")
        .mockResolvedValue(undefined);

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("switch", { name: ANALYTICS_COPY.switchLabel }),
      );
      await user.click(
        await screen.findByRole("button", {
          name: ANALYTICS_COPY.modalRevokeConfirm,
        }),
      );

      await waitFor(() => expect(revokeSpy).toHaveBeenCalledTimes(1));
    });

    test("revoke Confirm button is NOT styled destructive (UI-SPEC §4 + Dim 3)", async () => {
      renderUnderHarness({
        routes: [{ path: "/settings", element: withTheme(<SettingsScreen />) }],
        initialEntries: ["/settings"],
        prepopulate: (b) => {
          b.stores.walletList.getState().setAnalyticsConsent({
            granted: true,
            decidedAt: 1_700_000_000_000,
          });
        },
      });

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("switch", { name: ANALYTICS_COPY.switchLabel }),
      );
      const confirmBtn = await screen.findByRole("button", {
        name: ANALYTICS_COPY.modalRevokeConfirm,
      });
      // The button uses the default Button variant, NOT destructive. The
      // shadcn default Button still includes `aria-invalid:*-destructive`
      // utilities for form invalidation styling — those aren't applied at
      // runtime. The destructive *variant* signature is `bg-destructive` /
      // `text-destructive-foreground` / `hover:bg-destructive/90`. Assert
      // none of those appear; the default variant's `bg-primary` does.
      const cls = confirmBtn.className;
      expect(cls).toContain("bg-primary");
      expect(cls).not.toMatch(/\bbg-destructive\b/);
      expect(cls).not.toMatch(/\btext-destructive-foreground\b/);
    });

    test("source file contains no inline locked-copy literals (UI-SPEC §11 Dimension 1)", () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, "../screens/Settings/SettingsScreen.tsx"),
        "utf-8",
      );
      // Strip comments before scanning so the locked-copy header reference
      // block does not trip the test ( STEP B).
      const noComments = src
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const inlineHits = [
        "Help improve Pearl Keeper",
        "Share usage data",
        "Stop sharing usage data?",
        "We collect anonymous usage data",
        "What we collect",
        "Privacy & analytics",
      ].filter(
        (needle) =>
          noComments.includes(`"${needle}"`) ||
          noComments.includes(`'${needle}'`) ||
          noComments.includes(`>${needle}<`),
      );
      expect(inlineHits).toEqual([]);
    });
  });
});
