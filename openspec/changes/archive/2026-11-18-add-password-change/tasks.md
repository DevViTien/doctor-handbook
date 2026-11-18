# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: màn hình Cài đặt có thẻ Đổi mật khẩu ở các trạng thái mặc định, đang gửi, sai mật khẩu hiện tại, mật khẩu mới ngắn, trùng mật khẩu, thử quá nhiều, thành công; sáng và tối; điện thoại và máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px (đã kiểm 18/11/2026).
- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §3 (mục "Trạng thái duyệt").

## 1. Phía server (module `auth`)

- [x] 1.1 Thêm `changePasswordSchema` vào `schemas.ts` và `PASSWORD_CHANGE_MESSAGES` vào `constants.ts`. Kiểm bằng unit test: "Mật khẩu mới quá ngắn", mật khẩu không bị cắt khoảng trắng.
- [x] 1.2 Viết `findPasswordHash` trong `queries.ts` và `changePasswordHash` trong `mutations.ts`. `changePasswordHash` chạy trong một giao dịch: chỉ đổi khi tài khoản `active`, rồi xoá mọi phiên trừ phiên hiện tại. Kiểm: `pnpm typecheck`, và E2E ở nhóm 3.
- [x] 1.3 Viết `password-change.ts` theo design §2. Kiểm bằng unit test các scenario "Mật khẩu hiện tại sai" (giữ lần thử), "Sai quá nhiều lần" (không kiểm mật khẩu), "Mật khẩu mới trùng mật khẩu hiện tại", "Đổi mật khẩu thành công" (xoá đếm, `exceptSessionId`), và trường hợp tài khoản vừa bị khoá.
- [x] 1.4 Viết `changePasswordFormAction` (`createFormAction`, `access: "doctor"`). Kiểm bằng unit test "Chưa đăng nhập gửi yêu cầu đổi mật khẩu" (`UNAUTHENTICATED`) và "Admin gửi yêu cầu đổi mật khẩu" (`FORBIDDEN`).

## 2. Giao diện

- [x] 2.1 Viết `components/change-password-form.tsx` (`useActionState`, hai `PasswordInput`, ô ẩn `username`, thông báo thành công `role="status"`, focus ô lỗi) và thêm thẻ vào `src/app/(doctor)/settings/page.tsx`; sửa dòng placeholder. Kiểm: so với mockup ở 360/390/1280 px, sáng và tối.

## 3. E2E và tài liệu

- [x] 3.1 Viết `tests/e2e/password-change.spec.ts` cho mọi scenario E2E của `specs/password-change/spec.md`:
  - "Đổi mật khẩu thành công";
  - "Thiết bị đang dùng vẫn đăng nhập, thiết bị khác bị đăng xuất";
  - "Mật khẩu hiện tại sai";
  - "Sai quá nhiều lần";
  - "Mật khẩu mới quá ngắn";
  - "Mật khẩu mới trùng mật khẩu hiện tại";
  - "Thuộc tính ô đổi mật khẩu";
  - "Không lộ mật khẩu lên URL khi đổi".

  Kiểm: chạy xanh với PostgreSQL local.

- [x] 3.2 Cập nhật `src/modules/auth/README.md`. Kiểm: `pnpm format:check` xanh.

## 4. Kiểm tra cuối

- [x] 4.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại Cài đặt ở 390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 4.2 Đối chiếu `specs/password-change/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Admin đổi mật khẩu qua giao diện, danh sách thiết bị: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-password-change --yes` trong cùng PR với task cuối.
