// apps/desktop/src/components/PINGrid.tsx
//
// () — Reusable 6-digit PIN entry grid.
// 5 future consumers: PINCreate, PINConfirm, PINUnlock, ChangePIN (3 sub-steps),
// and 's "re-PIN before reveal" gate (SECUX-03 second half).
// Props contract is LOCKED — wraps, never refactors.
//
// Behavior contract (UI-SPEC §"PIN Grid Sizing", , RESEARCH.md Pitfall 2):
// Renders 6 cells; cell `i` shows `•` when value.length > i, `_` otherwise
// Filled cells: bg-primary text-primary-foreground; empty: bg-muted text-muted-foreground
// Cell sizing: size-12 (48×48), gap-2 (8px), rounded-md
// Hidden numeric input behind cells (T-20-05 password-manager suppression):
// type="password", inputMode="numeric", autoComplete="off", aria-hidden="true",
// NO `name` attribute
// Click on grid → focus hidden input
// Auto-submit on 6th digit (deduplicated via submittedRef — Pitfall 2)
// Shake animation on `shake=true` (350ms, respects prefers-reduced-motion)
// Disabled during lockout: opacity-50 + aria-disabled="true"

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface PINGridProps {
  value: string;
  onChange: (next: string) => void;
  onComplete: (pin: string) => void;
  shake?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PINGrid({
  value,
  onChange,
  onComplete,
  shake,
  disabled,
  autoFocus,
}: PINGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Pitfall 2 dedup ref — must NOT be state. Refs do not trigger re-renders;
  // state would re-trigger the effect and cause double `onComplete` fires
  // when the parent updates the parent's `value` ref.
  const submittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === 6 && submittedRef.current !== value) {
      submittedRef.current = value;
      onComplete(value);
    }
    if (value.length < 6) submittedRef.current = null;
  }, [value, onComplete]);

  // IN-07: include `disabled` in deps so the input regains focus when a
  // lockout/saving state flips back to enabled. The native focus() call
  // is a no-op while the input has the disabled attribute, so without
  // re-running this effect the grid would stay unfocused after recovery
  // and force the user to click before they can resume typing.
  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled]);

  return (
    <div
      role="group"
      aria-label="PIN entry — 6 digits"
      aria-disabled={disabled || undefined}
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex gap-2 cursor-text relative",
        shake && "animate-shake",
        disabled && "opacity-50",
      )}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const filled = value.length > i;
        return (
          <div
            key={i}
            className={cn(
              "size-12 rounded-md border border-border flex items-center justify-center text-xl font-semibold tabular-nums",
              filled
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {filled ? "•" : "_"}
          </div>
        );
      })}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="\d*"
        maxLength={6}
        autoComplete="off"
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(next);
        }}
        className="absolute inset-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}
