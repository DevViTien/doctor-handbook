/** One to-do as the UI sees it (ISO strings; `dueDate` is a Vietnam calendar day). */
export type TodoItem = {
  id: string;
  content: string;
  /** "yyyy-mm-dd", or `null` without a due date. */
  dueDate: string | null;
  /** `null` while open. */
  completedAt: string | null;
  createdAt: string;
};
