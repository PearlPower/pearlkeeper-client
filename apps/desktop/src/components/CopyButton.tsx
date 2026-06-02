// apps/desktop/src/components/CopyButton.tsx
//
// reusable Copy button used by ReceiveScreen + SendSuccessScreen
// (existing label-driven API preserved verbatim — invariant /
// composition-over-modification).
//
// () — icon-only variant. Self-contained 1.5s timer for the
// Copy↔Check swap. Used by every NEW Phase-23 surface (WalletDetailScreen txid
// hover-reveal, next-receive-address row, SendReviewScreen recipient address)
// and by the menu's Cmd+C handler in .
//
// Composition over modification — invariant. ReceiveScreen and
// SendSuccessScreen do NOT change; their `{ onCopy, label, className, disabled }`
// API is preserved bit-for-bit ( contract).
//
// API shape (discriminated union):
// <CopyButton onCopy={...} label="Copy" /> // full-button (default)
// <CopyButton variant="icon" onCopy={...} ariaLabel="Copy address" /> // icon-only
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FullButtonProps {
  /** Default — full-button mode (label-driven by consumer). */
  variant?: "full";
  onCopy: () => void | Promise<void>;
  label?: "Copy" | "Copied!";
  className?: string;
  disabled?: boolean;
}

interface IconOnlyProps {
  /** icon-only mode — component owns its 1.5s timer. */
  variant: "icon";
  onCopy: () => void | Promise<void>;
  /** Locked aria-label per UI-SPEC §Copywriting Contract. Examples:
   * "Copy transaction ID", "Copy address", "Copy recipient address". */
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export type CopyButtonProps = FullButtonProps | IconOnlyProps;

/** UI-SPEC §Animation Contract — 1.5s hold matching visual. */
const COPIED_HOLD_MS = 1500;

export function CopyButton(props: CopyButtonProps) {
  if (props.variant === "icon") {
    return <IconOnlyCopyButton {...props} />;
  }
  // Default branch = full-button — preserved VERBATIM.
  const { onCopy, label = "Copy", className, disabled } = props;
  const isCopied = label === "Copied!";
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void onCopy()}
      disabled={disabled}
      aria-label={isCopied ? "Address copied" : "Copy address"}
      aria-live="polite"
      className={cn(
        "gap-2 transition-colors duration-150",
        isCopied && "border-primary",
        className,
      )}
    >
      {isCopied ? (
        <Check className="size-4 text-primary" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      {label}
    </Button>
  );
}

function IconOnlyCopyButton({
  onCopy,
  ariaLabel,
  className,
  disabled,
}: IconOnlyProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount — never leak a timer (StrictMode-safe).
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // T-23-13: prevent parent row-click handlers (e.g. WalletDetail tx row →
    // explorer link) from firing alongside the copy. invariant.
    event.stopPropagation();

    // Fire-and-forget — Promise<void> still triggers the swap synchronously.
    void onCopy();
    setIsCopied(true);

    // T-23-14: clear any pending timer before scheduling a new one — rapid
    // clicks must not stack stale timeouts.
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsCopied(false);
      timeoutRef.current = null;
    }, COPIED_HOLD_MS);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={disabled}
      aria-label={isCopied ? "Copied" : ariaLabel}
      aria-live="polite"
      className={cn(
        "transition-colors duration-150 hover:text-primary",
        className,
      )}
    >
      {isCopied ? (
        <Check className="size-4 text-primary" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
    </Button>
  );
}
