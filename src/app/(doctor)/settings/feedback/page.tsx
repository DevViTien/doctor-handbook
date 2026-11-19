import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { routes } from "@/config/routes";
import { FeedbackForm } from "@/modules/feedback/components/feedback-form";
import { PatientPageBar } from "@/modules/patients/components/patient-page-bar";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Góp ý" };

export default async function FeedbackPage() {
  await requirePageAccess("doctor");

  return (
    <PageContainer className="pb-6">
      <PatientPageBar backHref={routes.doctor.settings} backLabel="Cài đặt" />
      <header className="pt-1 pb-1">
        <h1 className="text-xl font-semibold tracking-tight">Góp ý</h1>
      </header>
      <p className="mb-3.5 text-[0.92rem] text-muted-foreground">
        Gặp lỗi, thấy khó dùng, hay muốn app có thêm gì? Viết vài dòng, Admin sẽ đọc.
      </p>
      <FeedbackForm />
    </PageContainer>
  );
}
