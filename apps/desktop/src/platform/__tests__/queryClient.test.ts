// Wave 0 — RED state.
// Asserts the contract Wave 3 () must satisfy.
// This file imports createDesktopQueryClient from '../queryClient' which does
// not yet exist. Tests will fail at import time until Wave 3 lands.

import { describe, it, expect } from "vitest";
import { NetworkOfflineError } from "@prl-wallet/api-client";
import { createDesktopQueryClient } from "../queryClient";

describe(": createDesktopQueryClient", () => {
  it("returns a QueryClient with refetchOnWindowFocus === false", () => {
    const qc = createDesktopQueryClient();
    const defaults = qc.getDefaultOptions().queries;
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    qc.clear();
  });

  it("returns a QueryClient with refetchOnReconnect === false", () => {
    const qc = createDesktopQueryClient();
    const defaults = qc.getDefaultOptions().queries;
    expect(defaults?.refetchOnReconnect).toBe(false);
    qc.clear();
  });

  it("retry returns false for NetworkOfflineError (skip retry)", () => {
    const qc = createDesktopQueryClient();
    const retry = qc.getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe("function");
    const retryFn = retry as (failureCount: number, error: Error) => boolean;
    const result = retryFn(0, new NetworkOfflineError("gate closed", "url"));
    expect(result).toBe(false);
    qc.clear();
  });

  it("retry returns true for a generic error with failureCount < 3 (standard backoff)", () => {
    const qc = createDesktopQueryClient();
    const retry = qc.getDefaultOptions().queries?.retry;
    const retryFn = retry as (failureCount: number, error: Error) => boolean;
    const result = retryFn(0, new Error("network timeout"));
    expect(result).toBe(true);
    qc.clear();
  });

  it("retry returns false for a generic error with failureCount >= 3 (3-attempt cap)", () => {
    const qc = createDesktopQueryClient();
    const retry = qc.getDefaultOptions().queries?.retry;
    const retryFn = retry as (failureCount: number, error: Error) => boolean;
    const result = retryFn(3, new Error("server error"));
    expect(result).toBe(false);
    qc.clear();
  });
});
