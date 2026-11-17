# Tasks

## 0. Thiết kế

- [x] 0.1 Mockup HTML local `mockup/index.html` (skill `doctor-handbook-ui` + `frontend-design`): trang đăng nhập 6 trạng thái, Cài đặt mục Tài khoản, thanh trên quản trị; sáng/tối; điện thoại/máy tính; hai bảng màu để chọn; tự kiểm bằng ảnh Playwright local (không tràn ngang ở 360 px), 18/11/2026
- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng, chọn bảng màu A "Mực bút bi"; đã ghi vào design.md §6
- [x] 0.3 Nếu chọn bảng màu A: cập nhật token trong `src/app/globals.css` theo bảng ở design.md §6 (`:root` và `.dark`, thêm `--warning`, `--warning-bg` và dòng `--color-*` trong `@theme inline`); xem lại các màn hình placeholder hiện có ở sáng/tối. Nếu chọn B: bỏ tick task này và ghi lý do ở "Ngoài phạm vi"

## 1. Hạ tầng dùng chung

- [x] 1.1 `createFormAction` trong `src/server/actions/create-action.ts` (design §2): chữ ký `(prevState, formData)`, `Object.fromEntries`, cùng xác thực/Zod/ánh xạ lỗi với `createAction`, `redirect` đi qua; tách phần chung để hai hàm không lặp code; test trong `create-action.test.ts` (FormData → object, lỗi Zod có `fieldErrors`, `AppError`, `redirect` được ném lại); `pnpm test` xanh
- [x] 1.2 Hằng số giới hạn đăng nhập trong `src/server/auth/constants.ts` (`LOGIN_MAX_FAILURES_PER_USERNAME`, `LOGIN_MAX_FAILURES_PER_IP`, `LOGIN_FAILURE_WINDOW_MS`, kiểm `≤ AUTH_ATTEMPT_RETENTION_MS` bằng test) và hàm đọc IP từ header (`x-real-ip`, `x-forwarded-for`, `"unknown"`) có test
- [x] 1.3 `AdminShell` nhận prop `actions?: ReactNode` hiện ở thanh trên và đổi tiêu đề thành tên app + nhãn "Quản trị" như mockup; kiểm bằng `pnpm typecheck` và so màn hình `/admin` với mockup
- [x] 1.4 Cập nhật `docs/architecture.md` (mục Errors and results: `createFormAction` cho form) và `src/modules/README.md` (quy ước form dùng `createFormAction` + `useActionState`); `pnpm format:check` xanh

## 2. Luồng đăng nhập phía server

- [x] 2.1 `src/modules/auth/schemas.ts` (`loginSchema`: trim + lowercase tên, mật khẩu không rỗng không trim, `next` tuỳ chọn) và `constants.ts` (thông báo sai thông tin, bị khoá); test schema (scenario "Tên đăng nhập viết hoa và có khoảng trắng", "Bỏ trống mật khẩu")
- [x] 2.2 `server/queries.ts` (`findAccountForLogin`) và `server/mutations.ts` (`recordLoginSuccess`: `last_login_at`), cả hai `import "server-only"`, chỉ chọn cột cần dùng; kiểm bằng `pnpm typecheck` và test E2E ở nhóm 4
- [x] 2.3 `server/rate-limit.ts` (design §4): khoá băm `login:user:*`, `login:ip:*`, đếm hai khoá trong một truy vấn, ghi lần sai, xoá lần sai của tên; hàm thuần `isLoginBlocked`; test biên 4/5 và 19/20 (scenario "Lần thử thứ sáu bị từ chối", "Dò nhiều tên từ một IP", "Tên khác không bị ảnh hưởng") và test khoá không chứa tên/IP thô
- [x] 2.4 `server/login.ts` `authenticate()` theo design §3 (hash giả khi không có tài khoản, khoá, giới hạn trước khi kiểm mật khẩu); unit test với mock (scenario "Sai mật khẩu", "Tên đăng nhập không tồn tại" — có gọi `verifyPassword`, "Mật khẩu khác hoa thường", "Đúng mật khẩu nhưng bị khoá", "Sai mật khẩu khi bị khoá", "Lần thử thứ sáu bị từ chối" — không ghi lần sai, "Đăng nhập thành công xoá đếm"); `pnpm test` xanh

## 3. Action và giao diện

- [x] 3.1 `server/actions.ts`: `loginFormAction` (access `"public"`: `authenticate` → `createSession` → `setSessionCookie` → `redirect` theo `next` an toàn hoặc vai trò) và `logoutAction` (access `"public"`, idempotent: `invalidateSession` nếu có phiên, `deleteSessionCookie`, `redirect` `/login`; xem design §5); không log tên đăng nhập hay mật khẩu; `pnpm typecheck` xanh
- [x] 3.2 `components/login-form.tsx` bám mockup đã duyệt và design §6 (`useActionState`, `<form action>` POST, thuộc tính ô nhập, nút hiện/ẩn mật khẩu, lỗi `role="alert"` và lỗi từng ô, giữ tên đăng nhập sau lỗi, nút đang xử lý); `src/app/(auth)/login/page.tsx` (dấu hiệu app, tiêu đề, hai dòng phụ) đọc `searchParams.next` truyền vào form, bỏ `FeaturePlaceholder`; so với mockup ở 360/390/1280 px sáng và tối, đủ 6 trạng thái
- [x] 3.3 `components/logout-button.tsx` (form một nút, không hỏi xác nhận); mục "Tài khoản" trong `src/app/(doctor)/settings/page.tsx` (tên hiển thị, tên đăng nhập, nút đăng xuất; phần còn lại vẫn `FeaturePlaceholder`); nút đăng xuất ở thanh trên qua `AdminShell actions` trong `src/app/admin/layout.tsx`; `pnpm lint` xanh (không vi phạm phân tầng)
- [x] 3.4 Cập nhật `src/modules/auth/README.md`: phần đã có (đăng nhập, đăng xuất, giới hạn) và phần còn lại (kích hoạt, đặt lại, đổi mật khẩu)

## 4. E2E với PostgreSQL

- [x] 4.1 `tests/e2e/fixtures/db.ts` (design §7): kết nối bằng `E2E_DATABASE_URL`, từ chối host `supabase.co`, tạo lại tài khoản mẫu (Admin, `bs.lan`, `bs.minh`, tài khoản bị khoá) bằng `postgres` + `@node-rs/argon2`, xoá `auth_attempts`/`sessions`, chèn lần sai cũ; helper `test.skip` khi thiếu `E2E_DATABASE_URL`; `playwright.config.ts`: `workers: 1` trong CI, truyền biến môi trường cho web server
- [x] 4.2 CI job `e2e`: service `postgres:17`, `pnpm db:migrate` với URL của service, biến môi trường giả cho `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_CODE_PEPPER`; kiểm migration `0000`–`0002` chạy được trên PostgreSQL thường (role `anon` không tồn tại) bằng lệnh chạy thật ở máy hoặc trên CI
- [x] 4.3 `tests/e2e/account-session.spec.ts` cho mọi scenario của `specs/account-session/spec.md`: đăng nhập đúng (bác sĩ, Admin), tên viết hoa, mật khẩu khác hoa thường, quay lại `next`, `next` trỏ ra ngoài, sai mật khẩu, tên không tồn tại, bỏ trống mật khẩu, giữ tên sau lỗi, bị khoá (đúng và sai mật khẩu), mở lại app, cookie được bảo vệ, đăng xuất (bác sĩ, Admin), thiết bị khác vẫn đăng nhập, giới hạn theo tên (lần thứ sáu, hết cửa sổ, thành công xoá đếm, tên khác), giới hạn theo IP, thuộc tính ô nhập, hiện mật khẩu, không lộ lên URL; chạy xanh với PostgreSQL local hoặc CI
- [x] 4.4 Bổ sung vào `tests/e2e/access-gate.spec.ts` các scenario cần đăng nhập: "Admin mở danh sách bệnh nhân", "Bác sĩ mở khu vực quản trị", "Đã đăng nhập mở trang đăng nhập", "Gọi dọn phiên khi phiên còn hiệu lực", "Tài khoản bị khoá khi đang đăng nhập" (khoá bằng fixture rồi mở `/todos`); chạy xanh
- [x] 4.5 README: cách chạy E2E có DB ở máy (`E2E_DATABASE_URL` trỏ tới PostgreSQL riêng cho test, ví dụ Docker `postgres:17`), cảnh báo không dùng DB dev/prod

## 5. Kiểm tra cuối

- [x] 5.1 `pnpm check` (đã gồm `pnpm spec:check`), `pnpm build`, `pnpm test:e2e` (cả project `android` và `iphone` nếu có WebKit) xanh; xem lại trang đăng nhập, Cài đặt, thanh trên Admin ở 390 px và 1280 px, sáng và tối; rà các file giao diện đã đổi bằng `web-design-guidelines`
- [x] 5.2 Đối chiếu `specs/account-session/spec.md` với code hiện tại (thông báo, ngưỡng, nơi đến sau đăng nhập) và sửa delta nếu code đã khác

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `/opsx:archive` (hoặc `pnpm exec openspec archive add-account-login --yes`) trong cùng PR với task cuối, rồi kiểm `openspec/specs/account-session/spec.md` đã có Purpose và đủ requirement.
