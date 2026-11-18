import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { routes } from "@/config/routes";
import { formatDate } from "@/lib/date/format";
import { BackupPanel } from "@/modules/backup/components/backup-panel";
import { ImportPanel } from "@/modules/backup/components/import-panel";
import { describeLastBackup } from "@/modules/backup/reminder";
import { getBackupStatus } from "@/modules/backup/server/queries";
import { PatientPageBar } from "@/modules/patients/components/patient-page-bar";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Sao lưu dữ liệu" };

export default async function BackupPage() {
  const auth = await requirePageAccess("doctor");
  const status = await getBackupStatus(auth);
  const { counts, lastBackupAt } = status;

  const lastBackup = lastBackupAt
    ? `Lần sao lưu gần nhất: ${describeLastBackup(lastBackupAt, new Date())} (${formatDate(lastBackupAt)})`
    : describeLastBackup(null, new Date());
  const trashed = counts.trashed > 0 ? ` (${counts.trashed} trong thùng rác)` : "";
  const images = counts.images > 0 ? `, ${counts.images} ảnh` : "";
  const holdings = `Đang có ${counts.patients} bệnh nhân${trashed}, ${counts.notes} ghi chú, ${counts.todos} việc${images}`;

  return (
    <PageContainer className="pb-6">
      <PatientPageBar backHref={routes.doctor.settings} backLabel="Cài đặt" />
      <header className="pt-1 pb-1">
        <h1 className="text-xl font-semibold tracking-tight">Sao lưu dữ liệu</h1>
      </header>
      <p className="mb-3.5 text-[0.92rem] text-muted-foreground">
        Dữ liệu trên server có thể bị mất. Hãy giữ một file sao lưu trên máy.
      </p>
      <div className="grid gap-3.5">
        <BackupPanel
          lastBackup={lastBackup}
          neverBackedUp={lastBackupAt === null}
          holdings={holdings}
        />
        <ImportPanel
          username={auth.account.username}
          current={{ patients: counts.patients, notes: counts.notes, todos: counts.todos }}
        />
      </div>
    </PageContainer>
  );
}
