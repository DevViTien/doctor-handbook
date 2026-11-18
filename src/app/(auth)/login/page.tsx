import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-balance">Đăng nhập</h1>
      {/* `next` is untrusted: the action only follows it through getSafeRedirectPath. */}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>
          Đã có mã kích hoạt?{" "}
          <Link
            href={routes.auth.activate}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-3 hover:decoration-2"
          >
            Kích hoạt tài khoản
          </Link>
        </p>
        <p>Chưa có mã? Liên hệ quản trị viên.</p>
      </div>
    </>
  );
}
