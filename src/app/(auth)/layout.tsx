import type { ReactNode } from "react";

import { AppMark } from "@/components/common/app-mark";
import { siteConfig } from "@/config/site";
import { redirectIfAuthenticated } from "@/server/auth/guards";

/**
 * Public screens: login, account activation, password reset.
 * Phone: a single column on the page background. Desktop: the same column in a bordered card.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  await redirectIfAuthenticated();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-8">
      <div className="grid w-full max-w-sm gap-6 md:max-w-md md:rounded-2xl md:border md:bg-card md:p-8">
        <div className="flex items-center gap-3">
          <AppMark />
          <div>
            <p translate="no" className="leading-tight font-bold">
              {siteConfig.name}
            </p>
            <p className="text-sm leading-snug text-muted-foreground">Sổ tay ghi nhớ bệnh nhân</p>
          </div>
        </div>
        {children}
        <p className="text-sm text-muted-foreground">
          Đây là sổ ghi nhớ cá nhân, không thay thế hồ sơ bệnh án.
        </p>
      </div>
    </div>
  );
}
