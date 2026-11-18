import type { Metadata } from "next";

import { InitialsAvatar } from "@/components/common/initials-avatar";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const { account } = await requirePageAccess("doctor");

  return (
    <PageContainer>
      <PageHeader title="Cài đặt" />

      <section
        aria-labelledby="account-heading"
        className="grid gap-4 rounded-2xl border bg-card p-4"
      >
        <h2 id="account-heading" className="text-[0.95rem] font-semibold text-muted-foreground">
          Tài khoản
        </h2>
        <div className="flex min-w-0 items-center gap-3">
          <InitialsAvatar name={account.displayName} className="size-12" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{account.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">
              Tên đăng nhập: {account.username}
            </p>
          </div>
        </div>
        <LogoutButton />
      </section>

      <div className="mt-4">
        <ChangePasswordForm username={account.username} />
      </div>

      {/* TEMPORARY: the rest of Settings belongs to later changes (backup, import, trash). */}
      <p className="mt-4 rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
        Sao lưu dữ liệu, nhập dữ liệu, thùng rác: đang được xây dựng
      </p>
    </PageContainer>
  );
}
