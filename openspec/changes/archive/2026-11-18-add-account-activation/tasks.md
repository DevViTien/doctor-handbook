# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi mockup:
  - Trang Mã truy cập: mặc định, đang tạo, lỗi bỏ trống tên, mã vừa tạo, đã sao chép, danh sách đủ bốn trạng thái, danh sách rỗng, hộp thoại huỷ, huỷ bị từ chối.
  - Trang kích hoạt: bước 1 (mặc định, đang kiểm, bỏ trống, mã không dùng được, thử quá nhiều) và bước 2 (mặc định, đang tạo, lỗi từng ô, tên đã có người dùng, chưa tick).
  - Trang đăng nhập có liên kết kích hoạt.
  - Sáng và tối, điện thoại và máy tính.
  - Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px (đã kiểm 18/11/2026).
- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §6 (mục "Trạng thái duyệt").

## 1. Hạ tầng dùng chung

- [x] 1.1 Chuyển phần ghi, đếm và xoá lần thử theo danh sách khoá xuống `src/server/auth/attempts.ts` (`recordAttempts`, `countRecentAttempts`, `forgetAttempts`) theo design §1. `modules/auth/server/rate-limit.ts` gọi lại các hàm này. Kiểm: test đăng nhập hiện có (`rate-limit.test.ts`, `login.test.ts`) xanh mà không sửa kỳ vọng.
- [x] 1.2 Thêm hằng số `CODE_ENTRY_MAX_FAILURES_PER_IP = 10` và `CODE_ENTRY_FAILURE_WINDOW_MS = 15 phút` vào `src/server/auth/constants.ts`. Kiểm: test cửa sổ ≤ `AUTH_ATTEMPT_RETENTION_MS` xanh.
- [x] 1.3 Viết `isUniqueViolation(error, constraint)` trong `src/server/db/errors.ts`: đọc mã `23505` và tên constraint, kể cả khi lỗi bị Drizzle bọc trong `cause`. Kiểm: unit test với lỗi giả có và không có `cause`.
- [x] 1.4 Mở rộng fixture E2E `tests/e2e/fixtures/db.ts` theo design §7:
  - Hằng số pepper E2E dùng chung với `playwright.config.ts`.
  - `insertAccessCode` (trả mã thô; hỗ trợ còn hạn, hết hạn, đã dùng, đã huỷ, loại `password_reset`), `insertCodeFailures`, `countAccessCodes`, `findAccountByUsername`.
  - `resetDatabase` xoá thêm `access_codes`.

  Kiểm: `pnpm typecheck` xanh và `account-session.spec.ts` vẫn xanh.

## 2. Admin cấp, xem và huỷ mã (module `admin`, phía server)

- [x] 2.1 Viết `schemas.ts` (`createAccessCodeSchema`, `revokeAccessCodeSchema`), `constants.ts` (`ADMIN_MESSAGES`) và `access-code-status.ts` (`getAccessCodeStatus`). Kiểm bằng unit test:
  - Schema: tên trống hoặc chỉ khoảng trắng báo "Nhập tên người nhận mã.", tên dài quá 80 ký tự.
  - Trạng thái: đủ bốn trạng thái, đúng thứ tự ưu tiên, biên đúng 72 giờ (scenario "Mã còn hạn", "Mã đã dùng", "Mã hết hạn", "Mã đã huỷ").
- [x] 2.2 Viết `server/queries.ts` (`listAccessCodes`) và `server/mutations.ts` (`insertAccessCode`, `revokeAccessCode`) theo design §5. Cả hai file `import "server-only"`. Truy vấn không chọn `code_hash` và chỉ đụng `access_codes` và `accounts.username`. Lệnh huỷ dùng `UPDATE … RETURNING` có điều kiện. Kiểm: `pnpm typecheck`, và E2E ở nhóm 3.
- [x] 2.3 Viết `server/actions.ts`:
  - `createAccessCodeFormAction` (`access: "admin"`): sinh mã, băm, thử lại tối đa 3 lần khi trùng hash, trả mã đã định dạng, `revalidatePath`.
  - `revokeAccessCodeAction` (`access: "admin"`): `CONFLICT` khi mã không còn hạn.

  Không log mã. Kiểm bằng unit test có mock `guards` và DAL: scenario "Bác sĩ gửi yêu cầu tạo mã" (`FORBIDDEN`, không gọi insert), "Chưa đăng nhập gửi yêu cầu huỷ mã" (`UNAUTHENTICATED`), thử lại khi trùng hash, "Huỷ mã vừa được dùng" (`CONFLICT`).

## 3. Admin cấp, xem và huỷ mã (giao diện)

- [x] 3.1 Viết `components/create-access-code-form.tsx` bám mockup đã duyệt và design §6:
  - `useActionState`.
  - Thẻ mã vừa tạo với "Sao chép tin nhắn": soạn tin bằng `window.location.origin`, có nhánh không sao chép được, "Đã sao chép" và `role="status"`.
  - Dòng cảnh báo "Mã chỉ hiện một lần".

  Kiểm: so với mockup ở 360/390/1280 px, sáng và tối.

- [x] 3.2 Viết `components/access-code-list.tsx` (server component) và `components/revoke-access-code-button.tsx`:
  - Danh sách: nhãn trạng thái có icon và chữ; tên người nhận có `truncate`; `EmptyState` khi chưa có mã.
  - Nút huỷ: `ConfirmDialog` với nút "Không huỷ" và "Huỷ mã"; lỗi hiện trong hộp thoại.

  Viết `src/app/admin/access-codes/page.tsx` (bỏ `FeaturePlaceholder`, hai cột từ `md`) và `loading.tsx`. Kiểm: so với mockup, `pnpm lint` xanh (không vi phạm phân tầng).

- [x] 3.3 Viết `tests/e2e/access-codes.spec.ts` cho mọi scenario của `specs/access-codes/spec.md`:
  - Tạo mã cho bác sĩ mới; bỏ trống tên người nhận.
  - Tải lại trang sau khi tạo mã.
  - Sao chép tin nhắn gửi bác sĩ (chỉ Chromium).
  - Database không chứa mã thô.
  - Mã còn hạn, đã dùng, hết hạn, đã huỷ; chưa có mã nào.
  - Huỷ mã còn hạn; đổi ý trong hộp thoại; huỷ mã vừa được dùng.

  Kiểm: chạy xanh với PostgreSQL local.

- [x] 3.4 Cập nhật `src/modules/admin/README.md`: phần đã có (mã kích hoạt) và phần còn lại (mã đặt lại mật khẩu, danh sách tài khoản, khoá, xoá). Kiểm: `pnpm format:check` xanh.

## 4. Bác sĩ kích hoạt tài khoản (module `auth`, phía server)

- [x] 4.1 Viết `schemas.ts` (`activationCodeSchema`, `activateAccountSchema`) dùng lại `usernameSchema` và `passwordSchema`; thông báo đặt trong `ACTIVATION_MESSAGES` (`constants.ts`), kèm năm ý của lưu ý sử dụng. Kiểm bằng unit test các scenario "Bỏ trống mã", "Tên đăng nhập có dấu", "Tên đăng nhập viết hoa", "Mật khẩu quá ngắn", "Chưa tick đồng ý", và họ tên trống.
- [x] 4.2 Viết `server/rate-limit.ts`: thêm `codeAttemptKey(ip)` (IP `unknown` dùng chung một nhóm) và `isCodeEntryBlocked(count)`. Kiểm bằng unit test biên 10/11 và khoá không chứa IP thô (scenario "Lần nhập mã thứ mười một bị từ chối").
- [x] 4.3 Viết `server/activation.ts` theo design §2–§4:
  - `checkActivationCode` và `activateAccount` (băm mật khẩu trước, rồi một giao dịch: `UPDATE … RETURNING` có điều kiện, `INSERT` tài khoản, gắn `account_id`, tạo phiên).
  - `isUniqueViolation` cho tên đăng nhập trùng; ghi, đếm, xoá lần thử đúng từng nhánh.

  Kiểm bằng unit test có mock DAL, rate-limit và mật khẩu: "Nhập mã đúng", "Mã không tồn tại" (giữ lần thử), "Mã đặt lại mật khẩu dùng ở trang kích hoạt", bị chặn thì không gọi DAL, "Tên đăng nhập đã có người dùng" (`CONFLICT` có `fieldErrors.username`, xoá lần thử), "Kích hoạt thành công".

- [x] 4.4 Thêm vào `server/actions.ts`:
  - `checkActivationCodeFormAction` (`access: "public"`).
  - `activateAccountFormAction` (`access: "public"`): sau khi commit thì `setSessionCookie` rồi `redirect(routes.doctor.patients)`.

  Không log mã, tên đăng nhập hay mật khẩu. Kiểm: `pnpm typecheck` xanh.

## 5. Bác sĩ kích hoạt tài khoản (giao diện)

- [x] 5.1 Viết `components/activation-form.tsx` bám mockup đã duyệt và design §6:
  - Hai bước trong một component; mã đi theo trường ẩn; nút "Đổi mã".
  - Lỗi `NOT_FOUND` ở bước 2 thì quay về bước 1.
  - Ở bước 2, sau lỗi vẫn giữ họ tên và tên đăng nhập; nút hiện/ẩn mật khẩu; focus ô lỗi đầu tiên.
  - Thuộc tính ô nhập theo spec.

  Viết `src/app/(auth)/activate/page.tsx` (bỏ `FeaturePlaceholder`). Kiểm: so với mockup ở 360/390/1280 px, sáng và tối, đủ các trạng thái.

- [x] 5.2 Thêm liên kết "Kích hoạt tài khoản" và dòng "Chưa có mã? Liên hệ quản trị viên." ở `src/app/(auth)/login/page.tsx`, liên kết "Đăng nhập" ở trang kích hoạt; đường dẫn lấy từ `routes`. Kiểm: test `account-session.spec.ts` vẫn xanh.
- [x] 5.3 Viết `tests/e2e/account-activation.spec.ts` cho mọi scenario của `specs/account-activation/spec.md`:
  - Nhập mã: đúng; chữ thường không dấu gạch; bỏ trống.
  - Mã không dùng được: không tồn tại; hết hạn; đã dùng hoặc đã huỷ; mã đặt lại mật khẩu.
  - Kích hoạt: thành công; đăng nhập lại; họ tên điền sẵn.
  - Lỗi từng ô: tên có dấu; tên viết hoa; tên đã có người dùng; mật khẩu quá ngắn; chưa tick; lưu ý hiện trước khi tạo tài khoản.
  - Mã một lần: dùng lại mã; hai lần gửi cùng lúc; Admin huỷ khi đang điền.
  - Giới hạn: lần thứ mười một; hết cửa sổ; lỗi form không tính.
  - Trang kích hoạt: thuộc tính ô nhập; mở từ trang đăng nhập; không lộ lên URL.

  Kiểm: chạy xanh với PostgreSQL local (scenario cần cookie phiên bỏ qua trên WebKit như hiện nay).

- [x] 5.4 Cập nhật `src/modules/auth/README.md` (kích hoạt đã có; còn đặt lại và đổi mật khẩu) và mục biến môi trường của `README.md` (đổi `ACCESS_CODE_PEPPER` làm mọi mã còn hạn mất hiệu lực). Kiểm: `pnpm format:check` xanh.

## 6. Kiểm tra cuối

- [x] 6.1 Kiểm tích hợp:
  - `pnpm check` (đã gồm `pnpm spec:check`), `pnpm build`, `pnpm test:e2e` (project `android` và `iphone`) đều xanh.
  - Xem lại trang Mã truy cập, trang kích hoạt và trang đăng nhập ở 390 px và 1280 px, sáng và tối, so với mockup.
  - Rà các file giao diện đã đổi bằng `web-design-guidelines`.
  - Không còn `FeaturePlaceholder` ở `/activate` và `/admin/access-codes`.
- [x] 6.2 Đối chiếu `specs/access-codes/spec.md` và `specs/account-activation/spec.md` với code hiện tại (thông báo, ngưỡng, thuộc tính ô nhập) và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Mã đặt lại mật khẩu, danh sách và khoá/xoá tài khoản, đổi mật khẩu: các change sau (xem proposal).

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `/opsx:archive` (hoặc `pnpm exec openspec archive add-account-activation --yes`) trong cùng PR với task cuối. Sau đó kiểm `openspec/specs/access-codes/spec.md` và `openspec/specs/account-activation/spec.md` có Purpose và đủ requirement.
