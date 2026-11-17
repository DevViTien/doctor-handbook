import type { ReactNode } from "react";

import { siteConfig } from "@/config/site";
import { redirectIfAuthenticated } from "@/server/auth/guards";

/** Public screens: login, account activation, password reset. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  await redirectIfAuthenticated();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <p className="mb-6 text-lg font-semibold">{siteConfig.name}</p>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
