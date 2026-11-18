# Design

## Context

Lý do làm change này: xem proposal.md (mục Why). Những gì code đã có:

- **Bảng `access_codes`** (migration `0001`) có sẵn các cột:
  - `type` (`activation | password_reset`)
  - `code_hash`, có unique index
  - `recipient_name`
  - `account_id`: với mã kích hoạt là tài khoản được tạo; có CHECK bắt buộc với mã đặt lại mật khẩu
  - `created_by_id`, `expires_at`, `used_at`, `revoked_at`, `created_at`
- **Bảng `accounts`** có `display_name`, `terms_accepted_at`, `username` (unique, CHECK chữ thường) và `last_login_at`.
- **`src/server/auth/crypto.ts`**:
  - `generateAccessCode()`: 8 ký tự từ `ACCESS_CODE_ALPHABET`, không có 0/O/1/I/L.
  - `normalizeAccessCode()`: chuyển hoa, bỏ ký tự không phải chữ/số.
  - `formatAccessCode()`: `XXXX-XXXX`.
  - `hashAccessCode()`: HMAC-SHA256 với `ACCESS_CODE_PEPPER`.
- **`src/server/auth/constants.ts`**: `ACCESS_CODE_TTL_MS` (72 giờ).
- **`src/lib/validation.ts`**: `usernameSchema` (trim, lowercase, `^[a-z0-9._]{3,32}$`, đã có thông báo tiếng Việt) và `passwordSchema` (8–128 ký tự).
- **Có sẵn từ change `add-account-login`**:
  - `createFormAction`, dùng với `useActionState` và `<form action>` (POST, chạy được khi chưa có JS).
  - `createSession`, `setSessionCookie`, `getClientIp`, `recordLoginSuccess`.
  - Mẫu giới hạn số lần thử kiểu "ghi rồi đếm" trên `auth_attempts` (`src/modules/auth/server/rate-limit.ts`).
- **`access-gate`**: `/activate` là trang công khai. `(auth)/layout.tsx` chuyển người đã đăng nhập về trang chính. `/admin/*` chỉ dành cho Admin (`requirePageAccess("admin")`).
- **Thành phần giao diện có sẵn**: `ConfirmDialog`, `EmptyState`, `Badge`, `Field`, `Input`, `Spinner`, `Toaster` (sonner, đã gắn ở `AppProviders`). `formatDateTime` hiển thị giờ Việt Nam.
- **Phân tầng**: module không import lẫn nhau. `admin` và `auth` chỉ dùng chung qua `src/server/*` và `src/lib/*`.

## Goals / Non-Goals

**Goals:**

- Một mã chỉ tạo được đúng một tài khoản, kể cả khi hai lần gửi đến cùng lúc. Database đảm bảo điều này, không dựa vào kiểm tra trong code.
- Database bị lộ cũng không lộ mã dùng được: mã là HMAC có pepper ngoài DB, mật khẩu là Argon2id.
- Thông báo lỗi và giới hạn số lần nhập mã không cho dò mã.
- Kích hoạt chạy được trên điện thoại kể cả khi JavaScript chưa tải xong.

**Non-Goals:**

- Mã đặt lại mật khẩu (`add-password-reset`). Bố cục và schema đã chừa sẵn: hàm tính trạng thái và danh sách nhận `type`.
- Xem lại mã cũ, đặt hạn khác 72 giờ, tạo nhiều mã một lần.

## Decisions

### 1. Cấu trúc thư mục

```
src/modules/admin/
├── schemas.ts                 createAccessCodeSchema (recipientName), revokeAccessCodeSchema (id)
├── constants.ts               ADMIN_MESSAGES (thông báo tiếng Việt)
├── access-code-status.ts      getAccessCodeStatus(row, now): hàm thuần, có test
├── server/
│   ├── queries.ts             listAccessCodes(): chỉ access_codes + accounts.username
│   ├── mutations.ts           insertAccessCode(), revokeAccessCode()
│   └── actions.ts             createAccessCodeFormAction, revokeAccessCodeAction
└── components/
    ├── create-access-code-form.tsx   "use client": form + thẻ mã vừa tạo + nút sao chép
    ├── access-code-list.tsx          server component: danh sách, trạng thái rỗng
    └── revoke-access-code-button.tsx "use client": ConfirmDialog + gọi action

src/modules/auth/
├── schemas.ts                 + activationCodeSchema, activateAccountSchema
├── constants.ts               + ACTIVATION_MESSAGES, lưu ý sử dụng (§19)
├── server/
│   ├── activation.ts          checkActivationCode(), activateAccount(): luồng thuần, mock được
│   ├── rate-limit.ts          + codeAttemptKey(), isCodeEntryBlocked()
│   └── actions.ts             + checkActivationCodeFormAction, activateAccountFormAction
└── components/
    └── activation-form.tsx    "use client": hai bước, một component

src/server/auth/attempts.ts    + recordAttempts / countRecentAttempts / forgetAttempts dùng chung
src/server/auth/constants.ts   + CODE_ENTRY_MAX_FAILURES_PER_IP = 10, CODE_ENTRY_FAILURE_WINDOW_MS = 15 phút
src/server/db/errors.ts        isUniqueViolation(error, constraint)
```

- **Phần đếm lần thử dùng chung.** Ghi, đếm và xoá lần thử theo danh sách khoá được chuyển từ `modules/auth/server/rate-limit.ts` xuống `src/server/auth/attempts.ts`. Đăng nhập và nhập mã dùng chung, và sau này `add-password-reset` cũng dùng. Hành vi đăng nhập giữ nguyên: test cũ phải xanh mà không sửa kỳ vọng.
- **Hai module tách nhau.** `admin` không import `auth` và ngược lại. Phần dùng chung (băm mã, hằng số) đã nằm ở `src/server/auth`.

### 2. Kích hoạt hai bước trên một trang, mã đi theo form

Bước 1 là `checkActivationCodeFormAction` (`access: "public"`):

1. Giới hạn theo IP (mục 4).
2. Băm mã, tìm dòng `type = 'activation'`, chưa dùng, chưa huỷ, còn hạn.
3. Trả `{ code, recipientName, expiresAt }`. `code` ở dạng chuẩn, không dấu gạch.

Bước 2 là `activateAccountFormAction` (`access: "public"`):

- Form bước 2 có `<input type="hidden" name="code">` mang mã của bước 1.
- Server kiểm lại mã trong giao dịch (mục 3).
- Component `ActivationForm` giữ state hiện bước nào. Kết quả bước 1 thành công thì hiện bước 2. Lỗi `NOT_FOUND` ở bước 2 (mã vừa hết hạn, bị huỷ hoặc bị dùng) thì quay về bước 1 cùng thông báo.
- Bước 2 có nút "Đổi mã" để quay về bước 1.

Các phương án đã cân nhắc:

- **(a) Một form gồm cả mã, họ tên, tên đăng nhập, mật khẩu.** Code ít hơn. Nhưng gõ sai mã thì cả form báo lỗi, và không hiện được "mã của BS. Trần Thị B" để bác sĩ biết mình đúng mã trước khi đặt mật khẩu.
- **(b) Bước 1 ghi mã đã kiểm vào cookie ký.** Thêm một cookie và một khoá ký mà không bảo mật hơn: mã vẫn được kiểm lại ở bước 2.
- **(c) Đưa mã lên URL `/activate?code=`.** Mã sẽ nằm trong lịch sử trình duyệt và log. Bị loại (proposal, mục Ngoài phạm vi).
- **Chọn hai bước, mã ở trường ẩn.** Mã chỉ nằm trong thân POST. Bước 2 không tin bước 1, luôn kiểm lại. Không thêm trạng thái phía server.

**Thông báo khi mã không dùng được.** Một thông báo cho mọi trường hợp mã không dùng được, kể cả mã đặt lại mật khẩu đem dùng ở trang kích hoạt: `AppError("NOT_FOUND", ACTIVATION_MESSAGES.invalidCode)`. Server không phân biệt lý do khi trả lời. Truy vấn chỉ có một điều kiện `WHERE` gộp, nên cũng không lộ lý do qua thời gian phản hồi.

### 3. Kích hoạt trong một giao dịch, database đảm bảo mã chỉ dùng một lần

`activateAccount({ code, displayName, username, password, ip })` chạy như sau:

1. **Ghi lần thử rồi mới đếm** theo khoá IP (mục 4). Bị chặn thì xoá lần thử vừa ghi và trả `RATE_LIMITED`.
2. **`hashPassword(password)` trước khi mở giao dịch.** Argon2 mất khoảng 50–100 ms; làm trước để không giữ khoá dòng trong lúc băm.
3. **Mở giao dịch** (`db.transaction`):
   1. Đánh dấu mã đã dùng, chỉ khi mã còn dùng được:
      ```
      UPDATE access_codes SET used_at = now()
      WHERE code_hash = $1 AND type = 'activation' AND used_at IS NULL
        AND revoked_at IS NULL AND expires_at > now()
      RETURNING id
      ```
      Không có dòng nào thì ném `NOT_FOUND`. Lần thử đã ghi được giữ lại làm lần sai.
   2. `INSERT accounts` với `role = 'doctor'`, `status = 'active'`, `display_name`, `username`, `password_hash`, `terms_accepted_at = now()`, `last_login_at = now()`. Vi phạm `accounts_username_key` thì ném `AppError("CONFLICT", …, { fieldErrors: { username: [...] } })`. Giao dịch rollback nên `used_at` cũng được trả lại: mã vẫn còn hạn.
   3. `UPDATE access_codes SET account_id = <id mới>`.
   4. `createSession(accountId, { userAgent }, tx)`: phiên nằm trong cùng giao dịch.
4. **Sau khi commit:** xoá lần thử vừa ghi (không phải lần sai), `setSessionCookie(token)`, rồi `redirect(routes.doctor.patients)`.

Vì sao hai lần gửi cùng lúc chỉ tạo được một tài khoản:

- Ở mức READ COMMITTED, lệnh `UPDATE` thứ hai đứng chờ khoá dòng.
- Khi giao dịch thứ nhất commit, PostgreSQL kiểm lại `WHERE` trên bản dòng mới. Lúc này `used_at` đã có giá trị, nên `UPDATE` thứ hai không chạm dòng nào.
- Nếu giao dịch thứ nhất rollback (ví dụ tên đăng nhập trùng), giao dịch thứ hai được đi tiếp.

Các phương án đã cân nhắc:

- **`SELECT` rồi kiểm trong code rồi mới `UPDATE`.** Có khe hở giữa hai bước; muốn đúng phải thêm `FOR UPDATE`. Một lệnh `UPDATE … RETURNING` có điều kiện thì gọn hơn.
- **Kiểm tên đăng nhập trùng bằng một `SELECT` trước.** Vẫn có thể trùng nếu hai lần gửi cùng lúc, nên phải bắt lỗi unique bằng `isUniqueViolation(error, "accounts_username_key")`. Có thêm `SELECT` trước để báo lỗi sớm (khi mã sai thì không cần) cũng không làm sai, nhưng không cần.

**Tên đăng nhập trùng.** Biết được "tên này đã có người dùng" là lộ một tên đăng nhập có thật, nhưng chỉ người đang giữ một mã còn hạn mới thấy, và không có cách nào khác để chọn tên. Chấp nhận.

### 4. Giới hạn nhập sai mã

- **Khoá:** `code:ip:<sha256(ip)>` trong `auth_attempts`. Ngưỡng: quá 10 lần sai trong 15 phút (`isCodeEntryBlocked(count)`: chặn khi số lần thử, tính cả lần này, lớn hơn 10).
- **Cách đếm** giống đăng nhập: ghi lần thử, đếm, rồi quyết định.
  - Mã dùng được: xoá lần thử vừa ghi.
  - Lỗi tên đăng nhập trùng: xoá lần thử vừa ghi.
  - Mã không dùng được: giữ lại làm lần sai.
  - Lỗi Zod (trống mã, tên sai định dạng…) xảy ra trước handler nên không bao giờ được ghi.
- **IP `"unknown"`** dùng một nhóm chung `code:ip:unknown`. Đăng nhập thì không như vậy: ở đó IP không rõ thì bỏ giới hạn theo IP, vì vẫn còn giới hạn theo tên đăng nhập. Nhập mã không có khoá thứ hai, nên bỏ giới hạn là để dò mã vô hạn. Trên Vercel IP luôn có, nên nhóm chung chỉ gặp ở môi trường không có proxy.
- **Độ an toàn:** mã có 31⁸ ≈ 8,5·10¹¹ khả năng. Mỗi IP thử được khoảng 960 lần/ngày. Nhóm nhỏ thường chỉ có vài mã còn hạn cùng lúc, nên một IP gần như không thể đoán trúng trong 72 giờ.
- **Các phương án đã cân nhắc:**
  - Giới hạn toàn hệ thống: kẻ xấu chặn được mọi người kích hoạt. Bị loại.
  - Khoá mã sau N lần sai: kẻ xấu không biết mã nào để khoá, nên không có tác dụng.
  - CAPTCHA: dịch vụ ngoài.

### 5. Admin tạo, xem và huỷ mã

- **`createAccessCodeFormAction`** (`access: "admin"`, `createFormAction`):
  - `recipientName`: `requiredText(80)`, thông báo "Nhập tên người nhận mã.".
  - `generateAccessCode()`, rồi `INSERT` với `code_hash = hashAccessCode(code)`, `expires_at = now + ACCESS_CODE_TTL_MS`, `created_by_id = auth.account.id`.
  - Nếu trùng `access_codes_code_hash_key` (xác suất ~10⁻¹²) thì sinh mã khác, thử tối đa 3 lần rồi mới `INTERNAL`.
  - Trả `{ code: formatAccessCode(code), recipientName, expiresAt }` rồi `revalidatePath(routes.admin.accessCodes)`.
  - Mã chỉ tồn tại trong state của `useActionState` trên trình duyệt. Tải lại trang là mất (spec "Mã chỉ hiện một lần").
- **`revokeAccessCodeAction`** (`access: "admin"`, `createAction`, gọi từ `ConfirmDialog`):
  - Lệnh `UPDATE … SET revoked_at = now() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now() RETURNING id`.
  - Không có dòng nào thì `AppError("CONFLICT", ADMIN_MESSAGES.revokeConflict)`. Thành công thì `revalidatePath`.
- **`listAccessCodes()`**:
  - `access_codes LEFT JOIN accounts ON account_id`, chỉ lấy `accounts.username`.
  - `type = 'activation'`, mới nhất trước, tối đa 100 dòng.
  - Không truy vấn bảng bệnh nhân, ghi chú hay việc cần làm (N6).
  - Không bao giờ chọn cột `code_hash`.
- **`getAccessCodeStatus(row, now)`** trả `revoked`, `used`, `expired` hoặc `active`, theo đúng thứ tự ưu tiên của spec. Đây là hàm thuần và có unit test.
- **Sao chép tin nhắn.** Phía client soạn:

  > Mã kích hoạt Doctor Handbook: K7HM-3QXR
  > Mở <origin>/activate để tạo tài khoản. Mã dùng một lần, hết hạn lúc 21/11/2026 14:05.
  - `<origin>` là `window.location.origin`, nên luôn đúng tên miền đang chạy, không cần biến cấu hình.
  - Chép bằng `navigator.clipboard.writeText`. Không được (trình duyệt cũ, không có quyền) thì báo "Không sao chép được. Hãy chọn và sao chép mã." Mã có `user-select: all`.
  - Nút đổi thành "Đã sao chép" trong 2 giây. Có vùng `role="status"` cho trình đọc màn hình.

- **Lỗi khi huỷ mã** hiện ngay trong hộp thoại (`role="alert"`) rồi đóng khi Admin bấm "Đóng", không dùng toast. Lý do: toast tự biến mất, Admin có thể không kịp đọc vì sao huỷ không được.

**Đã cân nhắc** lưu mã thô (mã hoá) để Admin xem lại. Bị loại vì trái S2. Mất mã thì huỷ và tạo mã mới, chỉ tốn vài giây.

### 6. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-account-activation/mockup/index.html`. Đây là file local, mở thẳng bằng trình duyệt, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng (không điều chỉnh bố cục hay câu chữ).

**Hướng hình ảnh:**

- Giữ bảng màu A "Mực bút bi" đã chốt. **Không thêm token màu mới.**
- Mã kích hoạt là thứ đặc trưng của màn hình nên được nhấn mạnh:
  - Chữ đậm cỡ lớn (28 px), giãn chữ, chữ số dạng bảng (`tabular-nums`), vì đây là thứ Admin đọc qua điện thoại hoặc dán vào Zalo.
  - Đặt trong khung viền nét đứt màu `--primary`, gợi tấm phiếu xé ra từ cuốn sổ.
- Mọi phần khác giữ yên lặng.

**Trang Mã truy cập (`/admin/access-codes`):**

- **Điện thoại:**
  - Thẻ "Tạo mã kích hoạt": ô "Tên người nhận" cao 48 px, gợi ý "Ví dụ: BS. Trần Thị B", nút "Tạo mã" rộng hết thẻ.
  - Ngay dưới form là thẻ mã vừa tạo: mã lớn, "Cho BS. Trần Thị B", "Hết hạn 21/11/2026 14:05", nút "Sao chép tin nhắn", và dòng "Mã chỉ hiện một lần. Tải lại trang là không xem lại được."
  - Tiếp theo là mục "Mã đã tạo": mỗi mã một dòng gồm tên người nhận (`truncate`), dòng phụ ngày tạo, nhãn trạng thái có icon, và với mã "Còn hạn" là nút "Huỷ mã" (cao 44 px).
- **Máy tính (≥ 768 px):** hai cột. Bên trái là thẻ tạo mã và thẻ mã vừa tạo (rộng khoảng 360 px), bên phải là danh sách.
- **Nhãn trạng thái:** có cả icon và chữ, không chỉ màu.

  | Trạng thái | Icon          | Màu                  | Kèm theo                      |
  | ---------- | ------------- | -------------------- | ----------------------------- |
  | Còn hạn    | `Clock`       | `--primary`          | "đến <giờ>"                   |
  | Đã dùng    | `CircleCheck` | `--foreground`       | `bs.tran`, ngày dùng          |
  | Hết hạn    | `CircleSlash` | `--muted-foreground` |                               |
  | Đã huỷ     | `Ban`         | `--muted-foreground` | tên người nhận gạch ngang nhẹ |

- **Hộp thoại huỷ:**
  - Tiêu đề "Huỷ mã của BS. Trần Thị B?"
  - Mô tả "Mã này sẽ không dùng được nữa. Không hoàn tác được."
  - Hai nút "Không huỷ" và "Huỷ mã" (kiểu destructive).
  - Lỗi `CONFLICT` hiện trong hộp thoại.
- **Trạng thái:**
  - Rỗng: `EmptyState` với icon `KeyRound`, "Chưa có mã nào", "Tạo mã đầu tiên ở trên rồi gửi cho bác sĩ qua Zalo."
  - Đang tạo: nút có spinner, "Đang tạo mã…".
  - Lỗi trường: dưới ô tên người nhận.
  - Lỗi chung: khối đỏ trên form.
  - Đang tải trang: `loading.tsx` dùng `Skeleton`.

**Trang kích hoạt (`/activate`)** dùng chung khung với trang đăng nhập (`(auth)/layout.tsx`).

- **Bước 1:**
  - Tiêu đề "Kích hoạt tài khoản", dòng phụ "Bước 1/2. Nhập mã quản trị viên gửi cho bạn."
  - Ô "Mã kích hoạt": chữ 20 px đậm, giãn chữ, `autocapitalize="characters"`, `autocomplete="off"`, `autocorrect="off"`, `spellcheck={false}`, `enterKeyHint="go"`, `inputMode="text"`, `maxLength` 20.
  - Nút "Tiếp tục".
  - Dòng phụ: "Đã có tài khoản? Đăng nhập".
- **Bước 2:**
  - Tiêu đề giữ nguyên, dòng phụ "Bước 2/2. Tạo tài khoản của bạn."
  - Thẻ tóm tắt mã: "Mã cho BS. Trần Thị B, hết hạn 21/11/2026 14:05" và nút chữ "Đổi mã".
  - Các ô:
    - "Họ tên" (điền sẵn).
    - "Tên đăng nhập", gợi ý cố định bên dưới: "3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới. Ví dụ: bs.tran". Thuộc tính `autocomplete="username"`, `autocapitalize="none"`, `autocorrect="off"`, `spellcheck={false}`.
    - "Mật khẩu", gợi ý "Tối thiểu 8 ký tự." Thuộc tính `autocomplete="new-password"`. Có nút hiện/ẩn 44 px như trang đăng nhập.
  - Khối "Trước khi bắt đầu" (nền `--muted`, chữ 15 px) chứa năm ý của §19.
  - Ô tick native cỡ 20 px, nằm trong nhãn cao ≥ 44 px: "Tôi đã đọc và đồng ý".
  - Nút "Tạo tài khoản", lúc gửi đổi thành "Đang tạo tài khoản…".
- **Lỗi:**
  - Mã không dùng được: khối đỏ ở bước 1, icon `CircleAlert`.
  - Thử quá nhiều: khối vàng (`--warning`), icon `Clock`, giống trang đăng nhập.
  - Bỏ trống mã: lỗi dưới ô.
  - Tên đăng nhập sai định dạng, tên đã có người dùng, mật khẩu ngắn, họ tên trống, chưa tick đồng ý: lỗi dưới đúng ô. Có `aria-invalid` và `aria-describedby`, focus vào ô lỗi đầu tiên.
  - Ở bước 2, sau một lần gửi lỗi vẫn giữ họ tên và tên đăng nhập, xoá mật khẩu. Hai ô đầu không có `key` thay đổi theo kết quả, dùng `defaultValue` giống form đăng nhập.
- **Trang đăng nhập:** dòng "Chưa có tài khoản? Liên hệ quản trị viên để nhận mã kích hoạt." đổi thành hai dòng: "Đã có mã kích hoạt? **Kích hoạt tài khoản**" (liên kết, vùng chạm ≥ 44 px) và "Chưa có mã? Liên hệ quản trị viên."

**Cách kiểm tra:** xem màn hình thật ở 360/390/1280 px, sáng và tối, so với mockup. Rà bằng `web-design-guidelines`.

**Điều chỉnh khi apply (18/11/2026), không đổi bố cục đã duyệt:**

- `formatDateTime` ghép từng phần thành `dd/MM/yyyy HH:mm` ("21/11/2026 14:05" như mockup). Lý do: ICU của Node in `vi-VN` thành "14:05 21/11/2026", thứ tự khác trình duyệt; server và client phải ra cùng một chuỗi.
- `FormAlert` chuyển xuống `src/components/common/form-alert.tsx` vì cả `auth` lẫn `admin` dùng.
- `ConfirmDialog` có thêm:
  - prop `error` (một `ActionError`): lỗi hiện trong hộp thoại với đúng màu và icon của mã lỗi, chân hộp thoại chỉ còn nút "Đóng";
  - nút cao 48 px;
  - nút xác nhận kiểu destructive là nền đỏ đặc như mockup. Trước đây màu này bị biến thể "destructive" của `AlertDialogAction` lấn át: thành phần này ghép class qua Radix Slot mà không gộp trùng. Đã sửa tận gốc trong `src/components/ui/alert-dialog.tsx`, ghi chú là chỉnh sửa cục bộ so với bản shadcn.
- Huỷ mã bị từ chối (`CONFLICT`): server không `revalidatePath`, vì dòng mã (và hộp thoại đang báo lỗi) sẽ biến mất trước khi Admin đọc. Khi Admin bấm "Đóng", client mới `router.refresh()`.
- Thẻ "Mã vừa tạo" vẫn giữ khi lần tạo sau bị lỗi (ví dụ bỏ trống tên), để Admin không mất mã chưa kịp gửi. Thẻ cũng đọc kết quả action lúc render đầu, nên hiện được cả khi trang chạy không có JavaScript.
- Ô mã nhận tối đa 32 ký tự (mockup ghi 20), để chỗ cho dấu gạch và khoảng trắng người dùng gõ.
- Khi không có JavaScript: bước 1 và kích hoạt thành công chạy được. Riêng lỗi ở bước 2 (ví dụ tên đăng nhập trùng) thì trang quay về bước 1 không kèm thông báo, vì kết quả action không mang dữ liệu bước 1. Không mất dữ liệu, mã vẫn còn hạn. App luôn chạy với JavaScript nên chấp nhận.
- **Sửa sau review code (18/11/2026):**
  - Bước 2 kiểm mã còn dùng được, rồi kiểm tên đăng nhập trùng, **trước** khi băm Argon2. Người giữ mã thử lại tên trùng chỉ tốn một truy vấn, không tốn một lần băm. Giao dịch vẫn kiểm lại cả hai để đúng khi có hai lần gửi cùng lúc.
  - Lần nhập mã chỉ bị giữ làm lần sai khi mã không dùng được. Thành công, tên trùng và lỗi bất ngờ (DB, băm) đều xoá lần thử (`withCodeEntry`), để lỗi của server không khoá một mã đúng.
  - Mất mã ở bước 2 thì xoá luôn dữ liệu bước 2 đã gõ: mã nhập lại có thể của người khác, nên họ tên phải điền sẵn từ mã mới.
  - Điều kiện "mã còn dùng được" chỉ còn một định nghĩa SQL (`accessCodeIsUsable` trong `src/server/auth/access-codes.ts`), dùng cho cả kích hoạt lẫn huỷ mã.
  - Ô mật khẩu có nút hiện/ẩn tách thành `PasswordInput` (`src/components/common`), dùng chung cho đăng nhập và kích hoạt.
  - Danh sách đủ 100 dòng thì ghi "100 mã mới nhất".
  - Giữ nguyên quyết định ở §4: IP không rõ dùng chung một nhóm. Bỏ giới hạn thì dò mã vô hạn, mà trên Vercel IP luôn có.
- Kiểm thật bằng ảnh Playwright ở 390/1280 px, sáng và tối: khớp mockup. Rà theo `web-design-guidelines`: thêm trạng thái hover cho hai liên kết mới. Gợi ý placeholder kết thúc bằng "…" không áp dụng, vì placeholder ở đây là ví dụ cụ thể ("Ví dụ: BS. Trần Thị B").

### 7. Kiểm thử

**Unit (Vitest):**

- Schema (`createAccessCodeSchema`, `activationCodeSchema`, `activateAccountSchema`): tên có dấu, viết hoa, mật khẩu ngắn, chưa tick, họ tên trống.
- `getAccessCodeStatus`: bốn trạng thái và thứ tự ưu tiên, biên đúng 72 giờ.
- `isCodeEntryBlocked`: biên 10/11.
- `checkActivationCode` và `activateAccount`, mock DAL, rate-limit và mật khẩu:
  - mã sai giữ lần thử;
  - mã đúng xoá lần thử;
  - bị chặn thì không gọi DAL;
  - tên trùng trả `CONFLICT` có `fieldErrors.username` và xoá lần thử.
- Action của admin, mock `guards`:
  - bác sĩ nhận `FORBIDDEN`, chưa đăng nhập nhận `UNAUTHENTICATED`, và mutation không được gọi;
  - tạo mã thử lại khi trùng hash.

**E2E (Playwright, PostgreSQL thật):**

- Fixture `db.ts` thêm `insertAccessCode({ recipient, type, createdMinutesAgo, used, revoked })`. Hàm này trả mã thô, băm bằng HMAC với pepper E2E. Pepper chuyển thành một hằng số dùng chung giữa `playwright.config.ts` và fixture.
- Fixture thêm `insertCodeFailures(count, minutesAgo)` với khoá `code:ip:<sha256("203.0.113.10")>`, và `countAccessCodes()`.
- `resetDatabase` xoá thêm `access_codes`.
- Test chạy mọi scenario của hai spec. Scenario "Hai lần gửi cùng lúc" dùng hai browser context gửi gần như đồng thời.
- Test sao chép:
  - Chromium: cấp quyền `clipboard-read`/`clipboard-write`.
  - WebKit: không cấp được quyền clipboard nên bỏ qua test sao chép.
  - Các test cần cookie phiên trên WebKit bỏ qua như hiện nay (`skipWhenSecureCookiesUnsupported`).

## Risks / Trade-offs

- **Admin làm mất mã vừa tạo (tải lại trang trước khi sao chép).** Thẻ mã có dòng cảnh báo. Huỷ mã cũ rồi tạo mã mới chỉ mất vài giây.
- **Đổi `ACCESS_CODE_PEPPER` làm mọi mã còn hạn mất hiệu lực.** Ghi trong README phần biến môi trường. Pepper chỉ đổi khi nghi bị lộ.
- **Bác sĩ đi hai bước trên hai thiết bị, hoặc mở form quá lâu.** Bước 2 luôn kiểm lại mã. Nếu mã hết hạn thì quay về bước 1 với thông báo rõ.
- **Nhiều bác sĩ ở cùng phòng khám (chung IP) gõ sai mã cùng lúc.** Ngưỡng 10 lần trong 15 phút. Nhóm nhỏ, kích hoạt chỉ một lần trong đời tài khoản, nên hầu như không chạm ngưỡng.
- **Lộ tên đăng nhập đã có (lỗi "đã có người dùng").** Chỉ người giữ mã còn hạn mới thấy được. Chấp nhận (mục 3).
- **Danh sách giới hạn 100 mã mới nhất.** Nhóm vài chục người thì đủ dùng nhiều năm. Phân trang để sau.

## Migration Plan

Không có migration và không đổi schema.

Triển khai:

1. Kiểm `ACCESS_CODE_PEPPER` (≥ 32 ký tự) đã được đặt trên Vercel. `src/config/env.ts` đã bắt buộc biến này.
2. Deploy như bình thường.

Rollback: deploy bản trước. Tài khoản đã kích hoạt vẫn đăng nhập được, vì luồng đăng nhập không đổi. Mã còn hạn vẫn nằm trong DB và dùng được khi deploy lại bản này.
