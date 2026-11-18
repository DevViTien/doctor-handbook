# Proposal

## Why

Bác sĩ đang đăng nhập hiện chưa đổi được mật khẩu. Họ chỉ còn cách nhờ Admin cấp mã đặt lại, việc đó đăng xuất mọi thiết bị kể cả máy đang dùng. idea.md §8.3 chốt: bác sĩ **đổi mật khẩu** thì các phiên trên **thiết bị khác** kết thúc, thiết bị đang dùng vẫn giữ đăng nhập. Đây là mục Must cuối cùng của phần tài khoản bác sĩ (§10, §15).

Change thuộc module **`auth`** (`src/modules/auth`). Màn hình là mục mới trong Cài đặt của bác sĩ. Change đáp ứng các mục sau của idea.md:

- §8.3, D13: đổi mật khẩu kết thúc phiên ở các thiết bị khác.
- §8.2: mật khẩu tối thiểu 8 ký tự, không quy tắc phức tạp.
- §10: đổi mật khẩu khi đang đăng nhập.
- §11: Cài đặt có mục Đổi mật khẩu.
- S2, S6.

## What Changes

- **Thẻ "Đổi mật khẩu"** trong `/settings`, dưới thẻ Tài khoản, gồm ba phần:
  - ô "Mật khẩu hiện tại";
  - ô "Mật khẩu mới" (tối thiểu 8 ký tự, có nút hiện/ẩn);
  - nút "Đổi mật khẩu".
- **Đổi thành công:**
  - Mật khẩu mới có hiệu lực ngay.
  - Thiết bị đang dùng vẫn đăng nhập.
  - **Mọi thiết bị khác bị đăng xuất.**
  - Trang báo "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất." và xoá các ô.
- **Mật khẩu hiện tại sai:** báo "Mật khẩu hiện tại không đúng." dưới ô, không đổi gì. Lần sai được tính chung giới hạn với đăng nhập sai của tên đăng nhập đó: quá 5 lần trong 15 phút thì tạm từ chối, để một phiên bị lộ không dò được mật khẩu.
- **Mật khẩu mới trùng mật khẩu hiện tại:** báo "Mật khẩu mới phải khác mật khẩu hiện tại."
- **Chỉ bác sĩ đã đăng nhập** đổi được mật khẩu của chính mình. Không có ô nào nhận tài khoản từ client.
- Dòng "đang được xây dựng" ở Cài đặt bỏ chữ "đổi mật khẩu".

## Capabilities

### New Capabilities

- `password-change`: bác sĩ đang đăng nhập đổi mật khẩu của mình. Bao gồm kiểm mật khẩu hiện tại, quy tắc mật khẩu mới, kết thúc phiên ở thiết bị khác, giới hạn nhập sai, và quyền truy cập.

### Modified Capabilities

(Không có.) `account-session` giữ nguyên requirement. Đổi mật khẩu dùng chung bộ đếm lần sai theo tên đăng nhập, nhưng hành vi đăng nhập không đổi.

## Impact

- **Thiết kế**: mockup local `mockup/index.html` cho màn hình Cài đặt, người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.
- **Module `auth`**:
  - `schemas.ts`: `changePasswordSchema`.
  - `constants.ts`: `PASSWORD_CHANGE_MESSAGES`.
  - `server/queries.ts`: lấy hash mật khẩu theo id.
  - `server/mutations.ts`: đổi hash và xoá phiên khác, trong một giao dịch.
  - `server/password-change.ts`.
  - `server/actions.ts`: `changePasswordFormAction`, `access: "doctor"`.
  - `components/change-password-form.tsx`.
- **Route**: `src/app/(doctor)/settings/page.tsx`.
- **Tầng dùng chung**: dùng lại `verifyPassword`, `hashPassword`, `invalidateAccountSessions(id, { exceptSessionId })` (đã có sẵn cho đúng việc này), bộ đếm lần sai của đăng nhập (`loginAttemptKeys`, `recordLoginAttempt`…), `PasswordInput`, `FormAlert`.
- **Database**: không đổi schema, không migration. Không ảnh hưởng file sao lưu.
- **Thư viện và dịch vụ**: không thêm.
- **Bất biến**: không vi phạm.
  - Action dựng bằng `createFormAction` với `access: "doctor"`.
  - Tài khoản lấy từ phiên, không bao giờ từ client.
  - Không log mật khẩu.
  - Đổi mật khẩu kết thúc phiên ở thiết bị khác (D13).

## Ngoài phạm vi

- **Admin đổi mật khẩu qua giao diện**: khu quản trị không có Cài đặt. Admin dùng `pnpm db:seed-admin --reset-password` (idea.md R6).
- **Đổi tên hiển thị, đổi tên đăng nhập**: idea.md không có.
- **Danh sách thiết bị đang đăng nhập, đăng xuất từng thiết bị**: idea.md không có.
- **Sao lưu, nhập dữ liệu, thùng rác** trong Cài đặt: các change sau.
