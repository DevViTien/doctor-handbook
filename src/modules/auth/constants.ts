/**
 * User-facing login messages (spec account-session). The rate-limit message is the shared
 * `DEFAULT_ERROR_MESSAGES.RATE_LIMITED`.
 */
export const LOGIN_MESSAGES = {
  /** Same text for an unknown username and a wrong password: never reveal which one. */
  invalidCredentials: "Tên đăng nhập hoặc mật khẩu không đúng.",
  /** Only shown when the password is correct. */
  accountLocked: "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.",
  usernameRequired: "Nhập tên đăng nhập.",
  passwordRequired: "Nhập mật khẩu.",
  usernameTooLong: "Tên đăng nhập quá dài. Kiểm tra lại tên đăng nhập.",
  passwordTooLong: "Mật khẩu quá dài. Kiểm tra lại mật khẩu.",
} as const;
