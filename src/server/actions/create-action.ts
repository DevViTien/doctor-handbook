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

type ActionHandler<TSchema extends z.ZodType, TOutput, TAccess extends ActionAccess> = (
  input: z.output<TSchema>,
  context: ActionContext<TAccess>,
) => Promise<TOutput>;

/** State shape for `useActionState`: `null` until the form is submitted once. */
export type FormActionState<TOutput> = ActionResult<TOutput> | null;

/**
 * The cross-cutting pipeline shared by every action:
 *
 * 1. Authorization (before parsing, so anonymous callers learn nothing).
 * 2. Input validation with Zod (client input is never trusted).
 * 3. Error mapping to a serializable `ActionResult` — expected `AppError`s keep their
 *    code and message; anything else is logged and reported as INTERNAL.
 *
 * Next.js control-flow errors (`redirect()`, `notFound()`) are re-thrown untouched.
 */
async function runAction<TSchema extends z.ZodType, TOutput, TAccess extends ActionAccess>(
  config: ActionConfig<TSchema, TAccess>,
  rawInput: unknown,
  handler: ActionHandler<TSchema, TOutput, TAccess>,
): Promise<ActionResult<TOutput>> {
  const access: ActionAccess = config.access ?? "doctor";

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
}

/**
 * Builds a Server Action called with a typed object (from event handlers or transitions).
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
  handler: ActionHandler<TSchema, TOutput, TAccess>,
): (input: z.input<TSchema>) => Promise<ActionResult<TOutput>> {
  // `async` on purpose: "use server" files may only export async functions.
  return async (rawInput) => runAction(config, rawInput, handler);
}

/**
 * Builds a Server Action for `<form action={…}>` with `useActionState`. Prefer it for forms:
 * the form posts even before JavaScript has loaded, and a failed hydration can never fall
 * back to a GET that would put field values (passwords!) in the URL.
 *
 * Fields are read with `Object.fromEntries`: a repeated name keeps its last value, and React's
 * internal `$ACTION_*` fields are dropped. Parse everything else with the schema.
 *
 * @example
 * const [state, formAction, isPending] = useActionState(loginFormAction, null);
 * return <form action={formAction}>…</form>;
 */
export function createFormAction<
  TSchema extends z.ZodType,
  TOutput,
  TAccess extends ActionAccess = "doctor",
>(
  config: ActionConfig<TSchema, TAccess>,
  handler: ActionHandler<TSchema, TOutput, TAccess>,
): (prevState: FormActionState<TOutput>, formData: FormData) => Promise<ActionResult<TOutput>> {
  return async (_prevState, formData) => runAction(config, formDataToObject(formData), handler);
}

/** FormData → plain object, without React's internal `$ACTION_*` fields. */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries([...formData.entries()].filter(([key]) => !key.startsWith("$ACTION")));
}
