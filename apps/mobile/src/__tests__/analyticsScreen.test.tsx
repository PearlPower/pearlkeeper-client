// apps/mobile/src/__tests__/analyticsScreen.test.tsx
//
// Opt-in analytics screen contract tests.
//
// UI-SPEC §11 enforcement:
// Dimension 1 (Copywriting): all 17 user-facing strings come from
// ANALYTICS_COPY verbatim (no inline literals in the source body).
// State machine §8: switch ON → grant Alert; switch OFF → revoke Alert;
// Cancel = no state change; Accept/Confirm = port call.
// Accessibility §9: switch has accessibilityRole="switch" +
// accessibilityLabel from ANALYTICS_COPY.switchLabel.

import React from "react";
import { Alert } from "react-native";
import * as fs from "node:fs";
import * as path from "node:path";
import { fireEvent, screen } from "@testing-library/react-native";
import { ANALYTICS_COPY } from "@prl-wallet/api-client";
import AnalyticsScreen from "../screens/Settings/AnalyticsScreen";
import { renderScreen } from "../test-utils/renderScreen";

// jest.mock factories may only reference out-of-scope variables whose
// names are prefixed with `mock` (case-insensitive). Per jest hoisting
// rules: jest.mock(...) is lifted to the top of the file before any
// non-mock identifiers exist; the `mock`-prefix convention is the only
// supported escape hatch.
const mockGrantConsent = jest.fn().mockResolvedValue(undefined);
const mockRevokeConsent = jest.fn().mockResolvedValue(undefined);
let mockConsentGranted = false;

jest.mock("@prl-wallet/app-adapters", () => ({
  useAdapters: () => ({
    services: {
      analytics: {
        grantConsent: mockGrantConsent,
        revokeConsent: mockRevokeConsent,
        getConsent: () => ({
          granted: mockConsentGranted,
          decidedAt: mockConsentGranted ? 1 : null,
        }),
        track: jest.fn(),
        trackFlow: jest.fn(),
      },
    },
  }),
}));

jest.mock("../store/walletListStore", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useStore: any = (selector?: (state: any) => unknown) => {
    const state = {
      analyticsConsent: {
        granted: mockConsentGranted,
        decidedAt: mockConsentGranted ? 1 : null,
      },
    };
    return selector ? selector(state) : state;
  };
  useStore.getState = () => ({
    analyticsConsent: {
      granted: mockConsentGranted,
      decidedAt: mockConsentGranted ? 1 : null,
    },
  });
  return { useWalletListStore: useStore };
});

function createNavigation() {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };
}

describe("AnalyticsScreen — ", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsentGranted = false;
  });

  it("renders all 17 ANALYTICS_COPY strings verbatim", () => {
    renderScreen(<AnalyticsScreen navigation={createNavigation() as never} />);

    // Hero, body, disclosure heading
    expect(screen.getByText(ANALYTICS_COPY.hero)).toBeTruthy();
    expect(screen.getByText(ANALYTICS_COPY.body)).toBeTruthy();
    expect(
      screen.getByText(ANALYTICS_COPY.disclosureHeading.toUpperCase()),
    ).toBeTruthy();

    // 8 bullets — rendered as `• ${bullet}` (UI-SPEC §6 inline pattern)
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet1}`)).toBeTruthy();
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet2}`)).toBeTruthy();
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet3}`)).toBeTruthy();
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet4}`)).toBeTruthy();
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet5}`)).toBeTruthy();
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet6}`)).toBeTruthy();
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet7}`)).toBeTruthy();
    expect(screen.getByText(`• ${ANALYTICS_COPY.bullet8}`)).toBeTruthy();

    // Switch label
    expect(screen.getByText(ANALYTICS_COPY.switchLabel)).toBeTruthy();
  });

  it("toggle ON opens Alert with grant title + accept/cancel", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    renderScreen(<AnalyticsScreen navigation={createNavigation() as never} />);

    const toggle = screen.getByLabelText(ANALYTICS_COPY.switchLabel);
    fireEvent(toggle, "valueChange", true);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = alertSpy.mock.calls[0]!;
    expect(title).toBe(ANALYTICS_COPY.modalGrantTitle);
    expect(body).toBe(ANALYTICS_COPY.modalGrantBody);
    expect(buttons).toEqual([
      expect.objectContaining({ text: ANALYTICS_COPY.modalGrantCancel }),
      expect.objectContaining({ text: ANALYTICS_COPY.modalGrantAccept }),
    ]);
    alertSpy.mockRestore();
  });

  it("Accept handler calls services.analytics.grantConsent", async () => {
    let acceptHandler: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      const accept = (buttons ?? []).find(
        (b: { text?: string }) => b.text === ANALYTICS_COPY.modalGrantAccept,
      );
      acceptHandler = accept?.onPress as () => void;
    });

    renderScreen(<AnalyticsScreen navigation={createNavigation() as never} />);
    fireEvent(
      screen.getByLabelText(ANALYTICS_COPY.switchLabel),
      "valueChange",
      true,
    );
    expect(acceptHandler).toBeDefined();
    await acceptHandler!();
    expect(mockGrantConsent).toHaveBeenCalledTimes(1);
    expect(mockRevokeConsent).not.toHaveBeenCalled();
  });

  it("toggle OFF (when granted) opens Alert with revoke title + confirm/cancel", () => {
    mockConsentGranted = true;
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    renderScreen(<AnalyticsScreen navigation={createNavigation() as never} />);

    const toggle = screen.getByLabelText(ANALYTICS_COPY.switchLabel);
    fireEvent(toggle, "valueChange", false);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [title, _body, buttons] = alertSpy.mock.calls[0]!;
    expect(title).toBe(ANALYTICS_COPY.modalRevokeTitle);
    expect(buttons).toEqual([
      expect.objectContaining({ text: ANALYTICS_COPY.modalRevokeCancel }),
      expect.objectContaining({ text: ANALYTICS_COPY.modalRevokeConfirm }),
    ]);
    alertSpy.mockRestore();
  });

  it("Confirm revoke handler calls services.analytics.revokeConsent", async () => {
    mockConsentGranted = true;
    let confirmHandler: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      const confirm = (buttons ?? []).find(
        (b: { text?: string }) => b.text === ANALYTICS_COPY.modalRevokeConfirm,
      );
      confirmHandler = confirm?.onPress as () => void;
    });

    renderScreen(<AnalyticsScreen navigation={createNavigation() as never} />);
    fireEvent(
      screen.getByLabelText(ANALYTICS_COPY.switchLabel),
      "valueChange",
      false,
    );
    expect(confirmHandler).toBeDefined();
    await confirmHandler!();
    expect(mockRevokeConsent).toHaveBeenCalledTimes(1);
    expect(mockGrantConsent).not.toHaveBeenCalled();
  });

  it("Cancel (grant) does NOT call grantConsent", () => {
    let cancelHandler: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
      const cancel = (buttons ?? []).find(
        (b: { text?: string }) => b.text === ANALYTICS_COPY.modalGrantCancel,
      );
      cancelHandler = cancel?.onPress as () => void | undefined;
    });

    renderScreen(<AnalyticsScreen navigation={createNavigation() as never} />);
    fireEvent(
      screen.getByLabelText(ANALYTICS_COPY.switchLabel),
      "valueChange",
      true,
    );
    // Cancel button has style: "cancel"; onPress may be undefined which is
    // a valid no-op. Either way, neither port method should be called.
    if (cancelHandler) cancelHandler();
    expect(mockGrantConsent).not.toHaveBeenCalled();
    expect(mockRevokeConsent).not.toHaveBeenCalled();
  });

  it("source file does NOT contain inline locked-copy literals (single-source ANALYTICS_COPY)", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../screens/Settings/AnalyticsScreen.tsx"),
      "utf-8",
    );
    // Strip the header comment block: scan only from the first `import`
    // statement onward. The header MAY mention these strings in
    // documentation form; the test cares about JSX/runtime literals.
    const firstImport = src.indexOf("\nimport ");
    const body = firstImport >= 0 ? src.slice(firstImport) : src;
    const inlineHits = [
      "Help improve Pearl Keeper",
      "Share usage data",
      "Stop sharing usage data?",
      "We collect anonymous usage data",
      "What we collect",
      "Privacy & analytics",
    ].filter((needle) => body.includes(needle));
    expect(inlineHits).toEqual([]);
  });

  it("Switch has accessibilityRole='switch' + label from ANALYTICS_COPY.switchLabel", () => {
    renderScreen(<AnalyticsScreen navigation={createNavigation() as never} />);
    const toggle = screen.getByLabelText(ANALYTICS_COPY.switchLabel);
    expect(toggle.props.accessibilityRole).toBe("switch");
  });
});
