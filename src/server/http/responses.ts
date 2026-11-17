import "server-only";

import { DEFAULT_ERROR_MESSAGES, type ErrorCode, isAppError } from "@/lib/errors";
import { logger } from "@/server/logger";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/**
 * Converts any thrown value into a JSON error response for Route Handlers, mirroring what
 * `createAction` does for Server Actions.
 */
export function toErrorResponse(error: unknown, context: { route: string }): Response {
  if (isAppError(error)) {
    return Response.json({ error: error.toActionError() }, { status: STATUS_BY_CODE[error.code] });
  }

  logger.error("Route handler failed", { route: context.route, error });
  return Response.json(
    { error: { code: "INTERNAL", message: DEFAULT_ERROR_MESSAGES.INTERNAL } },
    { status: 500 },
  );
}
