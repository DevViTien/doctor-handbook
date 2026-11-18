import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { PatientPageBar } from "@/modules/patients/components/patient-page-bar";

/**
 * Same page for another doctor's patient, an unknown id and a malformed id (spec "Bệnh nhân tách
 * theo bác sĩ"): nothing tells them apart.
 */
export default function PatientNotFound() {
  return (
    <PageContainer>
      <PatientPageBar backHref={routes.doctor.patients} backLabel="Bệnh nhân" />
      <EmptyState
        className="mt-2 rounded-2xl border bg-card"
        icon={SearchXIcon}
        title="Không tìm thấy bệnh nhân"
        description="Bệnh nhân này không có trong sổ của bạn, hoặc đường dẫn đã sai."
        action={
          <Button asChild variant="outline" className="h-11">
            <Link href={routes.doctor.patients}>Về danh sách bệnh nhân</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
