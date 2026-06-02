export function formatImportError(error: unknown): string {
  const message =
    error instanceof Error && error.message ? error.message : String(error);
  return `Import failed: ${message}`;
}
