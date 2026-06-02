// packages/app-flows/src/flows/formatBroadcastError.ts
// format a broadcast/sign error as a human-readable string.
// Mirrors the pattern of formatImportError.ts. Used by SendReviewScreen
// to surface sign-failed inline card text and the sonner broadcast-failed toast.
export function formatBroadcastError(error: unknown): string {
  const message =
    error instanceof Error && error.message ? error.message : String(error);
  return message;
}
