import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { DEFAULT_ERROR_MESSAGES, isAppError } from "@/lib/errors";
import { type ActionResult, fail, ok } from "@/lib/result";
import { type AccessLevel, getCurrentAuth, requireAccess } from "@/server/auth/guards";
import type { AuthContext } from "@/server/auth/session";
import { logger } from "@/server/logger";

type ActionAccess = AccessLevel | "public";

type ActionContext<TAccess extends ActionAccess> = TAccess extends "public"
  ? { auth: AuthContext | null }
  : { auth: AuthContext };

type ActionConfig<TSchema extends z.ZodType, TAccess extends ActionAccess> = {
  /** Stable name used in logs, e.g. "patients.create". */
  name: string;
  schema: TSchema;
  /** Defaults to "doctor": the safest choice for this app. */
  access?: TAccess;
};

/**
 * Builds a Server Action with the cross-cutting concerns every action needs:
 *
 * 1. Authorization (before parsing, so anonymous callers learn nothing).
 * 2. Input validation with Zod (client input is never trusted).
 * 3. Error mapping to a serializable `ActionResult` — expected `AppError`s keep their
 *    code and message; anything else is logged and reported as INTERNAL.
 *
 * Next.js control-flow errors (`redirect()`, `notFound()`) are re-thrown untouched.
 *
 * @example
 * // src/modules/todos/server/actions.ts
 * "use server";
 * export const createTodo = createAction(
 *   { name: "todos.create", schema: createTodoSchema },
 *   async (input, { auth }) => insertTodo(auth.account.id, input),
 * );
 */
export function createAction<
  TSchema extends z.ZodType,
  TOutput,
  TAccess extends ActionAccess = "doctor",
>(
  config: ActionConfig<TSchema, TAccess>,
  handler: (input: z.output<TSchema>, context: ActionContext<TAccess>) => Promise<TOutput>,
): (input: z.input<TSchema>) => Promise<ActionResult<TOutput>> {
  const access: ActionAccess = config.access ?? "doctor";

  return async (rawInput) => {
    try {
      const auth = access === "public" ? await getCurrentAuth() : await requireAccess(access);

      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        return fail({
          code: "VALIDATION_FAILED",
          message: DEFAULT_ERROR_MESSAGES.VALIDATION_FAILED,
          fieldErrors: z.flattenError(parsed.error).fieldErrors,
        });
      }

      const context = { auth } as ActionContext<TAccess>;
      return ok(await handler(parsed.data, context));
    } catch (error) {
      unstable_rethrow(error);

      if (isAppError(error)) return fail(error.toActionError());

      logger.error("Server action failed", { action: config.name, error });
      return fail({ code: "INTERNAL", message: DEFAULT_ERROR_MESSAGES.INTERNAL });
    }
  };
}
