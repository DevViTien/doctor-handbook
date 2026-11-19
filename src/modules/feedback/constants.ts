/** Limits of the feedback module (spec feedback). */
export const FEEDBACK_LIMITS = {
  /** Characters after trimming (also a CHECK on the `feedback` table). */
  content: 2000,
  /** Feedback one doctor can send in any 24 hours. */
  perDay: 20,
  /** The admin page shows the newest ones only. */
  list: 200,
  /** Characters of the `User-Agent` header kept. */
  userAgent: 400,
} as const;

/** User-facing messages (Vietnamese, the UI language). */
export const FEEDBACK_MESSAGES = {
  empty: "Nhập nội dung góp ý.",
  tooLong: "Góp ý tối đa 2.000 ký tự.",
  rateLimited: "Đã gửi 20 góp ý trong 24 giờ qua. Thử lại sau.",
  offline: "Chưa gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Gửi góp ý lại khi có mạng.",
  stale:
    "Chưa gửi được vì ứng dụng vừa có bản mới. Chép lại phần vừa gõ, tải lại trang rồi gửi lại.",
  sent: "Đã gửi góp ý. Cảm ơn bác sĩ!",
  privacy: "Đừng ghi tên hay thông tin bệnh nhân. Admin đọc được nội dung này.",
  notFound: "Góp ý này không còn.",
  deleted: "Đã xoá góp ý.",
  deletedAccount: "Tài khoản đã xoá",
} as const;

/** "Hộp thư" heading of the admin list: takes focus after a feedback is deleted. */
export const FEEDBACK_LIST_TITLE_ID = "feedback-list-title";
