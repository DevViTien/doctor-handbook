import { z } from "zod";

import { LOGIN_MESSAGES } from "./constants";

/**
 * Login form input, shared by the form and the action.
 *
 * - `username` is trimmed and lowercased (usernames are case-insensitive) but deliberately NOT
 *   checked against the username pattern: a malformed name is simply "wrong credentials".
 * - `password` is never trimmed: spaces are part of a password.
 * - `next` is the raw redirect target and is never a reason to reject the form: the action only
 *   follows it via `getSafeRedirectPath`, which ignores anything unsafe or too long.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, LOGIN_MESSAGES.usernameRequired)
    .max(64, LOGIN_MESSAGES.usernameTooLong),
  password: z
    .string()
    .min(1, LOGIN_MESSAGES.passwordRequired)
    .max(128, LOGIN_MESSAGES.passwordTooLong),
  next: z.string().optional().catch(undefined),
});

export type LoginInput = z.output<typeof loginSchema>;
