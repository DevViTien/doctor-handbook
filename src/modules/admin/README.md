# Module: admin

Account administration for the single admin (the project owner). Behaviour is specified in
`openspec/specs/access-codes/spec.md`.

## Implemented

| Flow                     | Where                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Issue activation code    | `components/create-access-code-form.tsx` → `server/actions.ts` `createAccessCodeFormAction`        |
| Copy the message to send | `IssuedCodeCard` in the same component: code + `/activate` link + expiry, built in the browser     |
| List codes by status     | `components/access-code-list.tsx` ← `server/queries.ts` `listAccessCodes`; `access-code-status.ts` |
| Revoke an unused code    | `components/revoke-access-code-button.tsx` (`ConfirmDialog`) → `revokeAccessCodeAction`            |
| Validation and messages  | `schemas.ts`, `constants.ts` (`ADMIN_MESSAGES`)                                                    |

Security properties to preserve:

- Only the HMAC of a code is stored (`hashAccessCode`): the code is shown once, in the response
  of the action that created it, and never again. Never log it.
- The link in the copied message never contains the code.
- Revoking is one conditional `UPDATE` (still unused, unrevoked, unexpired): a code used a moment
  earlier is never marked revoked; the action answers `CONFLICT` instead.
- Status priority: revoked → used → expired → active (`getAccessCodeStatus`).

## Still to build (separate OpenSpec changes)

- Password-reset codes for an existing account (the list and status helper already take a type).
- List doctor accounts: name, username, created at, last login, last backup, patient count.
- Lock / unlock an account — locking ends every session immediately (S8).
- Delete an account and all its data, confirmed by typing the username (D21).

## Hard rule (idea.md N6)

The admin **never** reads patient data. Admin queries touch `accounts`, `access_codes` and
aggregate counts only. Every action declares `access: "admin"` in `createAction` /
`createFormAction`; pages re-check with `requirePageAccess("admin")`.

## Notes

- The admin account itself is created by `pnpm db:seed-admin`, never through the UI.
