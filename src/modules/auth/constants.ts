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

/** User-facing activation messages (spec account-activation). */
export const ACTIVATION_MESSAGES = {
  codeRequired: "Nhập mã kích hoạt.",
  /** Same text whatever the reason: unknown, used, revoked, expired or another kind of code. */
  invalidCode: "Mã kích hoạt không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới.",
  displayNameRequired: "Nhập họ tên.",
  displayNameTooLong: "Họ tên tối đa 80 ký tự.",
  usernameTaken: "Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.",
  termsRequired: "Bạn cần đọc và đồng ý lưu ý sử dụng.",
} as const;

export const DISPLAY_NAME_MAX_LENGTH = 80;
/** Generous: people type dashes and spaces ("k7hm - 3qxr"); the server normalizes. */
export const ACCESS_CODE_INPUT_MAX_LENGTH = 32;

/** The usage notice accepted at activation (idea.md S9, §19). */
export const USAGE_NOTICE = [
  "Doctor Handbook là sổ ghi nhớ cá nhân, không thay thế hồ sơ bệnh án chính thức.",
  "Dữ liệu lưu trên máy chủ miễn phí và có thể bị mất. Hãy sao lưu thường xuyên trong Cài đặt.",
  "File sao lưu chứa thông tin bệnh nhân. Giữ file cẩn thận, không gửi cho người khác.",
  "Chỉ ghi những thông tin thật sự cần thiết.",
  "App giữ đăng nhập trên thiết bị này. Bạn tự bảo vệ thiết bị và mật khẩu; mất máy thì báo quản trị viên ngay để khoá tài khoản.",
] as const;
