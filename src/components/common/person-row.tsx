import { ChevronRightIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { InitialsAvatar } from "@/components/common/initials-avatar";

type PersonRowProps = {
  href: Route;
  name: string;
  /** Secondary line, e.g. "Nam · 47 tuổi · Nghệ An". Omitted when empty. */
  meta?: string;
  /** Small extra line under the meta, e.g. where a search matched. */
  hint?: ReactNode;
  /** App URL of the person's picture; initials otherwise. */
  avatarSrc?: string | null;
};

/**
 * One person in a list: picture or initials, a one-line name (truncated, never overflowing at 360 px), an
 * optional meta line and hint, and a chevron. Props are plain values so any module can use it.
 * Render it inside an `<li>`.
 */
export function PersonRow({ href, name, meta, hint, avatarSrc }: PersonRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-16 min-w-0 items-center gap-3 py-2.5 pr-3 pl-3.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <InitialsAvatar name={name} src={avatarSrc ?? null} />
      <span className="grid min-w-0 flex-1 gap-px">
        <span className="truncate font-semibold">{name}</span>
        {meta ? <span className="truncate text-sm text-muted-foreground">{meta}</span> : null}
        {hint}
      </span>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
