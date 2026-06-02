// apps/desktop/src/components/HoldToReveal.tsx
//
// Round-2 (UAT Test 6, 2026-04-30) — Switch-based reveal.
//
// Round-1 used a button-shaped div whose label sat absolutely-positioned
// over the (blurred) phrase children. The user reported that the overlay
// looked like a rendering bug and asked for a real toggle switch separated
// from the content. This rewrite uses shadcn `<Switch>` with an adjacent
// `<Label>` placed BELOW the children — there is no control overlapping
// the phrase area at any state.
//
// wrap-not-rewrite invariant preserved ( ):
// Component name unchanged (`HoldToReveal`).
// Exported prop names unchanged (onRevealStart, onReveal, onHide,
// disabled, label, children, holdMs-deprecated-but-accepted).
// `disabled` semantics: when set to true while revealed, the secret is
// hidden and onHide fires once — wrappers can revoke an
// in-progress reveal by toggling disabled (re-PIN expiry, window-blur).
//
// : additive `gate?: () => Promise<boolean>` prop is the
// Pitfall-1 race mitigation; existing toggle behavior is unchanged when
// prop omitted. The gate is ONLY awaited on the reveal path (next=true);
// the hide path (next=false) is never gated ().
//
// Keyboard contract:
// Space toggles (handled natively by Radix Switch).
// Enter toggles (added via onKeyDown — Radix Switch ignores Enter by
// default; we override to keep the existing user contract).
// Escape while revealed hides (matches Round-1 behavior).

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface HoldToRevealProps {
  /** @deprecated retained for compatibility; ignored by the toggle implementation. */
  holdMs?: number;
  onRevealStart?: () => void;
  onReveal?: () => void;
  onHide?: () => void;
  disabled?: boolean;
  /** : optional gate for Pitfall-1 race mitigation. When provided,
   * awaited BEFORE setRevealed(true). If it resolves false (or throws), the reveal
   * is suppressed. Never called on the hide path (). */
  gate?: () => Promise<boolean>;
  children: ReactNode;
  label?: string;
}

export function HoldToReveal({
  holdMs: _holdMs,
  onRevealStart,
  onReveal,
  onHide,
  disabled,
  gate,
  children,
  label = "Show seed phrase",
}: HoldToRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const switchId = useId();

  const setRevealedAndNotify = useCallback(
    async (next: boolean) => {
      if (disabled) return;
      if (next) {
        if (gate) {
          try {
            const ok = await gate();
            if (!ok) return;
          } catch {
            return; // gate threw — treat as denial
          }
        }
        onRevealStart?.();
        setRevealed(true);
        onReveal?.();
      } else {
        setRevealed(false);
        onHide?.();
      }
    },
    [disabled, gate, onRevealStart, onReveal, onHide],
  );

  // Disabled-flip while revealed: hide and fire onHide. Closure captures
  // `revealed` from the render where disabled flipped to true.
  useEffect(() => {
    if (disabled && revealed) {
      setRevealed(false);
      onHide?.();
    }
  }, [disabled, revealed, onHide]);

  // Space + Enter toggle; Escape hides while revealed.
  // Radix Switch handles Space via internal pointer logic that doesn't
  // fire under fireEvent.keyDown in jsdom, so we own the keyboard contract
  // explicitly to keep behavior consistent across real browsers and tests.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const isSpace = e.key === " " || e.key === "Spacebar" || e.code === "Space";
    if (e.key === "Enter" || isSpace) {
      e.preventDefault();
      setRevealedAndNotify(!revealed);
    } else if (e.key === "Escape" || e.key === "Esc") {
      if (revealed) {
        e.preventDefault();
        setRevealedAndNotify(false);
      }
    }
  };

  const visibleLabel = revealed ? label.replace(/^Show /, "Hide ") : label;

  return (
    <div className="space-y-4">
      {/* Phrase content — no overlapping controls. Blurred + dimmed when hidden. */}
      <div
        data-testid="hold-to-reveal-content"
        aria-hidden={!revealed}
        className={cn(
          "rounded-md border border-border bg-muted/40 p-4 transition-[filter,opacity] duration-150",
          revealed
            ? "opacity-100"
            : "opacity-60 blur-sm select-none pointer-events-none",
        )}
      >
        {children}
      </div>

      {/* Toggle row — clearly distinct from content. */}
      <div className="flex items-center gap-3">
        <Switch
          id={switchId}
          checked={revealed}
          onCheckedChange={setRevealedAndNotify}
          onKeyDown={onKeyDown}
          disabled={disabled}
          aria-label={visibleLabel}
        />
        <Label
          htmlFor={switchId}
          className="cursor-pointer select-none text-sm"
        >
          {visibleLabel}
        </Label>
      </div>
    </div>
  );
}
