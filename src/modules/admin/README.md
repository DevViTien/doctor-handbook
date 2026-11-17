# Module: admin

Account administration for the single admin (the project owner).

## Scope

- Issue activation codes (with the recipient's name) and password-reset codes for an account;
  copy the formatted code (`formatAccessCode`) to send via chat.
- List codes by state: valid / used / expired / revoked; revoke unused codes.
- List doctor accounts: name, username, created at, last login, last backup, patient count.
- Lock / unlock an account — locking ends every session immediately (S8).
- Delete an account and all its data, confirmed by typing the username (D21).

## Hard rule (idea.md N6)

The admin **never** reads patient data. Admin queries touch `accounts`, `access_codes` and
aggregate counts only. All actions use `access: "admin"` in `createAction`.

## Notes

- The admin account itself is created by `pnpm db:seed-admin`, never through the UI.
