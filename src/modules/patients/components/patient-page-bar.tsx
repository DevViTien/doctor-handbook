import { ArrowLeftIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

type PatientPageBarProps = {
  backHref: Route;
  /** Visible text of the back link; without it the link shows only an arrow labelled "Quay lại". */
  backLabel?: string;
  /** Page title (`h1`) shown next to the back link, e.g. "Thêm bệnh nhân". */
  title?: string;
  actions?: ReactNode;
};

/** Top bar of the patient sub-pages: a 44 px back link, an optional title and actions. */
export function PatientPageBar({ backHref, backLabel, title, actions }: PatientPageBarProps) {
  return (
    <div className="flex min-w-0 items-center gap-1 py-1.5">
      <Link
        href={backHref}
        aria-label={backLabel ? undefined : "Quay lại"}
        className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg px-2 text-[0.95rem] font-semibold hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring"
      >
        <ArrowLeftIcon className="size-5" aria-hidden />
        {backLabel}
      </Link>
      {title ? <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1> : null}
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
