# Module: auth

Doctor-facing authentication. Low-level primitives (sessions, hashing, guards) live in
`src/server/auth`; this module owns the **flows and screens**.

## Scope

- Login with username + password; session cookie that never expires on its own (D13).
- Logout (current device).
- Account activation with a 72-hour, single-use code: choose username + password, accept the
  usage notice (D2, D17, S9).
- Password reset with an admin-issued code — ends every session (§8.3).
- Password change while signed in — ends sessions on other devices.
- Rate limiting of failed logins and code entries via `auth_attempts` (S6).

## Building blocks already available

| Need                                | Use                                                           |
| ----------------------------------- | ------------------------------------------------------------- |
| Hash / verify passwords             | `src/server/auth/password.ts`                                 |
| Create / validate / revoke sessions | `src/server/auth/session.ts`                                  |
| Read / write the session cookie     | `src/server/auth/cookies.ts`                                  |
| Generate / normalize / format codes | `src/server/auth/crypto.ts`                                   |
| Username / password rules           | `usernameSchema`, `passwordSchema` in `src/lib/validation.ts` |

## Notes

- The `?next=` parameter set by `src/proxy.ts` must be validated as a same-origin relative path.
- Return the same error for "unknown username" and "wrong password".
