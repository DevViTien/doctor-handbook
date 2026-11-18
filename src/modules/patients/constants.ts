import type { Gender } from "@/lib/enums";

/** Field limits (spec patient-records "Giới hạn các ô thông tin"). */
export const PATIENT_LIMITS = {
  fullName: 100,
  hometown: 100,
  phone: 20,
  patientCode: 50,
  summary: 5000,
  minBirthYear: 1900,
  maxAge: 120,
  /** Duplicate-name suggestions shown at most (spec "Gợi ý trùng tên khi thêm"). */
  duplicateSuggestions: 3,
} as const;

/** Digits, spaces and `+ - . ( )` only. */
export const PHONE_PATTERN = /^[0-9 +\-.()]+$/;

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

/** Notes (spec patient-notes). */
export const NOTE_LIMITS = {
  content: 5000,
  /** From this length on, the composer shows a character counter. */
  counterFrom: 4500,
} as const;

/** Pause after the last keystroke before a note is sent (spec "Tự lưu ghi chú"). */
export const NOTE_AUTOSAVE_DELAY_MS = 1000;
/** While waiting for the network, retry this often even without an `online` event. */
export const NOTE_RETRY_INTERVAL_MS = 15_000;
/** A save not answered after this long is shown as "Đang chờ mạng" (it keeps waiting). */
export const NOTE_SLOW_SEND_MS = 15_000;

export const NOTE_MESSAGES = {
  tooLong: `Ghi chú tối đa ${NOTE_LIMITS.content} ký tự.`,
  empty: "Ghi chú đang trống.",
  notFound: "Không lưu được: bệnh nhân hoặc ghi chú không còn trong sổ. Chữ vẫn còn trên máy.",
  idle: "Tự lưu khi bạn ngừng gõ",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  offline: "Đang chờ mạng",
  unsaved: "Chưa lưu",
  /** Badge of a closed note the server refused (too long, not found…). */
  refused: "Chưa lưu được",
  restored: "Khôi phục ghi chú chưa gửi",
  deleteFailedOffline: "Không xoá được vì mất mạng. Thử lại khi có mạng.",
} as const;

/** User-facing messages of the patients module. Never put patient data in them. */
export const PATIENT_MESSAGES = {
  fullNameRequired: "Nhập họ tên bệnh nhân.",
  fullNameTooLong: `Họ tên tối đa ${PATIENT_LIMITS.fullName} ký tự.`,
  hometownTooLong: `Quê quán tối đa ${PATIENT_LIMITS.hometown} ký tự.`,
  phoneTooLong: `Số điện thoại tối đa ${PATIENT_LIMITS.phone} ký tự.`,
  phoneInvalid: "Số điện thoại chỉ gồm chữ số, dấu cách và + - . ( )",
  patientCodeTooLong: `Mã bệnh nhân tối đa ${PATIENT_LIMITS.patientCode} ký tự.`,
  summaryTooLong: `Tóm tắt tối đa ${PATIENT_LIMITS.summary} ký tự.`,
  genderInvalid: "Chọn Nam, Nữ hoặc Khác.",
  birthUnreadable: "Nhập năm sinh (1979), tuổi (45t) hoặc ngày sinh (12/03/1979).",
  birthYearOutOfRange: `Năm sinh phải từ ${PATIENT_LIMITS.minBirthYear} tới năm nay.`,
  ageOutOfRange: `Tuổi phải từ 0 tới ${PATIENT_LIMITS.maxAge}.`,
  birthDateInvalid: "Ngày sinh không có thật hoặc ở tương lai.",
  notFound: "Không tìm thấy bệnh nhân.",
  changedElsewhere: "Bệnh nhân vừa được sửa ở thiết bị khác. Tải lại trang để xem bản mới nhất.",
  offline: "Không gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Lưu lại khi có mạng.",
  offlineNotice: "Đang mất mạng. Chữ đã nhập vẫn còn trên trang này.",
} as const;
