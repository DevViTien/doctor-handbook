import type { ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";

/** Mobile-first frame for every doctor screen: content above, navigation under the thumb. */
export function DoctorShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Bottom padding keeps content clear of the fixed navigation bar. */}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</main>
      <BottomNav />
    </div>
  );
}
