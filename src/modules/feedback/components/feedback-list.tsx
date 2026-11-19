import { MessageSquareTextIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/date/format";
import { cn } from "@/lib/utils";
import { DeleteFeedbackButton } from "@/modules/feedback/components/delete-feedback-button";
import { MarkSeenButton } from "@/modules/feedback/components/mark-seen-button";
import { FEEDBACK_LIST_TITLE_ID, FEEDBACK_MESSAGES } from "@/modules/feedback/constants";
import { describeDevice } from "@/modules/feedback/device";
import type { FeedbackInbox, FeedbackListItem } from "@/modules/feedback/server/queries";

/** The admin's "Hộp thư": newest feedback first (spec feedback "Admin đọc góp ý"). */
export function FeedbackList({ inbox }: { inbox: FeedbackInbox }) {
  if (inbox.items.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareTextIcon}
        title="Chưa có góp ý nào"
        description="Bác sĩ gửi góp ý ở Cài đặt → Góp ý. Góp ý mới sẽ hiện ở đây."
        className="rounded-2xl border bg-card"
      />
    );
  }

  return (
    <section aria-labelledby={FEEDBACK_LIST_TITLE_ID} className="grid min-w-0 gap-3">
      <div className="flex items-baseline justify-between gap-2">
        {/* Focusable: takes focus when the feedback whose button had it is deleted. */}
        <h2
          id={FEEDBACK_LIST_TITLE_ID}
          tabIndex={-1}
          className="rounded-sm text-[1.05rem] font-bold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Hộp thư
        </h2>
        <p className="text-sm text-muted-foreground">
          {inbox.unseen > 0 ? (
            <>
              <b className="font-semibold text-foreground">{inbox.unseen} mới</b> ·{" "}
            </>
          ) : null}
          {inbox.total} góp ý
        </p>
      </div>
      <ul className="grid gap-2.5">
        {inbox.items.map((item) => (
          <FeedbackItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function FeedbackItem({ item }: { item: FeedbackListItem }) {
  const isNew = item.seenAt === null;
  const sentAt = formatDateTime(item.createdAt);
  const sender = item.senderName ?? FEEDBACK_MESSAGES.deletedAccount;

  return (
    <li
      aria-label={`Góp ý của ${sender}, ${sentAt}`}
      className={cn(
        "relative grid min-w-0 gap-2 overflow-hidden rounded-2xl border bg-card py-3.5 pr-3.5 pl-4",
        // Secondary cue only: the "Mới" label is the signal.
        isNew && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "min-w-0 truncate",
            item.senderName ? "font-semibold" : "font-medium text-muted-foreground italic",
          )}
        >
          {sender}
        </span>
        {isNew ? <Badge className="shrink-0 font-bold">Mới</Badge> : null}
      </div>
      <p className="-mt-1 flex flex-wrap gap-x-1.5 text-[0.8rem] text-muted-foreground">
        {item.senderUsername ? (
          <span translate="no" className="font-semibold text-foreground">
            {item.senderUsername} ·
          </span>
        ) : null}
        {/* Separators end a part, so a wrapped line never starts with "·". */}
        <span>{sentAt} ·</span>
        <span>{describeDevice(item.userAgent)}</span>
      </p>
      <p className="leading-relaxed wrap-anywhere whitespace-pre-wrap">{item.content}</p>
      <div className="flex flex-wrap justify-end gap-2 *:flex-1 md:*:flex-none">
        {isNew ? <MarkSeenButton id={item.id} /> : null}
        <DeleteFeedbackButton id={item.id} sender={sender} sentAt={sentAt} content={item.content} />
      </div>
    </li>
  );
}
