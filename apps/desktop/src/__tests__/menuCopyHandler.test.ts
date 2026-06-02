// apps/desktop/src/__tests__/menuCopyHandler.test.ts
//
// Task 1 — selection-aware Cmd+C handler unit tests.
//
// handleCopyShortcut is exported from installNativeMenu.ts so its branching
// ( + ) can be unit-tested without spinning up the entire
// Tauri menu install flow:
// non-empty selection -> copy selection text
// empty selection on /wallet/:id -> copy next receive address
// empty selection elsewhere -> no-op
// empty selection on /wallet/new|import -> no-op (excluded route)
// empty selection on /wallet/:id/send/... -> no-op (only enabled at exact /wallet/:id)
// clipboard write rejection -> swallow (defensive)
// on success -> sonner toast("Copied!", { duration: 1500 })

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock sonner toast so tests can assert success-path confirmation.
const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Mock @tauri-apps/api/menu so importing installNativeMenu does not pull in
// real Tauri runtime. We do not invoke installNativeMenu here — we only
// import handleCopyShortcut — but the module-level imports must resolve.
vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: vi.fn() },
  Submenu: { new: vi.fn() },
  MenuItem: { new: vi.fn() },
  PredefinedMenuItem: { new: vi.fn() },
}));

import { handleCopyShortcut } from "@/platform/installNativeMenu";
import { buildTestBundle, seedWallet } from "./_harness/factories";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function setSelection(text: string): void {
  // jsdom implements window.getSelection — override its toString result.
  vi.spyOn(window, "getSelection").mockReturnValue({
    toString: () => text,
  } as unknown as Selection);
}

function spyClipboardSet(bundle: ReturnType<typeof buildTestBundle>): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue(undefined);
  bundle.ports.clipboard.setString = spy as unknown as typeof bundle.ports.clipboard.setString;
  return spy;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("handleCopyShortcut ( + )", () => {
  beforeEach(() => {
    mockToast.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1: non-empty selection -> copies selection (does NOT read receive address)", async () => {
    const bundle = buildTestBundle();
    const setString = spyClipboardSet(bundle);
    bundle.stores.walletList.getState().addWallet(
      seedWallet({ id: "w1", nextReceiveAddress: "tb1qreceive" }),
    );
    setSelection("abc123");

    await handleCopyShortcut(bundle, () => "/wallet/w1");

    expect(setString).toHaveBeenCalledTimes(1);
    expect(setString).toHaveBeenCalledWith("abc123");
  });

  it("Test 2: empty selection on /wallet/:id -> copies next receive address", async () => {
    const bundle = buildTestBundle();
    const setString = spyClipboardSet(bundle);
    bundle.stores.walletList.getState().addWallet(
      seedWallet({ id: "w1", nextReceiveAddress: "tb1qfromreceive" }),
    );
    setSelection("");

    await handleCopyShortcut(bundle, () => "/wallet/w1");

    expect(setString).toHaveBeenCalledTimes(1);
    expect(setString).toHaveBeenCalledWith("tb1qfromreceive");
  });

  it("Test 3: empty selection on /settings -> no-op", async () => {
    const bundle = buildTestBundle();
    const setString = spyClipboardSet(bundle);
    setSelection("");

    await handleCopyShortcut(bundle, () => "/settings");

    expect(setString).not.toHaveBeenCalled();
  });

  it("Test 4: empty selection + on /wallet/:id but no wallet found -> no-op", async () => {
    const bundle = buildTestBundle();
    const setString = spyClipboardSet(bundle);
    setSelection("");

    await handleCopyShortcut(bundle, () => "/wallet/missing");

    expect(setString).not.toHaveBeenCalled();
  });

  it("Test 5: empty selection on /wallet/:id/send/address -> no-op (only enabled at exact /wallet/:id)", async () => {
    const bundle = buildTestBundle();
    const setString = spyClipboardSet(bundle);
    bundle.stores.walletList.getState().addWallet(
      seedWallet({ id: "w1", nextReceiveAddress: "tb1qreceive" }),
    );
    setSelection("");

    await handleCopyShortcut(bundle, () => "/wallet/w1/send/address");

    expect(setString).not.toHaveBeenCalled();
  });

  it("Test 6: defensive — clipboard.setString throws, handler must catch and not propagate", async () => {
    const bundle = buildTestBundle();
    const failingSpy = vi.fn().mockRejectedValue(new Error("clipboard fail"));
    bundle.ports.clipboard.setString =
      failingSpy as unknown as typeof bundle.ports.clipboard.setString;
    bundle.stores.walletList.getState().addWallet(
      seedWallet({ id: "w1", nextReceiveAddress: "tb1q" }),
    );
    setSelection("");

    // Must not throw / reject.
    await expect(
      handleCopyShortcut(bundle, () => "/wallet/w1"),
    ).resolves.toBeUndefined();
  });

  it("Test 7a: sonner toast fires with locked copy + 1500ms duration on selection-copy success", async () => {
    const bundle = buildTestBundle();
    spyClipboardSet(bundle);
    setSelection("hello");

    await handleCopyShortcut(bundle, () => "/wallet/w1");

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("Copied!", { duration: 1500 });
  });

  it("Test 7b: sonner toast fires on receive-address-copy success", async () => {
    const bundle = buildTestBundle();
    spyClipboardSet(bundle);
    bundle.stores.walletList.getState().addWallet(
      seedWallet({ id: "w1", nextReceiveAddress: "tb1q" }),
    );
    setSelection("");

    await handleCopyShortcut(bundle, () => "/wallet/w1");

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("Copied!", { duration: 1500 });
  });
});
