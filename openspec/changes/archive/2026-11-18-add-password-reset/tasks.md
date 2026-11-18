# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi:
  - Trang `/reset-password`:
    - bước 1: mặc định, đang kiểm, bỏ trống, mã không dùng được, thử quá nhiều;
    - bước 2: mặc định, đang gửi, mật khẩu ngắn, bị khoá.
  - Trang đăng nhập có "Quên mật khẩu?".
  - Trang Tài khoản: dòng có nút cấp mã, đang tạo, hộp thoại mã vừa cấp, đã sao chép, lỗi.
  - Trang Mã truy cập: nhãn loại mã.
  - Sáng và tối, điện thoại và máy tính.

  Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px (đã kiểm 18/11/2026).

- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §5 (mục "Trạng thái duyệt").

## 1. Khung nhập mã dùng chung

- [x] 1.1 Chuyển `guardCodeEntry` và `withCodeEntry` từ `activation.ts` sang `src/modules/auth/server/code-entry.ts`, không đổi hành vi. Kiểm: `activation.test.ts` xanh mà không sửa kỳ vọng.

## 2. Đặt lại mật khẩu (module `auth`, server)

- [x] 2.1 Viết `schemas.ts` (`passwordResetCodeSchema`, `resetPasswordSchema`) và `RESET_MESSAGES` trong `constants.ts`. Kiểm bằng unit test các scenario "Bỏ trống mã đặt lại", "Mật khẩu mới quá ngắn".
- [x] 2.2 Viết DAL:
  - `findUsablePasswordResetCode` trong `queries.ts`: join tài khoản, chỉ loại `password_reset`, còn dùng được.
  - `resetPasswordWithCode` trong `mutations.ts`, theo design §2: tiêu mã, đổi mật khẩu chỉ khi bác sĩ đang hoạt động (nếu không thì rollback), xoá mọi phiên, tạo phiên.

  Kiểm: `pnpm typecheck`, và E2E ở nhóm 5.

- [x] 2.3 Viết `password-reset.ts` (`checkPasswordResetCode`, `resetPassword`) dùng `code-entry.ts`. Kiểm bằng unit test có mock DAL:
  - "Nhập mã đặt lại đúng".
  - "Mã đặt lại không tồn tại": giữ lần thử.
  - "Mã kích hoạt dùng ở trang đặt lại".
  - "Bị khoá sau khi được cấp mã": `FORBIDDEN`, xoá lần thử.
  - "Quá nhiều lần nhập mã sai": không băm.
  - Thành công.
- [x] 2.4 Viết `checkPasswordResetCodeFormAction` và `resetPasswordFormAction` trong `actions.ts` (`access: "public"`, đặt cookie, chuyển tới `/patients`). Không log mã hay mật khẩu. Kiểm: `pnpm typecheck`.

## 3. Admin cấp mã đặt lại (module `admin`)

- [x] 3.1 Tách `issueCode()` (sinh mã, thử lại khi trùng hash) để dùng chung trong `server/actions.ts`. Viết `issuePasswordResetCode` (giao dịch theo design §3) và `createPasswordResetCodeAction`. Thông báo đặt trong `ACCOUNT_MESSAGES`. Kiểm bằng unit test:
  - "Bác sĩ gửi yêu cầu cấp mã đặt lại": `FORBIDDEN`.
  - `NOT_FOUND`.
  - `CONFLICT` khi bị khoá.
  - Thử lại khi trùng hash.
  - Kết quả có tên đăng nhập.
- [x] 3.2 `listAccessCodes`: lấy cả hai loại mã, trả `type` và `accountUsername`. Kiểm: `pnpm typecheck`.

## 4. Giao diện

- [x] 4.1 Tách `IssuedCodeCard` ra `components/issued-code-card.tsx`, nhận loại mã (đường dẫn, câu chữ tin nhắn); `CreateAccessCodeForm` dùng lại. Kiểm: E2E `access-codes.spec.ts` vẫn xanh.
- [x] 4.2 Viết `components/password-reset-code-button.tsx` (nút, `Dialog` hiện mã, lỗi dưới dòng) và cập nhật `account-list.tsx` (bố cục nút theo mockup). Kiểm: so với mockup ở 360/390/1280 px, sáng và tối.
- [x] 4.3 Nhãn loại mã trong `access-code-list.tsx`. Kiểm: so với mockup.
- [x] 4.4 Viết `components/password-reset-form.tsx` (hai bước, ô ẩn `username`, `PasswordInput`), `src/app/(auth)/reset-password/page.tsx` (bỏ `FeaturePlaceholder`), và liên kết "Quên mật khẩu?" ở trang đăng nhập. Kiểm: so với mockup, và `account-session.spec.ts` vẫn xanh.

## 5. E2E và tài liệu

- [x] 5.1 Fixture: `insertAccessCode` nhận `forAccount` cho mã đặt lại. Viết `tests/e2e/password-reset.spec.ts` cho mọi scenario của `specs/password-reset/spec.md`, và thêm vào `access-codes.spec.ts` các scenario "Cấp mã đặt lại cho bác sĩ quên mật khẩu", "Cấp mã mới thì mã cũ bị huỷ", "Tài khoản bị khoá không có nút cấp mã đặt lại", "Mã đặt lại mật khẩu trong danh sách". Kiểm: chạy xanh với PostgreSQL local.
- [x] 5.2 Cập nhật `src/modules/auth/README.md` và `src/modules/admin/README.md`. Kiểm: `pnpm format:check` xanh.

## 6. Kiểm tra cuối

- [x] 6.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) đều xanh.
  - Xem lại các trang đã đổi ở 390 px và 1280 px, sáng và tối, so với mockup.
  - Rà bằng `web-design-guidelines`.
  - Không còn `FeaturePlaceholder` ở `/reset-password`.
- [x] 6.2 Đối chiếu delta spec (`password-reset`, `access-codes`) với code hiện tại. Diff trọn thân khối MODIFIED "Danh sách mã theo trạng thái" với bản trong `openspec/specs/access-codes/spec.md`.

## Ngoài phạm vi

- Đổi mật khẩu khi đang đăng nhập, xoá tài khoản: các change sau (xem proposal).

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-password-reset --yes` trong cùng PR với task cuối. Kiểm `openspec/specs/password-reset/spec.md` có Purpose, và `access-codes` có requirement mới cùng khối danh sách đã sửa.
