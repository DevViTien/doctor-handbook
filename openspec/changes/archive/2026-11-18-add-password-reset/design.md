# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Bảng `access_codes`**:
  - Enum `type` đã có `password_reset`.
  - CHECK `access_codes_reset_has_account` bắt buộc mã đặt lại có `account_id`.
  - `accessCodeIsUsable()` (`src/server/auth/access-codes.ts`) là định nghĩa SQL duy nhất của "mã còn dùng được".
- **Luồng kích hoạt** (`src/modules/auth/server/activation.ts`) có sẵn khung dùng lại được:
  - `guardCodeEntry` / `withCodeEntry`: giới hạn theo IP, khoá `code:ip:<sha256>`, chỉ giữ lần thử khi mã không dùng được;
  - kiểm mã rẻ trước khi băm Argon2;
  - giao dịch với `UPDATE … RETURNING` có điều kiện;
  - `createSession(..., tx)`.
- **Tạo phiên**: `createSession` chỉ tạo phiên cho tài khoản `active` (`INSERT … SELECT … FOR SHARE`). Có thêm `invalidateAccountSessions(accountId)`.
- **Admin**:
  - `createAccessCodeFormAction` (sinh mã, thử lại khi trùng hash);
  - `CreateAccessCodeForm` có thẻ `IssuedCodeCard` (mã lớn, sao chép tin nhắn);
  - `/admin/accounts` có `AccountStatusButton` và `useConfirmedRowAction`;
  - `listAccessCodes` hiện lọc `type = 'activation'`.
- **UI dùng chung**: `PasswordInput`, `FormAlert`, `ConfirmDialog`, `Dialog` (shadcn). Trang đăng nhập có dòng phụ dưới form.

## Goals / Non-Goals

**Goals:**

- Đặt lại mật khẩu kết thúc **mọi** phiên của tài khoản, và chỉ một lần cho mỗi mã, kể cả khi có hai lần gửi cùng lúc.
- Một tài khoản chỉ có tối đa một mã đặt lại dùng được tại mỗi thời điểm.
- Tài khoản bị khoá không đổi được mật khẩu bằng mã; mở khoá là việc riêng của Admin.
- Không viết lại khung nhập mã: kích hoạt và đặt lại dùng chung giới hạn và cách ghi lần thử.

**Non-Goals:** đổi mật khẩu khi đang đăng nhập, đặt lại mật khẩu Admin (xem proposal, mục Ngoài phạm vi).

## Decisions

### 1. Cấu trúc thư mục

```
src/modules/auth/server/
├── code-entry.ts            withCodeEntry / guardCodeEntry (chuyển từ activation.ts, không đổi hành vi)
├── activation.ts            dùng code-entry.ts
├── password-reset.ts        checkPasswordResetCode(), resetPassword()
├── queries.ts               + findUsablePasswordResetCode(codeHash) → { username, expiresAt }
├── mutations.ts             + resetPasswordWithCode(...) (một giao dịch)
└── actions.ts               + checkPasswordResetCodeFormAction, resetPasswordFormAction (public)
src/modules/auth/components/password-reset-form.tsx   hai bước, như activation-form
src/modules/auth/schemas.ts                           + passwordResetCodeSchema, resetPasswordSchema
src/modules/auth/constants.ts                         + RESET_MESSAGES

src/modules/admin/server/
├── mutations.ts             + issuePasswordResetCode(accountId, codeHash, expiresAt, createdById)
├── actions.ts               + createPasswordResetCodeAction (createAction, access "admin");
│                              phần sinh mã + thử lại khi trùng hash tách thành issueCode() dùng chung
└── queries.ts               listAccessCodes: cả hai loại, trả thêm type và accountUsername
src/modules/admin/components/
├── issued-code-card.tsx     tách từ create-access-code-form.tsx, nhận loại mã (đường dẫn, câu chữ tin nhắn)
├── password-reset-code-button.tsx   nút trên dòng tài khoản + Dialog hiện mã
├── account-list.tsx         dòng có thêm nút; điện thoại: các nút xuống hàng dưới thông tin
└── access-code-list.tsx     nhãn loại mã; tên đăng nhập cho mã đặt lại
```

### 2. Đặt lại mật khẩu: kiểm rẻ trước, một giao dịch cho phần ghi

`resetPassword({ code, password, ip, userAgent })` chạy trong `withCodeEntry(ip, …)`:

1. `findUsablePasswordResetCode(hash)`. Không có thì là mã không dùng được: giữ lần thử, `NOT_FOUND` với `RESET_MESSAGES.invalidCode`.
2. `hashPassword(password)`, chạy **trước** giao dịch.
3. `resetPasswordWithCode`, trong một giao dịch. **Khoá dòng tài khoản trước, rồi mới tới dòng mã**, cùng thứ tự với lúc Admin cấp mã (§3) và lúc khoá tài khoản, để hai việc không bao giờ deadlock:
   1. Tìm tài khoản của mã còn dùng được, rồi khoá dòng tài khoản đó (`SELECT … FOR UPDATE`). Không có thì trả `invalid-code`. Tài khoản không `active` thì trả `account-locked`; chưa ghi gì, nên mã vẫn còn.
   2. Tiêu mã:
      ```
      UPDATE access_codes SET used_at = now()
      WHERE code_hash = $1 AND type = 'password_reset' AND <còn dùng được> AND account_id = $2
      RETURNING id
      ```
      Không có dòng (vừa bị dùng hay bị huỷ) thì trả `invalid-code`.
   3. Đổi `password_hash`, rồi `invalidateAccountSessions(accountId, {}, tx)`: xoá **mọi** phiên (§8.3).
   4. `createSession(accountId, { userAgent }, tx)`: phiên mới cho thiết bị này. Dòng tài khoản đang bị giữ và `active`, nên luôn tạo được.
4. Kết quả:
   - `account-locked`: `FORBIDDEN` với `LOGIN_MESSAGES.accountLocked`. Mã còn dùng được nên lần thử được xoá. Bước 1 (kiểm mã) cũng báo ngay câu này khi tài khoản đang bị khoá, để bác sĩ không phải gõ mật khẩu mới rồi mới biết.
   - Thành công: action đặt cookie rồi chuyển tới `/patients`.

Vì sao chạy đúng:

- **Hai lần gửi cùng lúc với một mã:** lần thứ hai chờ khoá dòng tài khoản. Lần thứ nhất commit xong thì lệnh `UPDATE` có điều kiện của lần thứ hai không còn dòng nào. Mỗi mã đổi mật khẩu được một lần.
- **Admin khoá, hoặc cấp mã mới, đúng lúc đặt lại:** cả hai đều giành khoá dòng tài khoản trước, nên chạy tuần tự.
  - Khoá chạy trước: đặt lại thấy `locked`.
  - Cấp mã mới chạy trước: mã cũ đã bị huỷ, đặt lại thấy `invalid-code`.
  - Đặt lại chạy trước: việc kia chờ. Khoá thì xoá luôn phiên vừa tạo; cấp mã thì không còn mã cũ nào để huỷ.

Các phương án đã cân nhắc:

- **Đặt lại cũng tự mở khoá tài khoản.** Bỏ: khoá thường là do mất máy, và mở khoá phải là quyết định của Admin (proposal).
- **Đặt lại xong bắt đăng nhập lại** thay vì đăng nhập luôn. Thêm một bước mà không an toàn hơn: người vừa giữ mã và đặt mật khẩu chính là người sẽ đăng nhập. Kích hoạt cũng đăng nhập luôn.
- **Một trang chung cho kích hoạt và đặt lại** (`/activate` nhận cả hai loại mã). Bỏ: hai câu chữ, hai form khác nhau, và spec `access-gate` đã có hai đường dẫn riêng.

### 3. Admin cấp mã đặt lại: tối đa một mã dùng được cho mỗi tài khoản

`createPasswordResetCodeAction({ accountId })` (`createAction`, `access: "admin"`):

1. Gọi `issueCode()` dùng chung với mã kích hoạt: sinh mã, băm, thử lại tối đa 3 lần khi trùng hash.
2. Trong một giao dịch:
   1. Lấy tài khoản: `SELECT display_name, username, status FROM accounts WHERE id = $1 AND role = 'doctor' FOR UPDATE`.
      - Không có dòng (kể cả id của Admin): `NOT_FOUND` "Không tìm thấy tài khoản."
      - Tài khoản bị khoá: `CONFLICT` "Tài khoản đang bị khoá. Mở khoá trước khi cấp mã đặt lại mật khẩu."
   2. Huỷ các mã đặt lại cũ còn dùng được:
      ```
      UPDATE access_codes SET revoked_at = now()
      WHERE account_id = $1 AND type = 'password_reset' AND <còn dùng được>
      ```
   3. Chèn mã mới: `type = 'password_reset'`, `account_id`, `recipient_name = display_name`, `created_by_id = auth.account.id`.
3. Trả `{ code, recipientName, username, expiresAt, kind: "password_reset" }`, rồi `revalidatePath` cả `/admin/accounts` lẫn `/admin/access-codes`.

Khoá dòng tài khoản (`FOR UPDATE`) giữ cho hai lần cấp mã cùng lúc cho một tài khoản chạy tuần tự. Lần sau sẽ huỷ mã của lần trước.

Giao diện: nút "Cấp mã đặt lại mật khẩu" chạy ngay, không hỏi. Cấp mã không phá gì, và lần cấp sau sẽ huỷ mã trước. Kết quả hiện trong một `Dialog` (shadcn) chứa `IssuedCodeCard`:

- Tiêu đề: "Mã đặt lại mật khẩu cho Nguyễn Thị Lan".
- Tin nhắn sao chép:
  > Mã đặt lại mật khẩu Doctor Handbook cho bs.lan: XXXX-XXXX
  > Mở <origin>/reset-password để đặt mật khẩu mới. Mã dùng một lần, hết hạn lúc <giờ>.
- Dòng cảnh báo "Mã chỉ hiện một lần".
- Đóng hộp thoại là mất mã, giống thẻ mã kích hoạt.

Đã cân nhắc giữ mã đặt lại cũ còn dùng được. Bỏ: Admin gửi lại mã mới vì bác sĩ báo chưa nhận được, mà mã cũ lộ qua tin nhắn bị chuyển nhầm thì vẫn dùng được.

### 4. Danh sách mã có hai loại

- `listAccessCodes` bỏ điều kiện `type = 'activation'`. Hàm trả thêm `type` và đổi `usedByUsername` thành `accountUsername`: với mã kích hoạt là tài khoản đã tạo, với mã đặt lại là tài khoản được cấp.
- Mỗi dòng có thêm nhãn loại trước dòng trạng thái:
  - "Kích hoạt" kèm icon `UserPlus`;
  - "Đặt lại mật khẩu" kèm icon `KeyRound`;
  - chữ nhỏ, màu `--muted-foreground`.
- Mã đặt lại luôn hiện `bs.lan` cạnh nhãn. Trạng thái "Đã dùng" của mã kích hoạt vẫn hiện tên đăng nhập như cũ.
- Huỷ mã dùng `revokeAccessCode` có sẵn: hàm này không lọc theo loại mã.

### 5. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-password-reset/mockup/index.html`. Đây là file local, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng (không điều chỉnh bố cục hay câu chữ).

**Hướng hình ảnh:** cùng ngôn ngữ với trang kích hoạt và trang Mã truy cập, dùng bảng màu A, không thêm token. Mã vừa cấp vẫn là phần duy nhất được nhấn mạnh: khung nét đứt, chữ lớn.

**Trang `/reset-password`:**

- Khung giống trang kích hoạt. Tiêu đề "Đặt lại mật khẩu".
- Bước 1:
  - Dòng phụ "Bước 1/2. Nhập mã quản trị viên gửi cho bạn."
  - Ô "Mã đặt lại mật khẩu" (chữ lớn, giãn chữ), nút "Tiếp tục".
- Bước 2:
  - Dòng phụ "Bước 2/2. Đặt mật khẩu mới."
  - Thẻ tóm tắt "Đặt lại mật khẩu cho bs.lan · Hết hạn …" kèm nút "Đổi mã".
  - Ô "Mật khẩu mới" (`PasswordInput`, gợi ý "Tối thiểu 8 ký tự.").
  - Một ô ẩn `autocomplete="username"` chứa tên đăng nhập, để trình quản lý mật khẩu lưu đúng tài khoản.
  - Câu "Mọi thiết bị đang đăng nhập tài khoản này sẽ bị đăng xuất."
  - Nút "Đặt mật khẩu mới".
- Lỗi:
  - Mã không dùng được, bị khoá: khối đỏ.
  - Thử quá nhiều: khối vàng.
  - Bỏ trống mã, mật khẩu ngắn: lỗi dưới ô.
- Chân trang: "Nhớ mật khẩu rồi? Đăng nhập".

**Trang đăng nhập:** thêm liên kết "Quên mật khẩu?" ngay dưới nút "Đăng nhập", căn phải, vùng chạm ≥ 44 px.

**Trang Tài khoản:**

- Dòng đang hoạt động có hai nút: "Cấp mã đặt lại mật khẩu" (icon `KeyRound`) và "Khoá".
  - Điện thoại: các nút xuống dưới phần thông tin, mỗi nút rộng hết dòng và cao 44 px.
  - Máy tính: hai nút ở bên phải.
- Dòng bị khoá chỉ có "Mở khoá".
- Trong lúc cấp mã, nút có spinner và chữ "Đang tạo mã…".
- Lỗi (ví dụ tài khoản vừa bị khoá ở tab khác) hiện dưới dòng, `role="alert"`.

**Trang Mã truy cập:** nhãn loại mã như §4.

**Cách kiểm tra:** xem trang thật ở 360/390/1280 px, sáng và tối, so với mockup. Rà bằng `web-design-guidelines`.

**Ghi chú khi apply và sửa sau review code (18/11/2026), không đổi bố cục đã duyệt:**

- Trên điện thoại, nút "Cấp mã đặt lại mật khẩu" và "Khoá" vừa một hàng dưới phần thông tin (mockup xếp hai hàng). Mỗi nút vẫn rộng theo dòng và cao 44 px.
- Thẻ mã vừa tạo tách thành `IssuedCodeDetails` (`issued-code-card.tsx`), dùng cho cả hai loại mã.
- Hộp thoại mã đặt lại không đóng khi chạm ra ngoài: mã chỉ hiện một lần, chỉ nút "Đóng" (hoặc Esc) mới đóng.
- **Sửa sau review code:**
  - Giao dịch đặt lại khoá dòng tài khoản trước (tránh deadlock với cấp mã, §2).
  - Bước 1 báo ngay khi tài khoản bị khoá.
  - Cấp mã bị từ chối thì làm mới dòng tài khoản.
  - Cấp mã revalidate cả `/admin/accounts`.
  - Giới hạn danh sách mã nâng lên 200 dòng, vì giờ tính chung hai loại mã.
- Đã kiểm trang thật bằng ảnh Playwright ở 390/1280 px, sáng và tối: khớp mockup.

### 6. Kiểm thử

**Unit:**

- Schema đặt lại.
- `password-reset.ts`, mock DAL:
  - mã sai giữ lần thử;
  - bị khoá trả `FORBIDDEN` và xoá lần thử;
  - thành công;
  - bị chặn thì không băm.
- `createPasswordResetCodeAction`: `FORBIDDEN` cho bác sĩ, `NOT_FOUND`, `CONFLICT` khi bị khoá, thử lại khi trùng hash.
- Kích hoạt vẫn xanh sau khi chuyển `code-entry.ts`.

**E2E:**

- Mọi scenario của `password-reset`, và các scenario mới hoặc đã sửa của `access-codes`.
- Fixture `insertAccessCode({ type: "password_reset", usedBy })` đã gắn được tài khoản. Thêm tham số `forAccount` để chọn tài khoản cho mã đặt lại.

## Risks / Trade-offs

- **[Admin đóng hộp thoại trước khi sao chép]** Mã mất; bấm cấp lại, mã cũ tự bị huỷ. Có dòng cảnh báo trong hộp thoại.
- **[Người giữ mã đặt lại biết tên đăng nhập]** Bước 1 hiện tên đăng nhập của tài khoản. Chỉ người giữ mã còn hạn mới thấy, và đúng ra họ là chủ tài khoản.
- **[Mã đặt lại lộ trước khi bác sĩ dùng]** Ai có mã cũng đặt được mật khẩu, giống mã kích hoạt. Giảm rủi ro bằng hạn 72 giờ, một lần, cấp mã mới thì mã cũ bị huỷ, và Admin huỷ được ngay.

## Migration Plan

Không có migration, không đổi schema. Deploy như bình thường. Rollback: deploy bản trước. Mã đặt lại đã cấp nằm yên trong DB; bản trước không có trang dùng chúng.
