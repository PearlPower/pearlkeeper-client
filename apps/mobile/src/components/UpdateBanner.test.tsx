// apps/mobile/src/components/UpdateBanner.test.tsx
// UpdateBanner behavior tests for the unified release-update mechanism.

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Linking, Platform } from "react-native";

jest.mock("@prl-wallet/app-flows", () => {
  const actual = jest.requireActual("@prl-wallet/app-flows");
  return {
    ...actual,
    useUpdateBanner: jest.fn(),
  };
});

jest.mock("@prl-wallet/app-adapters", () => ({
  useAdapters: jest.fn(),
}));

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.3.0",
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../lib/installApk", () => ({
  installApk: jest.fn(),
}));

// react-native-markdown-display renders an HTML-ish tree we don't need to
// exercise here — stub it to a plain Text so screen.getByText still works.
// `virtual: true` lets jest mock the module even though node_modules has not
// been populated by `npm install` yet in CI / local first-run.
jest.mock(
  "react-native-markdown-display",
  () => {
    const { Text } = jest.requireActual("react-native");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (props: any) => <Text>{props.children}</Text>;
  },
  { virtual: true },
);
jest.mock(
  "expo-file-system",
  () => ({
    cacheDirectory: "/cache/",
    downloadAsync: jest.fn(),
    getContentUriAsync: jest.fn(),
  }),
  { virtual: true },
);
jest.mock("expo-intent-launcher", () => ({ startActivityAsync: jest.fn() }), {
  virtual: true,
});

import { UpdateBanner } from "./UpdateBanner";
import { installApk } from "../lib/installApk";

const installApkMock = installApk as jest.MockedFunction<typeof installApk>;

const { useUpdateBanner } = jest.requireMock("@prl-wallet/app-flows") as {
  useUpdateBanner: jest.Mock;
};
const { useAdapters } = jest.requireMock("@prl-wallet/app-adapters") as {
  useAdapters: jest.Mock;
};

const STUB_SIGNED = {
  getChainConfig: jest.fn(),
  getVersionManifest: jest.fn(),
};
const STUB_RELEASES = {
  getReleasesSince: jest.fn().mockResolvedValue({ releases: [] }),
};

function setPlatform(os: "ios" | "android"): void {
  // RN Platform.OS is read-only on type but mutable on object at runtime.
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

beforeEach(() => {
  useAdapters.mockReturnValue({
    services: { signedConfig: STUB_SIGNED, releases: STUB_RELEASES },
  });
  useUpdateBanner.mockReset();
  installApkMock.mockReset();
  installApkMock.mockResolvedValue({ ok: true });
});

describe("UpdateBanner", () => {
  it("renders nothing when state === 'hidden'", () => {
    useUpdateBanner.mockReturnValue({
      state: "hidden",
      latestVersion: "",
      minSupportedVersion: "",
      changelog: "",
      dismiss: jest.fn(),
    });
    const { toJSON } = render(<UpdateBanner />);
    expect(toJSON()).toBeNull();
  });

  it("renders the nudge banner with latestVersion in the label", () => {
    useUpdateBanner.mockReturnValue({
      state: "nudge",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.0.0",
      changelog: "",
      iosStoreUrl: "https://apps.apple.com/app/id123",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    expect(screen.getByText("Update available — v1.4.0")).toBeTruthy();
    expect(screen.getByText("Update")).toBeTruthy();
    expect(screen.getByText("✕")).toBeTruthy();
  });

  it("on iOS nudge, taps open the iOS store URL", () => {
    setPlatform("ios");
    const openSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValueOnce(true as unknown as boolean);
    useUpdateBanner.mockReturnValue({
      state: "nudge",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.0.0",
      changelog: "",
      iosStoreUrl: "https://apps.apple.com/app/id123",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    fireEvent.press(screen.getByLabelText("Open store to update"));
    expect(openSpy).toHaveBeenCalledWith("https://apps.apple.com/app/id123");
    openSpy.mockRestore();
  });

  it("on Android nudge, taps open the Play Store URL", () => {
    setPlatform("android");
    const openSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValueOnce(true as unknown as boolean);
    useUpdateBanner.mockReturnValue({
      state: "nudge",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.0.0",
      changelog: "",
      androidPlayUrl:
        "https://play.google.com/store/apps/details?id=com.pearlkeeper.mobile",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    fireEvent.press(screen.getByLabelText("Open store to update"));
    expect(openSpy).toHaveBeenCalledWith(
      "https://play.google.com/store/apps/details?id=com.pearlkeeper.mobile",
    );
    openSpy.mockRestore();
  });

  it("forced modal renders the changelog markdown and version", () => {
    useUpdateBanner.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "## 1.4.0\n- thing changed",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    expect(screen.getByText("Update Available")).toBeTruthy();
    expect(screen.getByText("v1.4.0")).toBeTruthy();
    expect(screen.getByText("## 1.4.0\n- thing changed")).toBeTruthy();
  });

  it("Android forced modal shows BOTH APK and Play Store buttons when both URLs present", () => {
    setPlatform("android");
    useUpdateBanner.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "",
      androidPlayUrl:
        "https://play.google.com/store/apps/details?id=com.pearlkeeper.mobile",
      androidApkUrl: "https://cdn.example.com/wallet-1.4.0.apk",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    expect(screen.getByText("Install update")).toBeTruthy();
    expect(screen.getByText("Open Play Store")).toBeTruthy();
  });

  it("Android forced modal hides the APK button when androidApkUrl is absent", () => {
    setPlatform("android");
    useUpdateBanner.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "",
      androidPlayUrl:
        "https://play.google.com/store/apps/details?id=com.pearlkeeper.mobile",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    expect(screen.queryByText("Install update")).toBeNull();
    expect(screen.getByText("Open Play Store")).toBeTruthy();
  });

  it("Android 'Install update' tap fires installApk with the APK URL", async () => {
    setPlatform("android");
    useUpdateBanner.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "",
      androidApkUrl: "https://cdn.example.com/wallet-1.4.0.apk",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    fireEvent.press(screen.getByLabelText("Install update directly"));
    expect(installApk).toHaveBeenCalledWith(
      "https://cdn.example.com/wallet-1.4.0.apk",
    );
  });

  it("Android APK install failure with Play URL prompts to fall back to Play Store", async () => {
    setPlatform("android");
    installApkMock.mockResolvedValueOnce({
      ok: false,
      reason: "intent-failed",
    });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useUpdateBanner.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "",
      androidApkUrl: "https://cdn.example.com/wallet-1.4.0.apk",
      androidPlayUrl:
        "https://play.google.com/store/apps/details?id=com.pearlkeeper.mobile",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    fireEvent.press(screen.getByLabelText("Install update directly"));
    await new Promise((r) => setTimeout(r, 5));
    expect(alertSpy).toHaveBeenCalled();
    const [, , buttons] = alertSpy.mock.calls[0];
    expect(buttons?.some((b) => b.text === "Open Play Store")).toBe(true);
    alertSpy.mockRestore();
  });

  it("Android APK install failure with no Play URL surfaces a reason-specific alert", async () => {
    setPlatform("android");
    installApkMock.mockResolvedValueOnce({
      ok: false,
      reason: "download-failed",
    });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useUpdateBanner.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "",
      androidApkUrl: "https://cdn.example.com/wallet-1.4.0.apk",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    fireEvent.press(screen.getByLabelText("Install update directly"));
    await new Promise((r) => setTimeout(r, 5));
    expect(alertSpy).toHaveBeenCalled();
    const [title, message] = alertSpy.mock.calls[0];
    expect(title).toContain("Couldn't install");
    expect(message).toContain("download");
    alertSpy.mockRestore();
  });

  it("iOS forced modal shows only the App Store button", () => {
    setPlatform("ios");
    useUpdateBanner.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "",
      iosStoreUrl: "https://apps.apple.com/app/id123",
      androidApkUrl: "https://cdn.example.com/wallet-1.4.0.apk",
      androidPlayUrl: "https://play.google.com/...",
      dismiss: jest.fn(),
    });
    render(<UpdateBanner />);
    expect(screen.getByText("Open App Store")).toBeTruthy();
    expect(screen.queryByText("Install update")).toBeNull();
    expect(screen.queryByText("Open Play Store")).toBeNull();
  });
});
