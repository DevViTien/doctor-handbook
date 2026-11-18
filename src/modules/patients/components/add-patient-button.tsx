import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { routes } from "@/config/routes";

/**
 * Floating "Thêm bệnh nhân" button in the thumb zone (idea.md §4.3, §12.6): above the bottom
 * navigation and the iOS home indicator, aligned with the right edge of the 672 px column.
 */
export function AddPatientButton() {
  return (
    <Link
      href={routes.doctor.newPatient}
      className="fixed right-[max(1rem,calc((100vw-42rem)/2+1rem))] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-13 items-center gap-2 rounded-full bg-primary pr-5 pl-4 font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <PlusIcon className="size-5" aria-hidden />
      Thêm bệnh nhân
    </Link>
  );
}
