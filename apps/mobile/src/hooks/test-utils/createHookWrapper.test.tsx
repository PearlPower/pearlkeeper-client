import { renderHook } from "@testing-library/react-native";
import { useQueryClient } from "@tanstack/react-query";
import { createHookWrapper } from "./createHookWrapper";

describe("createHookWrapper", () => {
  it("creates a fresh query client with retries disabled", () => {
    const firstWrapper = createHookWrapper();
    const secondWrapper = createHookWrapper();

    const { result: firstResult } = renderHook(() => useQueryClient(), {
      wrapper: firstWrapper,
    });
    const { result: secondResult } = renderHook(() => useQueryClient(), {
      wrapper: secondWrapper,
    });

    expect(firstResult.current).not.toBe(secondResult.current);
    expect(firstResult.current.getDefaultOptions().queries?.retry).toBe(false);
    expect(firstResult.current.getDefaultOptions().mutations?.retry).toBe(
      false,
    );
  });
});
