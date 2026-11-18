"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routes } from "@/config/routes";
import { AppError } from "@/lib/errors";
import { TODO_MESSAGES } from "@/modules/todos/constants";
import {
  createTodoSchema,
  restoreTodoSchema,
  setTodoDoneSchema,
  todoIdSchema,
  updateTodoSchema,
} from "@/modules/todos/schemas";
import {
  deleteCompletedTodos,
  deleteTodo,
  insertTodo,
  setTodoDone,
  updateTodo,
} from "@/modules/todos/server/mutations";
import type { TodoItem } from "@/modules/todos/types";
import { createAction } from "@/server/actions/create-action";

/**
 * To-do actions (spec todo-list). The list in the browser is what is shown; every change still
 * revalidates `/todos`, otherwise Back/Forward would restore the page as first loaded (Next reuses
 * cached pages there) and bring deleted to-dos back. `TodoList` keeps its own state, so the
 * re-rendered page never overwrites what is on screen.
 */

const found = <T>(value: T | null | false): T => {
  if (value === null || value === false) throw new AppError("NOT_FOUND", TODO_MESSAGES.notFound);
  revalidatePath(routes.doctor.todos);
  return value;
};

export const createTodoAction = createAction(
  { name: "todos.create", schema: createTodoSchema, access: "doctor" },
  async (input, { auth }): Promise<TodoItem> => found(await insertTodo(auth, input)),
);

export const restoreTodoAction = createAction(
  { name: "todos.restore", schema: restoreTodoSchema, access: "doctor" },
  async (input, { auth }): Promise<TodoItem> => found(await insertTodo(auth, input)),
);

export const updateTodoAction = createAction(
  { name: "todos.update", schema: updateTodoSchema, access: "doctor" },
  async (input, { auth }): Promise<TodoItem> => found(await updateTodo(auth, input)),
);

export const setTodoDoneAction = createAction(
  { name: "todos.setDone", schema: setTodoDoneSchema, access: "doctor" },
  async (input, { auth }): Promise<TodoItem> => found(await setTodoDone(auth, input)),
);

export const deleteTodoAction = createAction(
  { name: "todos.delete", schema: todoIdSchema, access: "doctor" },
  async ({ id }, { auth }): Promise<{ deleted: true }> => {
    found(await deleteTodo(auth, id));
    return { deleted: true };
  },
);

export const deleteCompletedTodosAction = createAction(
  { name: "todos.deleteCompleted", schema: z.object({}), access: "doctor" },
  async (_input, { auth }): Promise<{ deleted: number }> => {
    const deleted = await deleteCompletedTodos(auth);
    revalidatePath(routes.doctor.todos);
    return { deleted };
  },
);
