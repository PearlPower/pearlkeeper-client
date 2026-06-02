const _store = new Map<string, string>();

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 1;

export async function setItemAsync(
  key: string,
  value: string,
  _options?: unknown,
): Promise<void> {
  _store.set(key, value);
}

export async function getItemAsync(
  key: string,
  _options?: unknown,
): Promise<string | null> {
  return _store.get(key) ?? null;
}

export async function deleteItemAsync(
  key: string,
  _options?: unknown,
): Promise<void> {
  _store.delete(key);
}

/** Test helper: reset state between tests */
export function __resetStore(): void {
  _store.clear();
}

export function __getStore(): Map<string, string> {
  return _store;
}
