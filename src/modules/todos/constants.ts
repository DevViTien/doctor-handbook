/** Limits of a to-do (spec todo-list). Backups use the same limit: never lower it. */
export const TODO_LIMITS = { content: 1000 } as const;

/** How long the "Hoàn tác" notice stays up after deleting a to-do. */
export const TODO_UNDO_MS = 8000;

/** User-facing messages of the todos module. Never put a to-do's text in them. */
export const TODO_MESSAGES = {
  empty: "Việc đang trống.",
  tooLong: `Việc tối đa ${TODO_LIMITS.content} ký tự.`,
  dueInvalid: "Ngày hạn không có thật.",
  notFound: "Không tìm thấy việc này.",
  addOffline: "Chưa thêm được vì mất mạng. Chữ vẫn còn, nhấn Enter để thử lại.",
  saveOffline: "Chưa lưu được vì mất mạng. Thử lại khi có mạng.",
  deleted: "Đã xoá việc.",
  undo: "Hoàn tác",
  retry: "Thử lại",
  clearedDone: (count: number) => `Đã xoá ${count} việc đã xong.`,
} as const;
