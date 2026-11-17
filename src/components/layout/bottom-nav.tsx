"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { doctorNavItems } from "@/config/navigation";
import { isActivePath } from "@/lib/url";
import { cn } from "@/lib/utils";

/**
 * Thumb-reachable navigation fixed to the bottom of the screen (idea.md §4.3).
 * Respects the iOS home-indicator safe area.
 *
 * Reads `doctorNavItems` itself instead of taking them as a prop: the items hold icon
 * components (functions), which cannot be passed from a Server Component to a Client Component.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {doctorNavItems.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
