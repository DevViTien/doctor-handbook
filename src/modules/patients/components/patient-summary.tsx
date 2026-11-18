import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { splitLinks } from "@/lib/text/linkify";

/**
 * "Tóm tắt" card, shown only on the detail page (S7). Line breaks are kept; `http(s)` addresses
 * become links (spec "Liên kết trong tóm tắt"). Everything is rendered as React text: the summary
 * can never inject markup. `noreferrer` keeps the patient URL out of the Referer header.
 */
export function PatientSummary({ summary, editHref }: { summary: string | null; editHref: Route }) {
  return (
    <section
      aria-labelledby="patient-summary-heading"
      className="grid gap-2 rounded-2xl border bg-card px-4 pt-3.5 pb-4"
    >
      <h2
        id="patient-summary-heading"
        className="text-[0.95rem] font-semibold text-muted-foreground"
      >
        Tóm tắt
      </h2>
      {summary ? (
        <p className="leading-relaxed break-words whitespace-pre-wrap">
          {splitLinks(summary).map((part, index) =>
            part.type === "link" ? (
              <a
                key={index}
                href={part.value}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium break-all text-primary underline underline-offset-3"
              >
                {part.value}
              </a>
            ) : (
              <Fragment key={index}>{part.value}</Fragment>
            ),
          )}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">Chưa có tóm tắt.</p>
          <Link
            href={editHref}
            className="inline-flex min-h-11 items-center justify-self-start font-semibold text-primary underline underline-offset-3"
          >
            Thêm tóm tắt
          </Link>
        </>
      )}
    </section>
  );
}
