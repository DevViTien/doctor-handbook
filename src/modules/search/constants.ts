/** Limits of patient search (spec patient-search, design §3–§4). */
export const SEARCH_LIMITS = {
  /** Deep search (phone, code, summary, notes) needs at least this many normalized characters. */
  deepMinLength: 2,
  maxLength: 100,
  debounceMs: 300,
  suggestions: 5,
  /** Trigram name-similarity threshold of the "Có phải bạn tìm…?" suggestions. */
  similarity: 0.35,
  /** A deep search not answered by then is treated as offline (and retried). */
  timeoutMs: 10_000,
  /** While offline, retry this often even without an `online` event. */
  retryMs: 15_000,
  /** The prefilled name is ignored when older than this (a navigation that never happened). */
  prefillMaxAgeMs: 60_000,
  /** A phone match needs at least this many digits typed. */
  phoneMinDigits: 3,
} as const;

/**
 * `sessionStorage` key carrying the searched name to the add form (spec "Không thấy bệnh nhân
 * nào"): never in the URL. The form reads it once and removes it.
 */
export const NEW_PATIENT_NAME_KEY = "doctor-handbook:new-patient-name";

export const SEARCH_MESSAGES = {
  placeholder: "Tìm tên, quê, SĐT, mã BN, ghi chú…",
  searchingDeep: "Đang tìm trong SĐT, mã BN, tóm tắt, ghi chú…",
  offline: "Chưa tìm được trong ghi chú vì mất mạng.",
  failed: "Chưa tìm được trong ghi chú. Thử lại sau.",
  searching: "Đang tìm…",
  noneTitle: "Không thấy bệnh nhân nào khớp",
  suggestionsTitle: "Có phải bạn tìm…?",
  listening: "Đang nghe… nói tên bệnh nhân",
  micDenied: "Không dùng được micro. Hãy cho phép micro, hoặc gõ để tìm.",
  noSpeech: "Không nghe rõ. Bấm micro và nói lại.",
  speechNetwork: "Cần có mạng để nhận giọng nói.",
  speechFailed: "Chưa nhận được giọng nói. Hãy gõ để tìm.",
} as const;

/** Where a deep match was found, in the order its label wins (design §3). */
export const MATCH_KINDS = ["phone", "patientCode", "summary", "notes"] as const;

export const MATCH_LABELS = {
  phone: "Khớp số điện thoại",
  patientCode: "Khớp mã bệnh nhân",
  summary: "Khớp trong tóm tắt",
  notes: "Khớp trong ghi chú",
} as const;
