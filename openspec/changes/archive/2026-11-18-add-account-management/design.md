# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Bảng `accounts`**: `role` (`admin | doctor`), `status` (`active | locked`), `display_name`, `username`, `created_at`, `last_login_at`. Lần kích hoạt tài khoản và mỗi lần đăng nhập thành công đều ghi `last_login_at`.
- **`src/server/auth/session.ts`**:
  - `validateSessionToken` đã trả `null` khi tài khoản không `active`. Vì vậy bác sĩ bị khoá đã bị chặn ngay, và `access-gate` dọn cookie.
  - Nhưng **dòng phiên vẫn còn trong DB**. Nếu chỉ đổi `status` thì mở khoá xong, máy bị mất lại đăng nhập được.
  - `invalidateAccountSessions(accountId)` đã có sẵn, chưa ai gọi.
- **Đăng nhập** (`authenticate`) đã từ chối tài khoản bị khoá với thông báo riêng khi mật khẩu đúng (spec `account-session`).
- **Module `admin`** đã có `createAction`/`createFormAction` với `access: "admin"`, `ConfirmDialog` (prop `error` nhận `ActionError`), `EmptyState`, `formatDateTime`. Trang `/admin/access-codes` có kiểu danh sách để làm theo.
- **Fixture E2E** đã có tài khoản mẫu: `bs.lan`, `bs.minh` đang hoạt động; `bs.khoa` bị khoá; cùng `setAccountStatus`.

## Goals / Non-Goals

**Goals:**

- Khoá có hiệu lực ngay trên mọi thiết bị.
- Phiên đã kết thúc lúc khoá không bao giờ sống lại, kể cả khi một lần đăng nhập chen đúng lúc khoá.
- Admin không đụng được tài khoản Admin, và không đọc dữ liệu bệnh nhân.

**Non-Goals:**

- Xoá tài khoản, mã đặt lại mật khẩu (xem proposal, mục Ngoài phạm vi).
- Lý do khoá, lịch sử khoá/mở khoá: không có trong idea.md.

## Decisions

### 1. Cấu trúc thư mục

```
src/modules/admin/
├── schemas.ts                       + accountIdSchema ({ id: uuid })
├── constants.ts                     + ACCOUNT_MESSAGES (notFound)
├── server/
│   ├── queries.ts                   + listDoctorAccounts()
│   ├── mutations.ts                 + setDoctorAccountStatus(id, status)
│   └── actions.ts                   + lockAccountAction, unlockAccountAction (createAction, access "admin")
└── components/
    ├── account-list.tsx             server component: danh sách, trạng thái rỗng
    └── account-status-button.tsx    "use client": "Khoá" (ConfirmDialog) / "Mở khoá" (chạy ngay)
src/app/admin/accounts/page.tsx      bỏ FeaturePlaceholder; requirePageAccess("admin")
src/app/admin/accounts/loading.tsx   Skeleton
```

### 2. Khoá và mở khoá: một hàm DAL; khoá xoá phiên; không tài khoản bị khoá nào có phiên mới

`setDoctorAccountStatus(id, status)` chạy trong `db.transaction`:

1. Cập nhật trạng thái, chỉ chạm tài khoản bác sĩ (`doctorAccountById`):
   ```
   UPDATE accounts SET status = $status
   WHERE id = $id AND role = 'doctor'
   RETURNING id
   ```
   Không có dòng nào thì action ném `AppError("NOT_FOUND", "Không tìm thấy tài khoản.")`. Trường hợp này gồm cả id của Admin: không phân biệt "là Admin" với "không tồn tại".
2. **Chỉ khi khoá**, gọi `invalidateAccountSessions(id, {}, tx)`: xoá mọi phiên, kết thúc mọi thiết bị ngay (S8).

**Mở khoá không xoá phiên.** Tài khoản đang bị khoá không thể có phiên nào:

- Lúc khoá, mọi phiên đã bị xoá.
- `createSession` (`src/server/auth/session.ts`) chỉ tạo phiên cho tài khoản đang `active`, bằng một lệnh `INSERT … SELECT … FROM accounts WHERE status = 'active' FOR SHARE`.

Khoá `FOR SHARE` xung đột với khoá dòng của lệnh `UPDATE` khi khoá tài khoản. Vì vậy một lần đăng nhập chen đúng lúc khoá chỉ có hai khả năng:

- Đăng nhập xong trước: lệnh khoá chờ, rồi xoá luôn phiên vừa tạo.
- Đăng nhập chờ lệnh khoá: sau đó thấy `locked` và không tạo phiên. Hành động đăng nhập báo "Tài khoản đã bị khoá".

Nhờ đó phiên đã kết thúc lúc khoá không bao giờ sống lại. Bấm "Mở khoá" hai lần (hai tab) cũng không đăng xuất một bác sĩ vừa đăng nhập lại.

Hai thao tác là idempotent. Action trả `{ id, status }` rồi `revalidatePath(routes.admin.accounts)`.

Các phương án đã cân nhắc:

- **Chỉ đổi `status`, dựa vào `validateSessionToken` để chặn.** Mở khoá thì mọi phiên cũ sống lại, kể cả trên máy bị mất. Trái §8.3.
- **Xoá phiên cả khi mở khoá**, để dọn phiên do đăng nhập chen giữa. Đây là bản đầu khi apply, đã bỏ sau review code:
  - mở khoá một tài khoản đã được mở khoá (tab cũ) sẽ đăng xuất bác sĩ đang dùng;
  - vẫn hở trường hợp khoá rồi mở khoá xảy ra giữa lúc kiểm mật khẩu và lúc tạo phiên.

  Chặn ở chỗ tạo phiên thì đóng race ở một nơi.

- **Đếm phiên theo "phiên bản tài khoản"** (cột `session_version`). Phải có migration. Xoá dòng phiên cộng với chặn lúc tạo phiên đạt cùng kết quả mà không đổi schema.

### 3. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-account-management/mockup/index.html`. Đây là file local, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng (không điều chỉnh bố cục hay câu chữ).

**Hướng hình ảnh:** cùng ngôn ngữ với trang Mã truy cập, dùng bảng màu A và không thêm token. Trang này là công cụ tra cứu, giữ yên lặng: không phần tử nào được nhấn mạnh riêng. Mỗi tài khoản là một dòng gồm:

- **Họ tên**: chữ đậm, `truncate`.
- **Tên đăng nhập**: chữ đậm vừa, `translate="no"`.
- **Trạng thái**:
  - "Đang hoạt động": icon `CircleCheck`, màu `--foreground`.
  - "Đã khoá": icon `Lock`, màu `--destructive`. Họ tên của dòng bị khoá chuyển sang `--muted-foreground`.
- **Dòng phụ**: "Tạo 15/11/2026 · Đăng nhập 18/11/2026 09:45", hoặc "Chưa đăng nhập".
- **Nút bên phải**, cao 44 px, viền:
  - "Khoá" kèm icon `Lock`.
  - "Mở khoá" kèm icon `LockOpen`.

**Bố cục:**

- Điện thoại: tiêu đề "Tài khoản", dòng phụ "Tài khoản bác sĩ. Khoá khi bác sĩ mất máy hoặc ngừng dùng app.", số tài khoản, rồi danh sách trong một thẻ.
- Máy tính: cùng danh sách, rộng tối đa 896 px như khung quản trị.

**Hộp thoại khoá:**

- Tiêu đề "Khoá tài khoản của Nguyễn Thị Lan?"
- Mô tả "Bác sĩ bị đăng xuất khỏi mọi thiết bị ngay và không đăng nhập được cho tới khi bạn mở khoá."
- Hai nút "Không khoá" và "Khoá" (nền đỏ đặc).
- Lỗi (ví dụ `NOT_FOUND`) hiện trong hộp thoại.

**Mở khoá:** không hỏi. Lúc đang chạy, nút có spinner và chữ "Đang mở khoá…". Nếu lỗi thì hiện một dòng `role="alert"` ngay dưới dòng tài khoản.

**Trạng thái trang:**

- Rỗng: `EmptyState` với icon `Users`, "Chưa có tài khoản bác sĩ nào", "Tạo mã kích hoạt rồi gửi cho bác sĩ để họ tự tạo tài khoản.", và liên kết "Tạo mã kích hoạt" tới `/admin/access-codes`.
- Đang tải: `loading.tsx` dùng `Skeleton`.

**Cách kiểm tra:** xem trang thật ở 360/390/1280 px, sáng và tối, so với mockup. Rà bằng `web-design-guidelines`.

**Ghi chú khi apply (18/11/2026), không đổi bố cục đã duyệt:**

- Nút khoá và mở khoá nằm trong một component client `AccountStatusButton`. Sau khi khoá, server `revalidatePath`, và dòng tự đổi sang nút "Mở khoá".
- Lỗi khi khoá hiện trong `ConfirmDialog` (prop `error`). Khi Admin bấm "Đóng", trang `router.refresh()` để hiện trạng thái thật, giống huỷ mã.
- **Sửa sau review code (18/11/2026):**
  - Mở khoá không còn xoá phiên; race giữa đăng nhập và khoá được chặn ở `createSession` (§2).
  - Khoá/Mở khoá là một nút duy nhất, nên focus bàn phím ở lại nút khi trạng thái đổi.
  - Mở khoá lỗi thì làm mới danh sách.
  - Phần "hỏi xác nhận từ một dòng" tách thành `useConfirmedRowAction` (`components/row-action.ts`), dùng chung với nút huỷ mã.
  - Danh sách sắp thêm theo `id` để thứ tự ổn định.
  - Có unit test cho điều kiện `role = 'doctor'` của DAL.
- Đã kiểm trang thật bằng ảnh Playwright ở 390/1280 px, sáng và tối: khớp mockup.
- Đã rà theo `web-design-guidelines`: liên kết của trạng thái rỗng có hover, lỗi có `role="alert"`, nút cao 44 px, tên dài có `truncate`, tên đăng nhập dài được ngắt dòng.

### 4. Quyền và dữ liệu

- `listDoctorAccounts` chọn đúng `id`, `displayName`, `username`, `status`, `createdAt`, `lastLoginAt` từ `accounts`, với điều kiện `role = 'doctor'` và sắp `created_at desc`.
  - Không chọn `password_hash`.
  - Không đụng bảng bệnh nhân, ghi chú hay việc cần làm (N6).
- Trang gọi lại `requirePageAccess("admin")`, như trang Mã truy cập.
- Action dùng `access: "admin"`, nên bác sĩ nhận `FORBIDDEN` và người chưa đăng nhập nhận `UNAUTHENTICATED` trước khi parse input.

### 5. Kiểm thử

**Unit (Vitest):**

- `accountIdSchema`.
- Action, với `guards` thật và session được mock (giống `actions.test.ts` của mã truy cập):
  - bác sĩ nhận `FORBIDDEN`, chưa đăng nhập nhận `UNAUTHENTICATED`, và DAL không được gọi;
  - `NOT_FOUND` khi DAL trả không có dòng;
  - khoá và mở khoá gọi DAL với đúng `status`.

**E2E (PostgreSQL thật), cho mọi scenario của spec:**

- Hai browser context: Admin khoá `bs.lan` trong khi `bs.lan` đang đăng nhập; khoá rồi mở khoá thì phiên cũ không sống lại.
- Fixture thêm `insertDoctor({ lastLoginAt: null })` cho scenario "Chưa đăng nhập".
- Scenario "Khoá tài khoản Admin" là unit test của action và DAL: không gửi được yêu cầu này qua giao diện, vì Admin không có trong danh sách.

## Risks / Trade-offs

- **[Admin khoá nhầm người]** Hộp thoại nêu họ tên. Mở khoá chỉ một chạm, bác sĩ đăng nhập lại bằng mật khẩu cũ.
- **[Đăng nhập đúng lúc bị khoá]** Lần đăng nhập đó bị từ chối với "Tài khoản đã bị khoá", vì `createSession` chờ lệnh khoá. Đúng ý muốn.
- **[Danh sách không phân trang]** Nhóm vài chục người. Khi cần thì thêm sau.

## Migration Plan

Không có migration, không đổi schema. Deploy như bình thường. Rollback: deploy bản trước. Tài khoản đang bị khoá vẫn bị chặn đăng nhập, vì luồng đăng nhập không đổi.
