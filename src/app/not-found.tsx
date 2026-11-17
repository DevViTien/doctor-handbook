import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export default function NotFound() {
  return (
    <EmptyState
      className="min-h-dvh"
      icon={FileQuestionIcon}
      title="Không tìm thấy trang"
      description="Trang bạn tìm không tồn tại hoặc đã bị xóa."
      action={
        <Button asChild>
          <Link href={routes.home}>Về trang chính</Link>
        </Button>
      }
    />
  );
}
