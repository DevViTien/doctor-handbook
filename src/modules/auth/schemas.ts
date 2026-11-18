import { z } from "zod";

import { passwordSchema, usernameSchema } from "@/lib/validation";

import {
  ACCESS_CODE_INPUT_MAX_LENGTH,
  ACTIVATION_MESSAGES,
  DISPLAY_NAME_MAX_LENGTH,
  LOGIN_MESSAGES,
  RESET_MESSAGES,
} from "./constants";

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

/**
 * An activation code as typed. The server normalizes case, dashes and spaces before hashing,
 * and any malformed value of normal length is simply an unusable code (counted for rate
 * limiting). An over-long value is refused here with the same message without being counted:
 * it is never compared with a real code, so it reveals nothing.
 */
function accessCodeInput(messages: { codeRequired: string; invalidCode: string }) {
  return z
    .string(messages.codeRequired)
    .trim()
    .min(1, messages.codeRequired)
    .max(ACCESS_CODE_INPUT_MAX_LENGTH, messages.invalidCode);
}
const activationCodeInput = accessCodeInput(ACTIVATION_MESSAGES);
const resetCodeInput = accessCodeInput(RESET_MESSAGES);

/** Step 1 of activation: check the code. */
export const activationCodeSchema = z.object({ code: activationCodeInput });

/** Step 2 of activation: create the account (the code travels in a hidden field). */
export const activateAccountSchema = z.object({
  code: activationCodeInput,
  displayName: z
    .string(ACTIVATION_MESSAGES.displayNameRequired)
    .trim()
    .min(1, ACTIVATION_MESSAGES.displayNameRequired)
    .max(DISPLAY_NAME_MAX_LENGTH, ACTIVATION_MESSAGES.displayNameTooLong),
  username: usernameSchema,
  password: passwordSchema,
  /** A checked checkbox posts "on"; an unchecked one posts nothing. */
  acceptTerms: z.preprocess(
    (value) => value === "on" || value === true,
    z.literal(true, { error: ACTIVATION_MESSAGES.termsRequired }),
  ),
});

export type ActivateAccountInput = z.output<typeof activateAccountSchema>;

/** Step 1 of password reset: check the code. */
export const passwordResetCodeSchema = z.object({ code: resetCodeInput });

/** Step 2 of password reset: the new password (the code travels in a hidden field). */
export const resetPasswordSchema = z.object({
  code: resetCodeInput,
  password: passwordSchema,
});
