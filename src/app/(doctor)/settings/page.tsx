import { ChevronRightIcon, Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InitialsAvatar } from "@/components/common/initials-avatar";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { routes } from "@/config/routes";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { countTrash } from "@/modules/patients/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const auth = await requirePageAccess("doctor");
  const { account } = auth;
  const trashCount = await countTrash(auth);

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

      <Link
        href={routes.doctor.trash}
        className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl border bg-card py-2 pr-3 pl-4 transition-colors hover:bg-muted focus-visible:outline-3 focus-visible:outline-ring motion-reduce:transition-none"
      >
        <Trash2Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 font-semibold">Thùng rác</span>
        <span className="text-sm text-muted-foreground">
          {trashCount > 0 ? `${trashCount} bệnh nhân` : "Trống"}
        </span>
        <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      {/* TEMPORARY: the rest of Settings belongs to later changes (backup, import). */}
      <p className="mt-4 rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
        Sao lưu dữ liệu, nhập dữ liệu: đang được xây dựng
      </p>
    </PageContainer>
  );
}
