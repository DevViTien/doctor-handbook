import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { ActivationForm } from "@/modules/auth/components/activation-form";

export const metadata: Metadata = { title: "Kích hoạt tài khoản" };

export default function ActivatePage() {
  return (
    <>
      <ActivationForm />
      <p className="text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
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
