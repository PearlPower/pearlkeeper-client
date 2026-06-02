// apps/desktop/src/__tests__/updateBanner.test.tsx
//
// Render coverage for the unified update-panel on desktop. The hook is
// mocked so each test pins a state; the only desktop-specific glue we
// exercise is:
// getVersion() bootstrap defers rendering until installedVersion is known
// "Update Now" hands off to installAndRestart from lib/updater.ts
// forced state cannot be dismissed; nudge can

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const getVersionMock = vi.fn();
const installAndRestartMock = vi.fn();
const useUpdateBannerMock = vi.fn();
const useAdaptersMock = vi.fn();

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: () => getVersionMock(),
}));

vi.mock("@/lib/updater", () => ({
  installAndRestart: (opts: unknown) => installAndRestartMock(opts),
}));

vi.mock("@prl-wallet/app-flows", () => ({
  useUpdateBanner: (...args: unknown[]) => useUpdateBannerMock(...args),
}));

vi.mock("@prl-wallet/app-adapters", () => ({
  useAdapters: () => useAdaptersMock(),
}));

vi.mock("react-markdown", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <div>{props.children}</div>,
}));

import { UpdateBanner } from "@/components/UpdateBanner";

const STUB_SIGNED = { getChainConfig: vi.fn(), getVersionManifest: vi.fn() };
const STUB_RELEASES = { getReleasesSince: vi.fn() };

beforeEach(() => {
  getVersionMock.mockReset();
  installAndRestartMock.mockReset();
  useUpdateBannerMock.mockReset();
  useAdaptersMock.mockReset();
  useAdaptersMock.mockReturnValue({
    services: { signedConfig: STUB_SIGNED, releases: STUB_RELEASES },
  });
});

describe("UpdateBanner (desktop)", () => {
  test("renders nothing while installedVersion is still resolving", () => {
    getVersionMock.mockReturnValue(new Promise(() => {})); // never resolves
    useUpdateBannerMock.mockReturnValue({
      state: "hidden",
      latestVersion: "",
      minSupportedVersion: "",
      changelog: "",
      dismiss: vi.fn(),
    });
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing when hook state is hidden", async () => {
    getVersionMock.mockResolvedValueOnce("1.4.0");
    useUpdateBannerMock.mockReturnValue({
      state: "hidden",
      latestVersion: "",
      minSupportedVersion: "",
      changelog: "",
      dismiss: vi.fn(),
    });
    const { container } = render(<UpdateBanner />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container).toBeEmptyDOMElement();
  });

  test("nudge state renders title, changelog, Later and Update Now", async () => {
    getVersionMock.mockResolvedValueOnce("1.3.0");
    useUpdateBannerMock.mockReturnValue({
      state: "nudge",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.0.0",
      changelog: "## 1.4.0\n- thing changed",
      dismiss: vi.fn(),
    });
    render(<UpdateBanner />);
    expect(
      await screen.findByText("Update Available — v1.4.0"),
    ).toBeInTheDocument();
    expect(screen.getByText(/thing changed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Later" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update Now" }),
    ).toBeInTheDocument();
  });

  test("forced state hides the Later button", async () => {
    getVersionMock.mockResolvedValueOnce("0.9.0");
    useUpdateBannerMock.mockReturnValue({
      state: "forced",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.4.0",
      changelog: "",
      dismiss: vi.fn(),
    });
    render(<UpdateBanner />);
    expect(
      await screen.findByText("Update Available — v1.4.0"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Later" })).toBeNull();
  });

  test("Update Now triggers installAndRestart", async () => {
    getVersionMock.mockResolvedValueOnce("1.3.0");
    installAndRestartMock.mockResolvedValueOnce(undefined);
    useUpdateBannerMock.mockReturnValue({
      state: "nudge",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.0.0",
      changelog: "",
      dismiss: vi.fn(),
    });
    render(<UpdateBanner />);
    const button = await screen.findByRole("button", { name: "Update Now" });
    await userEvent.click(button);
    expect(installAndRestartMock).toHaveBeenCalled();
  });

  test("nudge Later button calls hook.dismiss", async () => {
    getVersionMock.mockResolvedValueOnce("1.3.0");
    const dismiss = vi.fn().mockResolvedValue(undefined);
    useUpdateBannerMock.mockReturnValue({
      state: "nudge",
      latestVersion: "1.4.0",
      minSupportedVersion: "1.0.0",
      changelog: "",
      dismiss,
    });
    render(<UpdateBanner />);
    const button = await screen.findByRole("button", { name: "Later" });
    await userEvent.click(button);
    expect(dismiss).toHaveBeenCalled();
  });

  test("renders nothing when signedConfig port is missing from adapters", async () => {
    useAdaptersMock.mockReturnValue({ services: {} });
    getVersionMock.mockResolvedValueOnce("1.4.0");
    useUpdateBannerMock.mockReturnValue({
      state: "hidden",
      latestVersion: "",
      minSupportedVersion: "",
      changelog: "",
      dismiss: vi.fn(),
    });
    const { container } = render(<UpdateBanner />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
