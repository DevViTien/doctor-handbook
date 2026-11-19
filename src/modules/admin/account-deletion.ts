/**
 * "Type the username to confirm" (spec account-management "Xác nhận xoá bằng tên đăng nhập").
 * Pure, client-safe: the dialog uses it to enable its button, the DAL uses it again to decide.
 * Usernames are always stored lowercase (a CHECK in the database).
 */
export function usernameMatches(typed: string, username: string): boolean {
  return typed.trim().toLowerCase() === username;
}
