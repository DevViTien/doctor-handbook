import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { PasswordResetForm } from "@/modules/auth/components/password-reset-form";

export const metadata: Metadata = { title: "Đặt lại mật khẩu" };

export default function ResetPasswordPage() {
  return (
    <>
      <PasswordResetForm />
      <p className="text-sm text-muted-foreground">
        Nhớ mật khẩu rồi?{" "}
        <Link
          href={routes.auth.login}
          className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-3 hover:decoration-2"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
