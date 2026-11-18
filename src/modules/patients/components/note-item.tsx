import { CircleAlertIcon, WifiOffIcon } from "lucide-react";
import { Fragment } from "react";

import { formatDateTime } from "@/lib/date/format";
import { splitLinks } from "@/lib/text/linkify";
import { NOTE_MESSAGES } from "@/modules/patients/constants";

type NoteItemProps = {
  content: string;
  /** `null` while a new note has not reached the server yet ("Vừa ghi"). */
  createdAt: string | null;
  updatedAt: string | null;
  /** Its latest text is not on the server: waiting for the network, or refused by it. */
  unsent?: "waiting" | "refused" | undefined;
  onEdit: () => void;
};

/** Note text: line breaks kept, `http(s)` links clickable, never interpreted as HTML. */
export function NoteText({ content }: { content: string }) {
  return (
    <p className="pr-2 leading-relaxed break-words whitespace-pre-wrap">
      {splitLinks(content).map((part, index) =>
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
  );
}

/**
 * One note of the timeline (spec patient-notes): creation time in bold, "Đã sửa …" on its own
 * line when edited with "Sửa" (at 390 px both on one line would break the time), then the text.
 */
export function NoteItem({ content, createdAt, updatedAt, unsent, onEdit }: NoteItemProps) {
  const created = createdAt ? formatDateTime(createdAt) : "Vừa ghi";
  const edited =
    createdAt && updatedAt && new Date(updatedAt) > new Date(createdAt)
      ? formatDateTime(updatedAt)
      : null;

  return (
    <article className="grid gap-1 pt-2.5 pr-2 pb-3.5 pl-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid min-w-0">
          <span className="text-sm font-bold whitespace-nowrap tabular-nums">{created}</span>
          {edited ? (
            <span className="text-[0.8rem] text-muted-foreground tabular-nums">
              Đã sửa {edited}
            </span>
          ) : null}
        </span>
        {unsent === "waiting" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[0.78rem] font-semibold text-warning">
            <WifiOffIcon className="size-3.5" aria-hidden />
            {NOTE_MESSAGES.offline}
          </span>
        ) : unsent === "refused" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[0.78rem] font-semibold text-destructive">
            <CircleAlertIcon className="size-3.5" aria-hidden />
            {NOTE_MESSAGES.refused}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Sửa ghi chú lúc ${created}`}
          className="ml-auto min-h-11 min-w-11 rounded-lg px-2.5 text-[0.9rem] font-semibold text-primary hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring"
        >
          Sửa
        </button>
      </div>
      <NoteText content={content} />
    </article>
  );
}
