import {
  performFirstBootWipeIfNeeded,
  V1_SECURE_KEYS,
  type FirstBootWipeOptions,
} from "../firstBootWipe.js";

function makePorts(
  overrides: Partial<FirstBootWipeOptions> = {},
): FirstBootWipeOptions {
  return {
    getDataVersion: async (_key: string) => null,
    setDataVersion: async (_key: string, _value: string) => undefined,
    clearAllData: async () => undefined,
    deleteSecureKeys: async (_keys: readonly string[]) => undefined,
    ...overrides,
  };
}

describe("performFirstBootWipeIfNeeded (SC-3)", () => {
  it("wipes v1.0 flat SecureStore keys and AsyncStorage on first boot", async () => {
    const getDataVersion = jest.fn<Promise<string | null>, [string]>(
      async () => null,
    );
    const setDataVersion = jest.fn<Promise<void>, [string, string]>(
      async () => undefined,
    );
    const clearAllData = jest.fn<Promise<void>, []>(async () => undefined);
    const deleteSecureKeys = jest.fn<Promise<void>, [readonly string[]]>(
      async () => undefined,
    );
    const ports = makePorts({
      getDataVersion,
      setDataVersion,
      clearAllData,
      deleteSecureKeys,
    });

    await performFirstBootWipeIfNeeded(ports);

    expect(deleteSecureKeys).toHaveBeenCalledWith(V1_SECURE_KEYS);
    expect(clearAllData).toHaveBeenCalledTimes(1);
    expect(setDataVersion).toHaveBeenCalledWith("prl_data_version", "2");
  });

  it("is a no-op on subsequent boots (version marker already set)", async () => {
    const getDataVersion = jest.fn<Promise<string | null>, [string]>(
      async () => "2",
    );
    const setDataVersion = jest.fn<Promise<void>, [string, string]>(
      async () => undefined,
    );
    const clearAllData = jest.fn<Promise<void>, []>(async () => undefined);
    const deleteSecureKeys = jest.fn<Promise<void>, [readonly string[]]>(
      async () => undefined,
    );
    const ports = makePorts({
      getDataVersion,
      setDataVersion,
      clearAllData,
      deleteSecureKeys,
    });

    await performFirstBootWipeIfNeeded(ports);

    expect(deleteSecureKeys).not.toHaveBeenCalled();
    expect(clearAllData).not.toHaveBeenCalled();
    expect(setDataVersion).not.toHaveBeenCalled();
  });
});
