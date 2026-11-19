# Module: feedback

In-app feedback for the trial (idea.md §11 "Nút gửi góp ý trong app", §15). Spec: `feedback`
(change `add-feedback`).

## Scope

- **Doctor**: Cài đặt → "Góp ý" (`/settings/feedback`): one text box (1..2000 characters after
  trim), a privacy reminder, "Gửi góp ý". Success empties the box and says "Đã gửi góp ý.";
  any failure (validation, limit, network, stale page) keeps the text.
- **Limit**: 20 feedback per account in any 24 hours (`RATE_LIMITED`).
- **Admin**: tab "Góp ý" (`/admin/feedback`): the 200 newest, newest first, with sender, time,
  device label and the full text; "Mới" until "Đã xem"; "Xoá" asks first.
- Doctors never read feedback, not even their own. No replies, notifications or attachments.

## Layout

| File                                    | Role                                                              |
| --------------------------------------- | ----------------------------------------------------------------- |
| `schemas.ts`                            | `sendFeedbackSchema` (only `content`), `feedbackIdSchema`         |
| `device.ts`                             | `describeDevice(userAgent)` → "iPhone · Safari"                   |
| `server/mutations.ts`                   | `sendFeedback` (24 h limit), `markFeedbackSeen`, `deleteFeedback` |
| `server/queries.ts`                     | `listFeedback` (admin inbox + unseen and total counts)            |
| `server/actions.ts`                     | send (`createFormAction`, doctor); mark seen, delete (admin)      |
| `components/feedback-form.tsx`          | doctor form, keeps the text on any failure                        |
| `components/feedback-list.tsx`          | admin inbox (server component)                                    |
| `components/mark-seen-button.tsx`       | "Đã xem", no dialog                                               |
| `components/delete-feedback-button.tsx` | "Xoá" + `ConfirmDialog` quoting the first lines                   |

## Rules

- **The browser sends only the text.** The sender is the session's account; the device is the
  request's `User-Agent` (kept up to 400 characters); the deployment is `VERCEL_DEPLOYMENT_ID`.
- **The 24-hour limit locks the sender's account row** (`FOR NO KEY UPDATE`) before counting, so two
  sends at once cannot both pass.
- **Never log, toast or title the text**: a doctor may name a patient by mistake. Logs carry the
  feedback id only; the admin is told to delete such feedback after reading.
- **Admin isolation (N6)**: the inbox joins `accounts` for the display name and username only.

## Data

Table `feedback` (`src/server/db/schema/feedback.ts`). `seen_at IS NULL` means new.
`account_id` is `ON DELETE SET NULL`: deleting an account keeps its feedback, shown as "Tài
khoản đã xoá". **Not part of backups or imports** (a message to the admin, not notebook data;
approved exception to the backup invariant in `openspec/config.yaml`).
