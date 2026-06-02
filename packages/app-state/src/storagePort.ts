export const STORAGE_PORT_METHODS = [
  "getItem",
  "setItem",
  "removeItem",
] as const;

export interface StoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
