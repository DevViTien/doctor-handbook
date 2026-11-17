# Module: todos

A deliberately simple to-do list (idea.md D5).

## Scope

- Add (type + Enter), edit, delete, complete / reopen.
- Optional due date; overdue items highlighted; no notifications (D15).
- Open items first (earliest due date first), completed items collapsed at the bottom,
  bulk-delete completed items.

## Data

Table `todos` (`src/server/db/schema/todos.ts`). `completed_at IS NULL` means open.
