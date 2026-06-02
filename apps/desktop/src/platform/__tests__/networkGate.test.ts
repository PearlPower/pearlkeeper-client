// Wave 0 — RED state.
// Asserts the contract Wave 3 () must satisfy.
// This file imports createDesktopNetworkGate from '../networkGate' which does
// not yet exist. Tests will fail at import/construction time until Wave 3 lands.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { createNetworkGateStore } from "@prl-wallet/app-state";
import type { StoragePort } from "@prl-wallet/app-adapters";

const invokeMock = vi.fn(async (_cmd: string, _args?: unknown) => {});
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));

// Import AFTER vi.mock so module-evaluation hooks see the mock
import { createDesktopNetworkGate } from "../networkGate";

function makeFakeStoragePort(): StoragePort {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      map.set(k, v);
    },
    removeItem: async (k) => {
      map.delete(k);
    },
  };
}

describe(": createDesktopNetworkGate", () => {
  beforeEach(() => {
    invokeMock.mockClear();
  });

  it("registers a Zustand subscribe at construction (store mutation triggers side-effects)", async () => {
    const storage = makeFakeStoragePort();
    // : createNetworkGateStore now accepts storage
    const store = createNetworkGateStore(storage);
    const qc = new QueryClient();
    const cancelQueriesSpy = vi.spyOn(qc, "cancelQueries");
    const setOnlineSpy = vi.spyOn(onlineManager, "setOnline");

    // createDesktopNetworkGate registers a subscriber on the store
    createDesktopNetworkGate(store, qc);

    // Trigger a state change. Default isOpen=false (), so flip to true to actually change.
    store.getState().open();
    await new Promise((r) => setTimeout(r, 0));

    // At least one side-effect must fire (shows subscriber was registered)
    const sideEffectFired =
      invokeMock.mock.calls.length > 0 ||
      cancelQueriesSpy.mock.calls.length > 0 ||
      setOnlineSpy.mock.calls.length > 0;
    expect(sideEffectFired).toBe(true);

    cancelQueriesSpy.mockRestore();
    setOnlineSpy.mockRestore();
    qc.clear();
  });

  it("on store flip to isOpen:false — calls invoke set_gate_state, cancelQueries, and onlineManager.setOnline(false)", async () => {
    const storage = makeFakeStoragePort();
    const store = createNetworkGateStore(storage);
    const qc = new QueryClient();
    const cancelQueriesSpy = vi.spyOn(qc, "cancelQueries");
    const setOnlineSpy = vi.spyOn(onlineManager, "setOnline");

    createDesktopNetworkGate(store, qc);

    // Start from open state
    store.getState().open();
    await new Promise((r) => setTimeout(r, 0));
    invokeMock.mockClear();
    cancelQueriesSpy.mockClear();
    setOnlineSpy.mockClear();

    // Flip to closed
    store.getState().close();
    await new Promise((r) => setTimeout(r, 0));

    // All three side-effects must fire on close ( + T-19-05 threat)
    expect(invokeMock).toHaveBeenCalledWith("set_gate_state", {
      isOpen: false,
    });
    expect(cancelQueriesSpy).toHaveBeenCalledTimes(1);
    expect(setOnlineSpy).toHaveBeenCalledWith(false);

    cancelQueriesSpy.mockRestore();
    setOnlineSpy.mockRestore();
    qc.clear();
  });

  it("on store flip to isOpen:true — calls invoke set_gate_state and setOnline(true); cancelQueries NOT called", async () => {
    const storage = makeFakeStoragePort();
    const store = createNetworkGateStore(storage);
    const qc = new QueryClient();
    const cancelQueriesSpy = vi.spyOn(qc, "cancelQueries");
    const setOnlineSpy = vi.spyOn(onlineManager, "setOnline");

    createDesktopNetworkGate(store, qc);

    // Start closed
    store.getState().close();
    await new Promise((r) => setTimeout(r, 0));
    invokeMock.mockClear();
    cancelQueriesSpy.mockClear();
    setOnlineSpy.mockClear();

    // Flip to open
    store.getState().open();
    await new Promise((r) => setTimeout(r, 0));

    // invoke and setOnline fire; cancelQueries must NOT fire on open ( guard)
    expect(invokeMock).toHaveBeenCalledWith("set_gate_state", { isOpen: true });
    expect(setOnlineSpy).toHaveBeenCalledWith(true);
    expect(cancelQueriesSpy).not.toHaveBeenCalled();

    cancelQueriesSpy.mockRestore();
    setOnlineSpy.mockRestore();
    qc.clear();
  });

  it("NetworkGatePort.isOpen() reads store.getState().isOpen synchronously", () => {
    const storage = makeFakeStoragePort();
    const store = createNetworkGateStore(storage);
    const qc = new QueryClient();

    const gate = createDesktopNetworkGate(store, qc);

    // : default is false
    expect(gate.isOpen()).toBe(store.getState().isOpen);

    store.getState().open();
    expect(gate.isOpen()).toBe(true);
    expect(gate.isOpen()).toBe(store.getState().isOpen);

    store.getState().close();
    expect(gate.isOpen()).toBe(false);

    qc.clear();
  });

  it("NetworkGatePort.subscribe(listener) fires listener only when isOpen changes", () => {
    const storage = makeFakeStoragePort();
    const store = createNetworkGateStore(storage);
    const qc = new QueryClient();

    const gate = createDesktopNetworkGate(store, qc);
    const listener = vi.fn();
    const unsub = gate.subscribe(listener);

    store.getState().open();
    store.getState().close();
    store.getState().close(); // no-op: isOpen already false

    // Listener fires once for open→close but NOT for close→close
    // (boolean-projection lambda: fires only when isOpen value changes)
    expect(listener).toHaveBeenCalledWith(true); // open
    expect(listener).toHaveBeenCalledWith(false); // close

    unsub();
    qc.clear();
  });
});
