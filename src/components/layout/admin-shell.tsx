"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { adminNavItems } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { isActivePath } from "@/lib/url";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: ReactNode;
  /**
   * Right-aligned slot in the top bar (e.g. the logout button). A slot keeps this shared
   * layout free of imports from feature modules.
   */
  actions?: ReactNode;
};

/** Simple top-tab layout for the admin area; works on phones and desktops alike. */
export function AdminShell({ children, actions }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-card px-3 py-2 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Bỏ qua tới nội dung chính
      </a>
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 py-2 pr-3 pl-4">
          <div className="flex min-w-0 items-center gap-2">
            <span translate="no" className="truncate font-bold">
              {siteConfig.name}
            </span>
            <Badge variant="secondary" className="shrink-0">
              Quản trị
            </Badge>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </div>
        <nav aria-label="Điều hướng quản trị" className="mx-auto flex max-w-4xl gap-1 px-2">
          {adminNavItems.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4">
        {children}
      </main>
    </div>
  );
}
