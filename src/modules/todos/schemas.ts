import { z } from "zod";

import { TODO_LIMITS, TODO_MESSAGES } from "@/modules/todos/constants";

/** NFC + trim like every form field, then 1..1000 characters. */
export const todoContentSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().min(1, TODO_MESSAGES.empty).max(TODO_LIMITS.content, TODO_MESSAGES.tooLong));

/** "yyyy-mm-dd" that exists in the calendar (no 31/02), or `null`. */
export const todoDueDateSchema = z.iso
  .date({ error: TODO_MESSAGES.dueInvalid })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, TODO_MESSAGES.dueInvalid)
  .nullable();

const instant = z.iso.datetime({ offset: true });

/** Add. The browser makes the id, so sending the same add twice never makes two to-dos. */
export const createTodoSchema = z.object({
  id: z.uuid(),
  content: todoContentSchema,
  dueDate: todoDueDateSchema,
});

/** "Hoàn tác" after a delete: the same to-do back, with its dates (clamped to now). */
export const restoreTodoSchema = createTodoSchema.extend({
  completedAt: instant.nullable(),
  createdAt: instant,
});

export const updateTodoSchema = z.object({
  id: z.uuid(),
  content: todoContentSchema,
  dueDate: todoDueDateSchema,
});

export const setTodoDoneSchema = z.object({ id: z.uuid(), done: z.boolean() });

export const todoIdSchema = z.object({ id: z.uuid() });
