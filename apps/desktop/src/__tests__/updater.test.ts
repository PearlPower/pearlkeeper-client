// apps/desktop/src/__tests__/updater.test.ts
// .. — checkForUpdate, installAndRestart, mapInstallError.

import { describe, test, expect, vi, beforeEach } from "vitest";

const checkMock = vi.fn();
const relaunchMock = vi.fn();
const messageMock = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => checkMock(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => relaunchMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  message: (...args: unknown[]) => messageMock(...args),
}));

import {
  checkForUpdate,
  installAndRestart,
  mapInstallError,
  __resetForTests,
} from "@/lib/updater";

beforeEach(() => {
  checkMock.mockReset();
  relaunchMock.mockReset();
  messageMock.mockReset();
  __resetForTests();
});

describe("checkForUpdate", () => {
  test("returns idle when plugin reports no update available", async () => {
    checkMock.mockResolvedValueOnce({ available: false });
    const r = await checkForUpdate();
    expect(r).toEqual({ kind: "idle" });
  });

  test("returns idle when plugin returns null", async () => {
    checkMock.mockResolvedValueOnce(null);
    const r = await checkForUpdate();
    expect(r).toEqual({ kind: "idle" });
  });

  test("returns available + caches the Update handle", async () => {
    const fakeUpdate = { available: true, downloadAndInstall: vi.fn() };
    checkMock.mockResolvedValueOnce(fakeUpdate);
    const r = await checkForUpdate();
    expect(r.kind).toBe("available");
    if (r.kind === "available") {
      expect(r.update).toBe(fakeUpdate);
    }
  });

  test("returns idle (no surface) on plugin error", async () => {
    checkMock.mockRejectedValueOnce(new Error("network down"));
    const r = await checkForUpdate();
    expect(r).toEqual({ kind: "idle" });
  });
});

describe("installAndRestart (, )", () => {
  test("throws when no update has been cached", async () => {
    await expect(installAndRestart({})).rejects.toThrow(/no cached update/);
  });

  test("invokes downloadAndInstall, calls relaunch, returns installed", async () => {
    const downloadAndInstall = vi.fn(async () => undefined);
    checkMock.mockResolvedValueOnce({ available: true, downloadAndInstall });
    await checkForUpdate();
    relaunchMock.mockResolvedValueOnce(undefined);

    const r = await installAndRestart({});
    expect(downloadAndInstall).toHaveBeenCalled();
    expect(relaunchMock).toHaveBeenCalled();
    expect(r).toEqual({ outcome: "installed" });
  });

  test("calls onProgress while downloading", async () => {
    const onProgress = vi.fn();
    const downloadAndInstall = vi.fn(
      async (
        cb: (event: {
          event: string;
          data: { contentLength?: number; chunkLength?: number };
        }) => void,
      ) => {
        cb({ event: "Started", data: { contentLength: 100 } });
        cb({ event: "Progress", data: { chunkLength: 25 } });
        cb({ event: "Progress", data: { chunkLength: 25 } });
      },
    );
    checkMock.mockResolvedValueOnce({ available: true, downloadAndInstall });
    await checkForUpdate();
    relaunchMock.mockResolvedValueOnce(undefined);

    await installAndRestart({ onProgress });
    expect(onProgress).toHaveBeenCalledWith(25);
    expect(onProgress).toHaveBeenCalledWith(50);
  });

  test("surfaces locked-copy dialog and rethrows on download error", async () => {
    const downloadAndInstall = vi.fn(async () => {
      throw new Error("EROFS: read-only filesystem");
    });
    checkMock.mockResolvedValueOnce({ available: true, downloadAndInstall });
    await checkForUpdate();
    messageMock.mockResolvedValueOnce(undefined);

    await expect(installAndRestart({})).rejects.toThrow(/EROFS/);
    expect(messageMock).toHaveBeenCalledWith(
      expect.stringContaining("read-only"),
      expect.objectContaining({ kind: "error" }),
    );
  });
});

describe("mapInstallError (, )", () => {
  test("read-only fs → AppImage relocation dialog with locked copy", async () => {
    await mapInstallError(new Error("EROFS"), "https://example.com/desktop");
    const [content, opts] = messageMock.mock.calls[0];
    expect(content).toContain(
      "Update couldn't be installed automatically because the current AppImage location is read-only.",
    );
    expect(content).toContain("~/.local/bin");
    expect(content).toContain("https://example.com/desktop");
    expect(opts.title).toBe("Update couldn't install");
  });

  test("Permission denied → AppImage relocation dialog", async () => {
    await mapInstallError(new Error("Permission denied while writing"));
    const [content] = messageMock.mock.calls[0];
    expect(content).toContain("read-only");
  });

  test("signature failure → verification-failed dialog with locked copy", async () => {
    await mapInstallError(
      new Error("invalid signer for bundle"),
      "https://example.com/desktop",
    );
    const [content, opts] = messageMock.mock.calls[0];
    expect(content).toBe(
      "Update verification failed — please retry or update manually from https://example.com/desktop.",
    );
    expect(opts.title).toBe("Update verification failed");
  });

  test("generic error → fallback dialog", async () => {
    await mapInstallError(new Error("transient network failure"));
    const [content, opts] = messageMock.mock.calls[0];
    expect(content).toContain("Update couldn't be installed");
    expect(content).toContain("transient network failure");
    expect(opts.title).toBe("Update error");
  });

  test("omits download URL when no endpoint passed (no hardcoded fallback)", async () => {
    await mapInstallError(new Error("invalid signer"));
    const [content] = messageMock.mock.calls[0];
    expect(content).toBe(
      "Update verification failed — please retry or update manually.",
    );
    expect(content).not.toMatch(/https?:\/\//);
  });
});
