# Proposal

## Why

Bác sĩ quên mật khẩu hiện không có cách nào vào lại app: không có email, và Admin không bao giờ thấy mật khẩu. Trường hợp mất máy cũng chưa xử lý trọn. Theo idea.md §8.3 và R7: Admin khoá → khi có máy mới, Admin mở khoá **và cấp mã đặt lại mật khẩu** → bác sĩ đặt mật khẩu mới, **mọi phiên cũ bị vô hiệu**. Hai bước đầu đã có (`add-account-management`); change này làm bước cuối.

Change thuộc module **`admin`** (cấp mã từ danh sách tài khoản, mã hiện trong danh sách mã) và **`auth`** (bác sĩ đặt lại mật khẩu ở `/reset-password`). Nó đáp ứng các mục sau của idea.md:

- §8.2: hai loại mã dùng chung một cơ chế (72 giờ, một lần, 8 ký tự, chỉ lưu bản băm, huỷ được, chống dò).
- §8.3: đặt lại mật khẩu bằng mã kết thúc **mọi** phiên.
- §10 phía Admin: tạo mã đặt lại mật khẩu cho một tài khoản. Phía bác sĩ: đặt lại mật khẩu bằng mã do Admin cấp.
- §12.4: luồng quên mật khẩu.
- S2, S6, S8.

## What Changes

- **Admin cấp mã đặt lại mật khẩu** từ dòng tài khoản **đang hoạt động** ở `/admin/accounts`, bằng nút "Cấp mã đặt lại mật khẩu".
  - Mã có cùng định dạng, hạn 72 giờ, chỉ dùng một lần, chỉ lưu bản băm như mã kích hoạt. Mã gắn với đúng tài khoản đó.
  - Mã chỉ hiện một lần, trong một hộp thoại có nút "Sao chép tin nhắn". Tin nhắn gồm mã, đường dẫn `/reset-password` và giờ hết hạn; đường dẫn không chứa mã.
  - Cấp mã mới thì **mọi mã đặt lại còn hạn trước đó của tài khoản này bị huỷ**, để không có hai mã cùng dùng được.
  - Tài khoản đang bị khoá không có nút này: Admin mở khoá trước (theo §8.3).
- **Danh sách mã** ở `/admin/access-codes` hiện cả mã đặt lại mật khẩu.
  - Mỗi dòng có nhãn loại: "Kích hoạt" hoặc "Đặt lại mật khẩu".
  - Mã đặt lại hiện tên đăng nhập của tài khoản được cấp. Huỷ mã dùng chung cho cả hai loại.
  - Form tạo mã ở trang này vẫn chỉ tạo mã kích hoạt.
- **Bác sĩ đặt lại mật khẩu** ở `/reset-password`, hai bước như trang kích hoạt:
  1. Nhập mã. Bác sĩ gõ thế nào cũng được.
  2. Mã dùng được thì hiện tên đăng nhập của tài khoản và giờ hết hạn. Bác sĩ nhập mật khẩu mới (tối thiểu 8 ký tự, có nút hiện/ẩn).

  Khi gửi, server kiểm lại mã, đổi mật khẩu, đánh dấu mã đã dùng, **xoá mọi phiên của tài khoản**, rồi đăng nhập luôn trên thiết bị này và đưa vào `/patients`. Tất cả trong một giao dịch.

- **Thông báo và giới hạn giống trang kích hoạt.**
  - Mã sai, đã dùng, đã huỷ, hết hạn, hoặc là mã kích hoạt: cùng một thông báo "Mã đặt lại mật khẩu không đúng hoặc đã hết hạn. Liên hệ quản trị viên để nhận mã mới."
  - Lần nhập mã sai tính chung giới hạn với trang kích hoạt: 10 lần mỗi IP trong 15 phút.
- **Tài khoản bị khoá sau khi đã cấp mã.** Nếu tài khoản bị khoá trong khoảng từ lúc cấp mã tới lúc dùng, đặt lại bị từ chối với "Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên." Không có gì thay đổi, mã vẫn còn.
- **Trang đăng nhập** có thêm liên kết "Quên mật khẩu?" tới `/reset-password`. Trang đặt lại có liên kết quay lại đăng nhập.

## Capabilities

### New Capabilities

- `password-reset`: bác sĩ dùng mã đặt lại mật khẩu để đặt mật khẩu mới. Bao gồm kiểm mã, quy tắc mật khẩu, kết thúc mọi phiên, đăng nhập lại ngay, thông báo không lộ mã, giới hạn nhập sai, và tài khoản bị khoá.

### Modified Capabilities

- `access-codes`:
  - Thêm requirement "Admin cấp mã đặt lại mật khẩu".
  - Sửa "Danh sách mã theo trạng thái" để danh sách gồm cả mã đặt lại mật khẩu, có nhãn loại.

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.
- **Module `admin`**:
  - `server/mutations.ts`: `issuePasswordResetCode`, trong một giao dịch: huỷ mã đặt lại cũ, chèn mã mới.
  - `server/actions.ts`: `createPasswordResetCodeAction`, `access: "admin"`.
  - `server/queries.ts`: `listAccessCodes` lấy cả hai loại.
  - `components/`:
    - nút và hộp thoại cấp mã trên dòng tài khoản;
    - thẻ "mã vừa tạo" tách ra để dùng chung cho cả hai loại mã;
    - nhãn loại trong danh sách mã.
- **Module `auth`**:
  - `schemas.ts`, `constants.ts`.
  - `server/password-reset.ts`, chung khung giới hạn nhập mã với kích hoạt.
  - `server/queries.ts`, `server/mutations.ts`: `resetPasswordWithCode`.
  - `server/actions.ts`.
  - `components/password-reset-form.tsx`.
- **Route**:
  - `src/app/(auth)/reset-password/page.tsx`: bỏ `FeaturePlaceholder`.
  - `src/app/(auth)/login/page.tsx`: thêm liên kết "Quên mật khẩu?".
- **Tầng dùng chung**: dùng lại `generateAccessCode`, `hashAccessCode`, `accessCodeIsUsable`, `createSession` (chỉ tạo phiên cho tài khoản `active`), `invalidateAccountSessions`, `hashPassword`, `PasswordInput`, `FormAlert`.
- **Database**: **không đổi schema, không migration.**
  - Enum `access_code_type` đã có `password_reset`.
  - CHECK `access_codes_reset_has_account` đã bắt buộc mã đặt lại phải có `account_id`.
  - Không ảnh hưởng file sao lưu (tài khoản và mã không nằm trong sao lưu).
- **Thư viện và dịch vụ**: không thêm.
- **Bất biến**: không vi phạm.
  - Action dựng bằng `createAction`/`createFormAction`: cấp mã khai `access: "admin"`, đặt lại khai `access: "public"`.
  - Admin không thấy mật khẩu. Không log mã hay mật khẩu. Mã không nằm trên URL.
  - Đặt lại mật khẩu kết thúc mọi phiên (D13, S8).

## Ngoài phạm vi

- **Đổi mật khẩu khi đang đăng nhập** (đăng xuất các thiết bị khác): change riêng, ở màn hình Cài đặt của bác sĩ.
- **Đặt lại mật khẩu cho tài khoản Admin**: Admin không có trong danh sách. Quên mật khẩu Admin thì đặt lại bằng lệnh trên server (`pnpm db:seed-admin`, idea.md R6).
- **Mã đặt lại tự mở khoá tài khoản**: không làm. Mở khoá là quyết định riêng của Admin (§8.3).
- **Xoá tài khoản** (D21): change sau.
