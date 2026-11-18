import {
  BanIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  ClockIcon,
  KeyRoundIcon,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { formatDateTime } from "@/lib/date/format";
import { cn } from "@/lib/utils";
import { type AccessCodeStatus, getAccessCodeStatus } from "@/modules/admin/access-code-status";
import { RevokeAccessCodeButton } from "@/modules/admin/components/revoke-access-code-button";
import { ACCESS_CODE_LIST_LIMIT } from "@/modules/admin/constants";
import type { AccessCodeListItem } from "@/modules/admin/server/queries";

const STATUS_DISPLAY: Record<
  AccessCodeStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  active: { label: "Còn hạn", icon: ClockIcon, className: "text-primary" },
  used: { label: "Đã dùng", icon: CircleCheckIcon, className: "text-foreground" },
  expired: { label: "Hết hạn", icon: CircleSlashIcon, className: "text-muted-foreground" },
  revoked: { label: "Đã huỷ", icon: BanIcon, className: "text-muted-foreground" },
};

type AccessCodeListProps = { items: AccessCodeListItem[]; now: Date };

/** "Mã đã tạo": every code with exactly one status, never the code itself (spec access-codes). */
export function AccessCodeList({ items, now }: AccessCodeListProps) {
  return (
    <section aria-labelledby="code-list-title" className="grid min-w-0 gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="code-list-title" className="text-[1.05rem] font-bold">
          Mã đã tạo
        </h2>
        {items.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {items.length >= ACCESS_CODE_LIST_LIMIT
              ? `${items.length} mã mới nhất`
              : `${items.length} mã`}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={KeyRoundIcon}
          title="Chưa có mã nào"
          description="Tạo mã đầu tiên ở trên rồi gửi cho bác sĩ qua Zalo."
          className="rounded-2xl border bg-card"
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card">
          {items.map((item) => (
            <AccessCodeRow key={item.id} item={item} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AccessCodeRow({ item, now }: { item: AccessCodeListItem; now: Date }) {
  const status = getAccessCodeStatus(item, now);
  const display = STATUS_DISPLAY[status];
  const Icon = display.icon;

  return (
    <li
      data-status={status}
      className="flex min-w-0 items-center gap-3 py-3 pr-3 pl-4 not-first:border-t"
    >
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span
          className={cn(
            "truncate font-semibold",
            status === "revoked" && "text-muted-foreground line-through decoration-1",
          )}
        >
          {item.recipientName}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className={cn("inline-flex items-center gap-1.5 font-semibold", display.className)}>
            <Icon className="size-4" aria-hidden />
            {display.label}
          </span>
          <StatusDetail item={item} status={status} />
        </span>
        <span className="text-[0.8rem] text-muted-foreground">
          Tạo {formatDateTime(item.createdAt)}
        </span>
      </div>
      {status === "active" ? (
        <RevokeAccessCodeButton id={item.id} recipientName={item.recipientName} />
      ) : null}
    </li>
  );
}

function StatusDetail({ item, status }: { item: AccessCodeListItem; status: AccessCodeStatus }) {
  switch (status) {
    case "active":
      return <span className="text-muted-foreground">đến {formatDateTime(item.expiresAt)}</span>;
    case "used":
      return (
        <span className="text-muted-foreground">
          {item.usedByUsername ? (
            <>
              <span translate="no" className="font-semibold text-foreground">
                {item.usedByUsername}
              </span>
              ,{" "}
            </>
          ) : null}
          {item.usedAt ? formatDateTime(item.usedAt) : null}
        </span>
      );
    case "expired":
      return <span className="text-muted-foreground">{formatDateTime(item.expiresAt)}</span>;
    case "revoked":
      return (
        <span className="text-muted-foreground">
          {item.revokedAt ? formatDateTime(item.revokedAt) : null}
        </span>
      );
  }
}
