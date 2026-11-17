"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { adminNavItems } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { isActivePath } from "@/lib/url";
import { cn } from "@/lib/utils";

/** Simple top-tab layout for the admin area; works on phones and desktops alike. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="font-semibold">{siteConfig.name} · Quản trị</span>
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
                  "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
      <main className="mx-auto w-full max-w-4xl flex-1 px-4">{children}</main>
    </div>
  );
}
