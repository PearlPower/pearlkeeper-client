// apps/desktop/src/__tests__/updateIndicator.test.tsx
// , — UpdateIndicator state transitions.

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const checkForUpdateMock = vi.fn();
const installAndRestartMock = vi.fn();

vi.mock("@/lib/updater", () => ({
  checkForUpdate: () => checkForUpdateMock(),
  installAndRestart: (opts: unknown) => installAndRestartMock(opts),
}));

import { UpdateIndicator } from "@/components/UpdateIndicator";

beforeEach(() => {
  checkForUpdateMock.mockReset();
  installAndRestartMock.mockReset();
});

describe("UpdateIndicator (, )", () => {
  test("renders nothing when checkForUpdate returns idle", async () => {
    checkForUpdateMock.mockResolvedValueOnce({ kind: "idle" });
    const { container } = render(<UpdateIndicator />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container).toBeEmptyDOMElement();
  });

  test("renders 'Update available' when an update is detected", async () => {
    checkForUpdateMock.mockResolvedValueOnce({
      kind: "available",
      update: {},
    });
    render(<UpdateIndicator />);
    expect(await screen.findByText("Update available")).toBeInTheDocument();
  });

  test("clicking 'Update available' triggers installAndRestart", async () => {
    checkForUpdateMock.mockResolvedValueOnce({
      kind: "available",
      update: {},
    });
    installAndRestartMock.mockImplementationOnce(async (opts) => {
      // simulate one progress tick
      (opts as { onProgress?: (n: number) => void }).onProgress?.(50);
      return { outcome: "installed" };
    });
    const user = userEvent.setup();
    render(<UpdateIndicator />);
    await user.click(await screen.findByText("Update available"));
    expect(installAndRestartMock).toHaveBeenCalled();
  });

  test("error path: install rejection resets to idle (indicator hides)", async () => {
    checkForUpdateMock.mockResolvedValueOnce({
      kind: "available",
      update: {},
    });
    installAndRestartMock.mockRejectedValueOnce(new Error("EROFS"));
    const user = userEvent.setup();
    const { container } = render(<UpdateIndicator />);
    await user.click(await screen.findByText("Update available"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
