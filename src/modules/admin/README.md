# Module: admin

Account administration for the single admin (the project owner). Behaviour is specified in
`openspec/specs/access-codes/spec.md` and `openspec/specs/account-management/spec.md`.

## Implemented

| Flow                      | Where                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Issue activation code     | `components/create-access-code-form.tsx` → `server/actions.ts` `createAccessCodeFormAction`                          |
| Copy the message to send  | `IssuedCodeDetails` (`issued-code-card.tsx`): code + `/activate` or `/reset-password` link + expiry                  |
| List codes by status      | `components/access-code-list.tsx` ← `server/queries.ts` `listAccessCodes`; `access-code-status.ts`                   |
| Revoke an unused code     | `components/revoke-access-code-button.tsx` (`ConfirmDialog`) → `revokeAccessCodeAction`                              |
| Validation and messages   | `schemas.ts`, `constants.ts` (`ADMIN_MESSAGES`, `ACCOUNT_MESSAGES`)                                                  |
| List doctor accounts      | `components/account-list.tsx` ← `server/queries.ts` `listDoctorAccounts`                                             |
| Lock / unlock an account  | `components/account-status-button.tsx` → `lockAccountAction`, `unlockAccountAction`                                  |
| Issue password-reset code | `components/password-reset-code-button.tsx` (dialog) → `createPasswordResetCodeAction` → `issuePasswordResetCode`    |
| Show an issued code       | `components/issued-code-card.tsx` `IssuedCodeDetails` (both kinds; the copied message never holds the code in a URL) |

Security properties to preserve:

- Only the HMAC of a code is stored (`hashAccessCode`): the code is shown once, in the response
  of the action that created it, and never again. Never log it.
- The link in the copied message never contains the code.
- Revoking is one conditional `UPDATE` (still unused, unrevoked, unexpired): a code used a moment
  earlier is never marked revoked; the action answers `CONFLICT` instead.
- Status priority: revoked → used → expired → active (`getAccessCodeStatus`).
- Lock and unlock both go through `setDoctorAccountStatus`: one transaction that only touches
  `role = 'doctor'` rows and always deletes every session of the account. Lock ends all devices
  at once (S8); unlock never revives a session ended by a lock. The admin account answers
  `NOT_FOUND`, like an unknown id.
- A password-reset code is issued only for an active doctor; issuing revokes the account's
  earlier usable reset codes in the same transaction (account row locked `FOR UPDATE`), so at
  most one reset code per account can be used.

## Still to build (separate OpenSpec changes)

- Delete an account and all its data, confirmed by typing the username (D21).

## Hard rule (idea.md N6)

The admin **never** reads patient data. Admin queries touch `accounts`, `access_codes` and
aggregate counts only. Every action declares `access: "admin"` in `createAction` /
`createFormAction`; pages re-check with `requirePageAccess("admin")`.

## Notes

- The admin account itself is created by `pnpm db:seed-admin`, never through the UI.
