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
