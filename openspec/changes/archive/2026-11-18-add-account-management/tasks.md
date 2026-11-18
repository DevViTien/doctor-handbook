# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi:
  - Trang Tài khoản: danh sách (đang hoạt động, đã khoá, chưa đăng nhập, tên dài), hộp thoại khoá, đang khoá, khoá bị lỗi, đang mở khoá, mở khoá bị lỗi, rỗng.
  - Sáng và tối, điện thoại và máy tính.

  Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px (đã kiểm 18/11/2026).

- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §3 (mục "Trạng thái duyệt").

## 1. Phía server (module `admin`)

- [x] 1.1 Thêm `accountIdSchema` vào `schemas.ts` và `ACCOUNT_MESSAGES` vào `constants.ts`. Kiểm bằng unit test: id không phải UUID thì bị từ chối.
- [x] 1.2 Viết DAL theo design §2 và §4:
  - `server/queries.ts`: `listDoctorAccounts`, chỉ các cột của design §4, `role = 'doctor'`, mới nhất trước.
  - `server/mutations.ts`: `setDoctorAccountStatus`, trong một giao dịch, chỉ tài khoản bác sĩ, luôn gọi `invalidateAccountSessions`.

  Kiểm: `pnpm typecheck`, và E2E ở nhóm 3.

- [x] 1.3 Viết `lockAccountAction` và `unlockAccountAction` trong `server/actions.ts` (`createAction`, `access: "admin"`, `NOT_FOUND` khi không có dòng, `revalidatePath`). Kiểm bằng unit test có mock DAL và session: "Bác sĩ gửi yêu cầu khoá tài khoản khác" (`FORBIDDEN`), "Chưa đăng nhập gửi yêu cầu mở khoá" (`UNAUTHENTICATED`), "Khoá tài khoản Admin" (`NOT_FOUND`), và khoá/mở khoá truyền đúng `status`.

## 2. Giao diện

- [x] 2.1 Viết `components/account-list.tsx` (danh sách, trạng thái có icon và chữ, `EmptyState` có liên kết sang Mã truy cập) và `components/account-status-button.tsx` (khoá qua `ConfirmDialog`, mở khoá chạy ngay, lỗi hiện tại chỗ), bám mockup đã duyệt. Kiểm: so với mockup ở 360/390/1280 px, sáng và tối.
- [x] 2.2 Viết `src/app/admin/accounts/page.tsx` (`requirePageAccess("admin")`, bỏ `FeaturePlaceholder`) và `loading.tsx`. Kiểm: `pnpm lint` xanh (không vi phạm phân tầng).

## 3. E2E và tài liệu

- [x] 3.1 Thêm `insertDoctor` vào fixture E2E (`lastLoginAt` tuỳ chọn, mặc định có) và `countSessions(accountKey)`. Kiểm: `pnpm typecheck`.
- [x] 3.2 Viết `tests/e2e/account-management.spec.ts` cho mọi scenario E2E của `specs/account-management/spec.md`:
  - Danh sách: xem danh sách; tài khoản Admin không có trong danh sách; bác sĩ chưa đăng nhập lần nào; chưa có tài khoản bác sĩ nào.
  - Khoá: khoá tài khoản đang dùng; đổi ý trong hộp thoại; bị khoá thì không đăng nhập được.
  - Mở khoá: mở khoá rồi đăng nhập lại; phiên cũ không sống lại.

  Kiểm: chạy xanh với PostgreSQL local (scenario cần cookie bỏ qua trên WebKit như hiện nay).

- [x] 3.3 Cập nhật `src/modules/admin/README.md` (danh sách tài khoản, khoá/mở khoá đã có; còn xoá tài khoản và mã đặt lại mật khẩu). Kiểm: `pnpm format:check` xanh.

## 4. Kiểm tra cuối

- [x] 4.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) đều xanh.
  - Xem lại trang Tài khoản ở 390 px và 1280 px, sáng và tối, so với mockup.
  - Rà các file giao diện đã đổi bằng `web-design-guidelines`.
  - Không còn `FeaturePlaceholder` ở `/admin/accounts`.
- [x] 4.2 Đối chiếu `specs/account-management/spec.md` với code hiện tại (thông báo, nhãn, hành vi phiên) và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Xoá tài khoản (D21) và mã đặt lại mật khẩu: các change sau (xem proposal).

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-account-management --yes` trong cùng PR với task cuối. Sau đó kiểm `openspec/specs/account-management/spec.md` có Purpose và đủ requirement.
