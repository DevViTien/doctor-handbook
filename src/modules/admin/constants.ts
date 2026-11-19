/** User-facing messages of the admin module (Vietnamese, the UI language). */
export const ADMIN_MESSAGES = {
  recipientRequired: "Nhập tên người nhận mã.",
  recipientTooLong: "Tên người nhận tối đa 80 ký tự.",
  revokeConflict: "Mã này đã được dùng, đã hết hạn hoặc đã bị huỷ.",
} as const;

/** Account management messages (spec account-management). */
export const ACCOUNT_MESSAGES = {
  /** Also the answer for the admin account: never reveal which ids belong to an admin. */
  notFound: "Không tìm thấy tài khoản.",
  lockedNoReset: "Tài khoản đang bị khoá. Mở khoá trước khi cấp mã đặt lại mật khẩu.",
  usernameMismatch: "Tên đăng nhập không khớp.",
  activeNoDelete: "Tài khoản đang hoạt động. Khoá trước khi xoá.",
  deleteFailed: "Chưa xoá được tài khoản. Tài khoản vẫn bị khoá, hãy thử lại sau.",
  deleted: (username: string) => `Đã xoá tài khoản ${username}.`,
} as const;

export const RECIPIENT_NAME_MAX_LENGTH = 80;

/** "Bác sĩ" heading of the account list: takes focus after a row is deleted. */
export const ACCOUNT_LIST_TITLE_ID = "account-list-title";

/**
 * The list shows the newest codes of both kinds. Reissued reset codes add rows, so the cap is
 * generous; a small group still never comes close.
 */
export const ACCESS_CODE_LIST_LIMIT = 200;
