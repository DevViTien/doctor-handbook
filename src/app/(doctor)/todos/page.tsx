import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { vietnamIsoDay } from "@/lib/date/calendar";
import { TodoList } from "@/modules/todos/components/todo-list";
import { listTodos } from "@/modules/todos/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

// A fixed title: never a to-do's text, which may name a patient (spec todo-list).
export const metadata: Metadata = { title: "Việc cần làm" };

export default async function TodosPage() {
  const auth = await requirePageAccess("doctor");
  const todos = await listTodos(auth);

  return (
    <PageContainer className="pb-6">
      <TodoList initial={todos} today={vietnamIsoDay(new Date())} />
    </PageContainer>
  );
}
