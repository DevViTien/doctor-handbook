/**
 * Application error model shared by server and client.
 *
 * Server code throws `AppError` with a stable `code`; the action/route layer converts it
 * into a serializable `ActionError`. Messages are user-facing, hence in Vietnamese
 * (the UI language). Never put patient data into an error message.
 */

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Field name -> list of messages, as produced by `z.flattenError(...).fieldErrors`. */
export type FieldErrors = Partial<Record<string, string[]>>;

export type ActionError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
};

export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
  CONFLICT: "Dữ liệu đã tồn tại hoặc vừa được thay đổi.",
  RATE_LIMITED: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.",
  INTERNAL: "Đã có lỗi xảy ra. Vui lòng thử lại.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;

  constructor(
    code: ErrorCode,
    message: string = DEFAULT_ERROR_MESSAGES[code],
    options: { cause?: unknown; fieldErrors?: FieldErrors } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    if (options.fieldErrors) this.fieldErrors = options.fieldErrors;
  }

  toActionError(): ActionError {
    return {
      code: this.code,
      message: this.message,
      ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
