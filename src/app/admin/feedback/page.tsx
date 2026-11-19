import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { FeedbackList } from "@/modules/feedback/components/feedback-list";
import { listFeedback } from "@/modules/feedback/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Góp ý" };

export default async function AdminFeedbackPage() {
  // Re-checked here: layouts do not re-run on client-side navigation (cached per request).
  await requirePageAccess("admin");
  const inbox = await listFeedback();

  return (
    <div className="pb-8">
      <PageHeader
        title="Góp ý"
        description="Góp ý bác sĩ gửi từ app. Nếu góp ý lỡ chứa thông tin bệnh nhân, đọc xong hãy xoá."
      />
      <FeedbackList inbox={inbox} />
    </div>
  );
}
