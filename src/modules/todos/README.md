# Module: todos

A deliberately simple to-do list (idea.md D5, D15). Spec: `todo-list` (change `add-todo-list`).

## Scope

- Quick add: type + Enter (or "Thêm"); optional due date from the device's native date picker.
- Round checkbox: complete / reopen. Completed items are collapsed under "Đã xong (N)".
- Tap the text: "Sửa việc" (bottom sheet on phones, dialog from 640 px): content, due date,
  "Bỏ ngày hạn", "Lưu", "Xoá việc".
- Delete one: no confirmation, "Đã xoá việc." + "Hoàn tác" (8 s). Delete all completed: asks.
- No notifications, no link to patients (later, Could).

## Layout

| File                           | Role                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `schemas.ts`                   | Zod for every action (content NFC + trim, 1..1000; real dates)  |
| `due.ts`                       | `describeDue` ("Quá hạn · 16/11", "Hôm nay"…), list order       |
| `server/queries.ts`            | `listTodos`                                                     |
| `server/mutations.ts`          | `insertTodo` (idempotent), `updateTodo`, `setTodoDone`, deletes |
| `server/actions.ts`            | six `createAction`s, `access: "doctor"`                         |
| `components/todo-list.tsx`     | client list: optimistic changes, rollback on refusal            |
| `components/todo-composer.tsx` | "Thêm việc…"; retries reuse the same id                         |

## Rules

- **Ids come from the browser** (`crypto.randomUUID()`), like notes: a lost answer followed by
  a retry never makes a duplicate. `insertTodo` is `ON CONFLICT (id) DO UPDATE … WHERE account_id = session` (a retry may
  carry an edited due date), then reads the row by id **and** account; an id of another
  account writes nothing and is `NOT_FOUND`.
- **A failed add is never lost**: its text goes back into the empty field, or stays listed
  under it with "Thử lại" when the doctor already typed the next one.
- **Every action revalidates `/todos`**: Back/Forward would otherwise restore the first render.
- **Order is computed in the browser** (`due.ts`): dated first (earliest due, then newest),
  then undated (newest); completed by completion time, newest first.
- **Due dates are Vietnam calendar days** (`date` column). "Today" is re-read every minute.
- **Never put a to-do's text in a toast, title, URL or log**: it may name a patient.
- `TODO_LIMITS.content` (1000) is also the backup limit: never lower it without an upgrader.

## Data

Table `todos` (`src/server/db/schema/todos.ts`). `completed_at IS NULL` means open. Every
column round-trips through backup and import (module `backup`).
