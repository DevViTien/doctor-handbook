import type { Metadata } from "next";

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
      <p className="text-sm text-muted-foreground">
        Chưa có tài khoản? Liên hệ quản trị viên để nhận mã kích hoạt.
      </p>
    </>
  );
}
