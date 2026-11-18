import { beforeEach, describe, expect, it, vi } from "vitest";

import { TODO_MESSAGES } from "@/modules/todos/constants";
import {
  createTodoAction,
  deleteCompletedTodosAction,
  deleteTodoAction,
  restoreTodoAction,
  setTodoDoneAction,
  updateTodoAction,
} from "@/modules/todos/server/actions";
import {
  deleteCompletedTodos,
  deleteTodo,
  insertTodo,
  setTodoDone,
  updateTodo,
} from "@/modules/todos/server/mutations";
import type { TodoItem } from "@/modules/todos/types";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";

// Real guards (requireAccess), fake session lookup and DAL: tests the access rules end to end.
vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/todos/server/mutations", () => ({
  insertTodo: vi.fn(),
  updateTodo: vi.fn(),
  setTodoDone: vi.fn(),
  deleteTodo: vi.fn(),
  deleteCompletedTodos: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const TODO_ID = "3a7f8f0e-6a3c-4a8e-9f5c-2d1e0c9b8a76";
const lan: AuthContext = {
  sessionId: "s-lan",
  account: { id: "account-lan", role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
};
const admin: AuthContext = {
  sessionId: "s-admin",
  account: { id: "account-admin", role: "admin", username: "admin", displayName: "Quản trị" },
};
const todo: TodoItem = {
  id: TODO_ID,
  content: "Gọi chị Bình",
  dueDate: "2026-11-20",
  completedAt: null,
  createdAt: "2026-11-19T03:00:00.000Z",
};

function signedInAs(auth: AuthContext | null) {
  vi.mocked(getSessionToken).mockResolvedValue(auth ? "token" : undefined);
  vi.mocked(validateSessionToken).mockResolvedValue(auth);
}

beforeEach(() => {
  vi.mocked(insertTodo).mockResolvedValue(todo);
  vi.mocked(updateTodo).mockResolvedValue(todo);
  vi.mocked(setTodoDone).mockResolvedValue(todo);
  vi.mocked(deleteTodo).mockResolvedValue(true);
  vi.mocked(deleteCompletedTodos).mockResolvedValue(2);
});

describe("createTodoAction", () => {
  it("adds for the session's account; an account id sent by the client is ignored", async () => {
    signedInAs(lan);
    const result = await createTodoAction({
      id: TODO_ID,
      content: "  Gọi chị Bình ",
      dueDate: "2026-11-20",
      accountId: "account-minh",
    } as never);

    expect(result).toEqual({ ok: true, data: todo });
    expect(insertTodo).toHaveBeenCalledWith(lan, {
      id: TODO_ID,
      content: "Gọi chị Bình",
      dueDate: "2026-11-20",
    });
  });

  it.each([
    ["empty", "   ", TODO_MESSAGES.empty],
    ["too long", "x".repeat(1001), TODO_MESSAGES.tooLong],
  ])("refuses %s content", async (_label, content, message) => {
    signedInAs(lan);
    const result = await createTodoAction({ id: TODO_ID, content, dueDate: null });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(JSON.stringify(result)).toContain(message);
    expect(insertTodo).not.toHaveBeenCalled();
  });

  it("refuses a due date that does not exist", async () => {
    signedInAs(lan);
    const result = await createTodoAction({ id: TODO_ID, content: "a", dueDate: "2026-02-31" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
  });

  it("an id owned by another doctor is NOT_FOUND", async () => {
    signedInAs(lan);
    vi.mocked(insertTodo).mockResolvedValue(null);
    const result = await createTodoAction({ id: TODO_ID, content: "a", dueDate: null });
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: TODO_MESSAGES.notFound },
    });
  });
});

describe("Sửa hoặc xoá việc của bác sĩ khác", () => {
  beforeEach(() => signedInAs(lan));

  it("update: 0 rows is NOT_FOUND", async () => {
    vi.mocked(updateTodo).mockResolvedValue(null);
    const result = await updateTodoAction({ id: TODO_ID, content: "b", dueDate: null });
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(updateTodo).toHaveBeenCalledWith(lan, { id: TODO_ID, content: "b", dueDate: null });
  });

  it("done: 0 rows is NOT_FOUND", async () => {
    vi.mocked(setTodoDone).mockResolvedValue(null);
    const result = await setTodoDoneAction({ id: TODO_ID, done: true });
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("delete: 0 rows is NOT_FOUND", async () => {
    vi.mocked(deleteTodo).mockResolvedValue(false);
    const result = await deleteTodoAction({ id: TODO_ID });
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(deleteTodo).toHaveBeenCalledWith(lan, TODO_ID);
  });
});

describe("restoreTodoAction", () => {
  it("puts the to-do back with its dates", async () => {
    signedInAs(lan);
    const input = { ...todo, completedAt: "2026-11-19T04:00:00.000Z" };
    const result = await restoreTodoAction(input);
    expect(result.ok).toBe(true);
    expect(insertTodo).toHaveBeenCalledWith(lan, input);
  });
});

describe("deleteCompletedTodosAction", () => {
  it("deletes for the session's account and says how many", async () => {
    signedInAs(lan);
    expect(await deleteCompletedTodosAction({})).toEqual({ ok: true, data: { deleted: 2 } });
    expect(deleteCompletedTodos).toHaveBeenCalledWith(lan);
  });
});

describe("Chưa đăng nhập hoặc Admin gửi lệnh", () => {
  it.each([
    ["not signed in", null, "UNAUTHENTICATED"],
    ["an Admin", admin, "FORBIDDEN"],
  ])("%s is refused and nothing changes", async (_label, auth, code) => {
    signedInAs(auth);
    const results = await Promise.all([
      createTodoAction({ id: TODO_ID, content: "a", dueDate: null }),
      updateTodoAction({ id: TODO_ID, content: "a", dueDate: null }),
      setTodoDoneAction({ id: TODO_ID, done: true }),
      deleteTodoAction({ id: TODO_ID }),
      deleteCompletedTodosAction({}),
    ]);
    for (const result of results) expect(result).toMatchObject({ ok: false, error: { code } });
    for (const fn of [insertTodo, updateTodo, setTodoDone, deleteTodo, deleteCompletedTodos]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});
