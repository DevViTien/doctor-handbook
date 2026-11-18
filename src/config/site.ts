/** Static, client-safe application metadata. */
export const siteConfig = {
  name: "Doctor Handbook",
  shortName: "Sổ tay BS",
  description: "Sổ tay số cho bác sĩ: ghi nhớ bệnh nhân, tìm lại tức thì, ghi việc cần làm.",
  locale: "vi-VN",
  timeZone: "Asia/Ho_Chi_Minh",
  themeColor: { light: "#f6f7fa", dark: "#0d121c" },
} as const;

/**
 * The doctor area's own notice area (bottom, above the navigation; spec patient-trash). Toasts
 * meant for it pass `toasterId: DOCTOR_TOASTER_ID`; the app-wide Toaster keeps the others.
 */
export const DOCTOR_TOASTER_ID = "doctor";
