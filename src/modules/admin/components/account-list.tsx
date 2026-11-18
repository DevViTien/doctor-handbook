import { CircleCheckIcon, LockIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { routes } from "@/config/routes";
import { formatDate, formatDateTime } from "@/lib/date/format";
import { cn } from "@/lib/utils";
import { AccountStatusButton } from "@/modules/admin/components/account-status-button";
import { PasswordResetCodeButton } from "@/modules/admin/components/password-reset-code-button";
import type { DoctorAccountListItem } from "@/modules/admin/server/queries";

/** "Bác sĩ": every doctor account with its status, never any patient data (spec account-management). */
export function AccountList({ accounts }: { accounts: DoctorAccountListItem[] }) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Chưa có tài khoản bác sĩ nào"
        description="Tạo mã kích hoạt rồi gửi cho bác sĩ để họ tự tạo tài khoản."
        action={
          <Link
            href={routes.admin.accessCodes}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-3 hover:decoration-2"
          >
            Tạo mã kích hoạt
          </Link>
        }
        className="rounded-2xl border bg-card"
      />
    );
  }

  return (
    <section aria-labelledby="account-list-title" className="grid min-w-0 gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="account-list-title" className="text-[1.05rem] font-bold">
          Bác sĩ
        </h2>
        <span className="text-sm text-muted-foreground">{accounts.length} tài khoản</span>
      </div>
      <ul className="overflow-hidden rounded-2xl border bg-card">
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} />
        ))}
      </ul>
    </section>
  );
}

function AccountRow({ account }: { account: DoctorAccountListItem }) {
  const locked = account.status === "locked";

  return (
    <li
      data-status={account.status}
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2.5 py-3 pr-3 pl-4 not-first:border-t"
    >
      <div className="grid min-w-0 flex-[1_1_14rem] gap-0.5">
        <span className={cn("truncate font-semibold", locked && "text-muted-foreground")}>
          {account.displayName}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
          <span translate="no" className="font-semibold break-all">
            {account.username}
          </span>
          {locked ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
              <LockIcon className="size-4" aria-hidden />
              Đã khoá
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <CircleCheckIcon className="size-4" aria-hidden />
              Đang hoạt động
            </span>
          )}
        </span>
        <span className="text-[0.8rem] text-muted-foreground">
          Tạo {formatDate(account.createdAt)} ·{" "}
          {account.lastLoginAt
            ? `Đăng nhập ${formatDateTime(account.lastLoginAt)}`
            : "Chưa đăng nhập"}
        </span>
      </div>
      {/* Phone: the buttons go under the details, each as wide as the row (thumb-friendly). */}
      <div className="flex w-full flex-wrap gap-2 md:w-auto [&>button]:flex-1 md:[&>button]:flex-none">
        {locked ? null : (
          <PasswordResetCodeButton id={account.id} displayName={account.displayName} />
        )}
        <AccountStatusButton
          id={account.id}
          displayName={account.displayName}
          status={account.status}
        />
      </div>
    </li>
  );
}
