/** Identifies a Doctor Handbook backup in `manifest.json`. */
export const BACKUP_APP_ID = "doctor-handbook";

/**
 * Version of the file format this app writes. Bump it (and add an upgrader in `format.ts`) for
 * any change an older app could not read: the app MUST read every older version.
 */
export const BACKUP_FORMAT_VERSION = 1;

const MB = 1024 * 1024;

export const BACKUP_LIMITS = {
  /** Largest `.zip` accepted for import, and largest compressed body either way. */
  fileBytes: 4 * MB,
  /** Largest `manifest.json` + `data.json` once unpacked (guards against zip bombs). */
  unpackedBytes: 64 * MB,
  patients: 20_000,
  notes: 200_000,
  todos: 20_000,
} as const;

/** The reminder shows once the last backup is older than this. */
export const BACKUP_REMINDER_DAYS = 7;
/** "Để mai" hides the reminder on this device for this long. */
export const BACKUP_REMINDER_SNOOZE_MS = 24 * 60 * 60 * 1000;
/** Suffix of the backup taken automatically before an import replaces the data. */
export const PRE_IMPORT_SUFFIX = "_truoc-khi-nhap";
/** Header of the import request: the browser saw data, asked, and saved a backup of it. */
export const REPLACE_EXISTING_HEADER = "x-replace-existing";
/** An import that gets no answer within this long is treated like a lost connection. */
export const IMPORT_TIMEOUT_MS = 60_000;

/** User-facing messages of the backup module. Never put patient data in them. */
export const BACKUP_MESSAGES = {
  keepSafe: "File chứa thông tin bệnh nhân. Giữ file cẩn thận, không gửi cho người khác.",
  keepSafeShort: "Giữ file cẩn thận, không gửi cho người khác.",
  downloaded: (fileName: string) => `Đã tải file ${fileName}.`,
  exportOffline: "Không tạo được file vì mất mạng. Thử lại khi có mạng.",
  exportTooLarge: "Dữ liệu quá lớn để sao lưu bằng một file.",
  neverBackedUp: "Chưa sao lưu lần nào",
  fileBroken: "File này không phải file sao lưu của Doctor Handbook, hoặc đã bị hỏng.",
  fileNewer:
    "File được tạo từ phiên bản app mới hơn. Vui lòng cập nhật app (tải lại trang) rồi thử lại.",
  fileTooLarge: `File quá lớn. Dung lượng tối đa ${BACKUP_LIMITS.fileBytes / MB} MB.`,
  importOffline: "Không nhập được vì mất mạng. Dữ liệu chưa thay đổi.",
  importFailed: "Đã có lỗi xảy ra. Dữ liệu chưa thay đổi.",
  preImportBackupFailed: "Chưa sao lưu được dữ liệu hiện tại nên chưa nhập. Thử lại khi có mạng.",
  preImportBackupRefused: (reason: string) =>
    `Chưa sao lưu được dữ liệu hiện tại nên chưa nhập. ${reason}`,
  importNotEmpty:
    "Sổ tay vừa có thêm dữ liệu nên chưa nhập. Trang đã được tải lại: xem lại rồi nhập lần nữa.",
} as const;
