# Module: auth

Doctor- and admin-facing authentication. Low-level primitives (sessions, hashing, guards) live in
`src/server/auth`; this module owns the **flows and screens**. Behaviour is specified in
`openspec/specs/account-session/spec.md` (and `access-gate` for redirects).

## Implemented

| Flow                 | Where                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Login                | `components/login-form.tsx` → `server/actions.ts` `loginFormAction` → `server/login.ts`     |
| Logout (this device) | `components/logout-button.tsx` → `logoutAction` (idempotent, works without a live session)  |
| Login rate limiting  | `server/rate-limit.ts`: 5 failures per username / 20 per IP in 15 min, in `auth_attempts`   |
| Validation           | `schemas.ts` (`loginSchema`): username trimmed + lowercased, password never trimmed         |
| Messages             | `constants.ts` (`LOGIN_MESSAGES`); rate limiting uses `DEFAULT_ERROR_MESSAGES.RATE_LIMITED` |

Security properties to preserve:

- Same message for an unknown username and a wrong password; unknown usernames still verify a
  (dummy) Argon2 hash so timing does not reveal them.
- A locked account is only revealed when the password is correct.
- Rate limiting runs before the password check; refused attempts are not counted.
- Attempt keys are SHA-256 hashes: no raw username or IP is stored.
- `next` is followed only through `getSafeRedirectPath`.
- Never log usernames or passwords.

## Still to build (separate OpenSpec changes)

- Account activation with a 72-hour, single-use code: choose username + password, accept the
  usage notice (D2, D17, S9).
- Password reset with an admin-issued code — ends every session (§8.3).
- Password change while signed in — ends sessions on other devices.

## Building blocks

| Need                                | Use                                                           |
| ----------------------------------- | ------------------------------------------------------------- |
| Hash / verify passwords             | `src/server/auth/password.ts`                                 |
| Create / validate / revoke sessions | `src/server/auth/session.ts`                                  |
| Read / write the session cookie     | `src/server/auth/cookies.ts`                                  |
| Generate / normalize / format codes | `src/server/auth/crypto.ts`                                   |
| Client IP for rate limiting         | `src/server/http/client-ip.ts`                                |
| Username / password rules           | `usernameSchema`, `passwordSchema` in `src/lib/validation.ts` |
