/** User-facing messages of the admin module (Vietnamese, the UI language). */
export const ADMIN_MESSAGES = {
  recipientRequired: "Nhập tên người nhận mã.",
  recipientTooLong: "Tên người nhận tối đa 80 ký tự.",
  revokeConflict: "Mã này đã được dùng, đã hết hạn hoặc đã bị huỷ.",
} as const;

export const RECIPIENT_NAME_MAX_LENGTH = 80;

/** The list shows the newest codes only; a small group never comes close (design §5). */
export const ACCESS_CODE_LIST_LIMIT = 100;
