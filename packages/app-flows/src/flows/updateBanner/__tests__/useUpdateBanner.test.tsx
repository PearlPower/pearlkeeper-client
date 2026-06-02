// packages/app-flows/src/flows/updateBanner/__tests__/useUpdateBanner.test.tsx
//
// computeBannerState gets dedicated unit coverage (no React).
// useUpdateBanner gets renderHook coverage with mocked useSignedConfig.

import { act, renderHook, waitFor } from "@testing-library/react";
import type { SignedConfigPort } from "@prl-wallet/services";
import { computeBannerState, useUpdateBanner } from "../useUpdateBanner.js";

jest.mock("../../signedConfig/useSignedConfig", () => ({
  useSignedConfig: jest.fn(),
}));

const { useSignedConfig: mockUseSignedConfig } = jest.requireMock(
  "../../signedConfig/useSignedConfig",
) as {
  useSignedConfig: jest.Mock;
};

const stubManifest = {
  latestVersion: "1.4.0",
  minSupportedVersion: "1.0.0",
  platforms: {
    ios: { storeUrl: "itms-apps://itunes.apple.com/app/id123" },
    android: {
      storeUrl:
        "https://play.google.com/store/apps/details?id=com.pearlkeeper.mobile",
      apkUrl: "https://cdn.example.com/wallet-1.4.0.apk",
    },
    desktop: { updateEndpoint: "https://www.pearlkeeper.com/desktop" },
  },
};

const stubPort: SignedConfigPort = {
  getChainConfig: jest.fn(),
  getVersionManifest: jest.fn(),
};

describe("computeBannerState", () => {
  it("returns 'forced' when installedVersion < minSupportedVersion", () => {
    expect(
      computeBannerState({
        installedVersion: "0.9.0",
        latestVersion: "1.4.0",
        minSupportedVersion: "1.0.0",
        dismissedVersion: null,
      }),
    ).toBe("forced");
  });

  it("returns 'nudge' when installedVersion < latestVersion AND dismissed < latest", () => {
    expect(
      computeBannerState({
        installedVersion: "1.3.0",
        latestVersion: "1.4.0",
        minSupportedVersion: "1.0.0",
        dismissedVersion: "1.3.5",
      }),
    ).toBe("nudge");
  });

  it("returns 'hidden' when installedVersion < latest BUT dismissed === latest", () => {
    expect(
      computeBannerState({
        installedVersion: "1.3.0",
        latestVersion: "1.4.0",
        minSupportedVersion: "1.0.0",
        dismissedVersion: "1.4.0",
      }),
    ).toBe("hidden");
  });

  it("returns 'hidden' when installedVersion === latestVersion", () => {
    expect(
      computeBannerState({
        installedVersion: "1.4.0",
        latestVersion: "1.4.0",
        minSupportedVersion: "1.0.0",
        dismissedVersion: null,
      }),
    ).toBe("hidden");
  });

  it("returns 'hidden' when installedVersion > latestVersion (dev/beta builds)", () => {
    expect(
      computeBannerState({
        installedVersion: "1.5.0",
        latestVersion: "1.4.0",
        minSupportedVersion: "1.0.0",
        dismissedVersion: null,
      }),
    ).toBe("hidden");
  });
});

describe("useUpdateBanner", () => {
  beforeEach(() => {
    mockUseSignedConfig.mockReset();
  });

  it("returns 'hidden' while signed-config is loading", async () => {
    mockUseSignedConfig.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      source: "loading",
      query: {},
    });
    const { result } = renderHook(() =>
      useUpdateBanner(stubPort, {
        installedVersion: "1.0.0",
        getDismissedVersion: async () => null,
        setDismissedVersion: async () => undefined,
      }),
    );
    expect(result.current.state).toBe("hidden");
  });

  it("returns 'hidden' on signed-config error", async () => {
    mockUseSignedConfig.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network"),
      source: "error",
      query: {},
    });
    const { result } = renderHook(() =>
      useUpdateBanner(stubPort, {
        installedVersion: "1.0.0",
        getDismissedVersion: async () => null,
        setDismissedVersion: async () => undefined,
      }),
    );
    expect(result.current.state).toBe("hidden");
  });

  it("surfaces 'forced' state and exposes every platform URL", async () => {
    mockUseSignedConfig.mockReturnValue({
      data: stubManifest,
      isLoading: false,
      isError: false,
      error: null,
      source: "fresh",
      query: {},
    });
    const { result } = renderHook(() =>
      useUpdateBanner(stubPort, {
        installedVersion: "0.9.0",
        getDismissedVersion: async () => null,
        setDismissedVersion: async () => undefined,
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("forced"));
    expect(result.current.iosStoreUrl).toBe(stubManifest.platforms.ios.storeUrl);
    expect(result.current.androidPlayUrl).toBe(
      stubManifest.platforms.android.storeUrl,
    );
    expect(result.current.androidApkUrl).toBe(
      stubManifest.platforms.android.apkUrl,
    );
    expect(result.current.desktopUpdateEndpoint).toBe(
      stubManifest.platforms.desktop.updateEndpoint,
    );
  });

  it("surfaces 'nudge' state when installed < latest and not dismissed", async () => {
    mockUseSignedConfig.mockReturnValue({
      data: stubManifest,
      isLoading: false,
      isError: false,
      error: null,
      source: "fresh",
      query: {},
    });
    const { result } = renderHook(() =>
      useUpdateBanner(stubPort, {
        installedVersion: "1.3.0",
        getDismissedVersion: async () => null,
        setDismissedVersion: async () => undefined,
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("nudge"));
  });

  it("fetches changelog via getChangelog when state is non-hidden", async () => {
    mockUseSignedConfig.mockReturnValue({
      data: stubManifest,
      isLoading: false,
      isError: false,
      error: null,
      source: "fresh",
      query: {},
    });
    const getChangelog = jest.fn(async () => "## 1.4.0\n- thing changed");
    const { result } = renderHook(() =>
      useUpdateBanner(stubPort, {
        installedVersion: "1.3.0",
        getDismissedVersion: async () => null,
        setDismissedVersion: async () => undefined,
        getChangelog,
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("nudge"));
    await waitFor(() =>
      expect(result.current.changelog).toBe("## 1.4.0\n- thing changed"),
    );
    expect(getChangelog).toHaveBeenCalledWith("1.3.0");
  });

  it("does NOT call getChangelog when state is hidden", async () => {
    mockUseSignedConfig.mockReturnValue({
      data: stubManifest,
      isLoading: false,
      isError: false,
      error: null,
      source: "fresh",
      query: {},
    });
    const getChangelog = jest.fn(async () => "should not appear");
    renderHook(() =>
      useUpdateBanner(stubPort, {
        installedVersion: "1.4.0", // equal to latest → hidden
        getDismissedVersion: async () => null,
        setDismissedVersion: async () => undefined,
        getChangelog,
      }),
    );
    // Give effects a tick to settle.
    await new Promise((r) => setTimeout(r, 5));
    expect(getChangelog).not.toHaveBeenCalled();
  });

  it("dismiss() persists latestVersion and flips state to hidden", async () => {
    mockUseSignedConfig.mockReturnValue({
      data: stubManifest,
      isLoading: false,
      isError: false,
      error: null,
      source: "fresh",
      query: {},
    });
    const setDismissedVersion = jest.fn(async () => undefined);
    const { result } = renderHook(() =>
      useUpdateBanner(stubPort, {
        installedVersion: "1.3.0",
        getDismissedVersion: async () => null,
        setDismissedVersion,
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("nudge"));
    await act(async () => {
      await result.current.dismiss();
    });
    expect(setDismissedVersion).toHaveBeenCalledWith("1.4.0");
    await waitFor(() => expect(result.current.state).toBe("hidden"));
  });
});
