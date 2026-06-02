export const RUNTIME_PORT_METHODS = ["now", "createId"] as const;

export interface ServicesRuntime {
  now(): number;
  createId(): string;
}
