import { cn } from "@/lib/utils";

/**
 * The app's mark: a notebook with an ink pen (the paper notebook the app replaces).
 * Decorative; colors come from theme tokens so it follows light/dark mode.
 */
export function AppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-10 shrink-0", className)}>
      <rect x="6" y="3" width="26" height="34" rx="4" className="fill-primary" />
      <rect x="6" y="3" width="6" height="34" rx="3" className="fill-foreground opacity-25" />
      <path
        d="M16 13h11M16 19h11M16 25h7"
        className="stroke-primary-foreground opacity-90"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M30.5 22.5 36 17l2 2-5.5 5.5-2.8.8z" className="fill-foreground" />
    </svg>
  );
}
