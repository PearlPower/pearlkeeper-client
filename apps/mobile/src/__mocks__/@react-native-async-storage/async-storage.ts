const _store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return _store.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    _store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    _store.delete(key);
  },
  async clear(): Promise<void> {
    _store.clear();
  },
  async getAllKeys(): Promise<readonly string[]> {
    return Array.from(_store.keys());
  },
  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach((k) => _store.delete(k));
  },
  __resetStore(): void {
    _store.clear();
  },
  __getStore(): Map<string, string> {
    return _store;
  },
};

export default AsyncStorage;
