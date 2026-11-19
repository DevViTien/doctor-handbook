# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi:
  - Trang Tài khoản: danh sách có số bệnh nhân và lần sao lưu, dòng đã khoá có nút "Xoá".
  - Hộp thoại xoá: ô trống, gõ chưa khớp, gõ khớp, đang xoá.
  - Bốn lỗi trong hộp thoại: không khớp, đang hoạt động, không tìm thấy, kho ảnh lỗi.
  - Sau khi xoá (toast), và xoá tài khoản cuối cùng (rỗng).
  - Sáng và tối, điện thoại và máy tính.

  Kiểm: tự xem bằng ảnh Playwright local; không tràn ngang ở 360 px (đã kiểm 19/11/2026).

- [x] 0.2 Người dùng duyệt mockup ngày 19/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §8 (dòng "Ngày duyệt").

## 1. Phía server

- [x] 1.1 Viết `removeAccountObjects(bucket, accountId)` trong `src/server/storage/objects.ts` (design §2, §7). Kiểm bằng unit test với storage giả:
  - liệt kê theo trang và xoá theo lô 1000;
  - tên lạ bị từ chối;
  - account id không phải UUID thì không gọi storage;
  - lỗi storage được ném lên.
- [x] 1.2 Viết `src/modules/admin/account-deletion.ts` (`usernameMatches`), `deleteAccountSchema` trong `schemas.ts`, và các thông báo mới trong `ACCOUNT_MESSAGES`. Kiểm bằng unit test: hoa thường, khoảng trắng đầu cuối, chuỗi rỗng; id không phải UUID bị schema từ chối.
- [x] 1.3 `listDoctorAccounts` thêm `patientCount` (không tính thùng rác) và `lastBackupAt` (design §5). Kiểm: `pnpm typecheck`; E2E "Đếm bệnh nhân không tính thùng rác" và "Chưa có bệnh nhân, chưa sao lưu" ở nhóm 3.
- [x] 1.4 Viết `deleteDoctorAccount(id, username)` trong `server/mutations.ts`: một transaction gồm `FOR UPDATE`, kiểm khoá và tên, xoá ảnh, rồi `DELETE` (design §2). Kiểm bằng unit test có mock transaction và storage:
  - `not-found`, `active`, `mismatch` thì không gọi storage, không `DELETE`;
  - storage lỗi thì không `DELETE` và lỗi đi ra khỏi transaction;
  - `DELETE` chỉ khớp `role = 'doctor'`.
- [x] 1.5 Viết `deleteAccountAction` trong `server/actions.ts` (`createAction`, `access: "admin"`, ánh xạ lỗi theo bảng ở design §2, `revalidatePath` hai trang, log chỉ id và số). Kiểm bằng unit test có mock DAL và session:
  - "Bác sĩ gửi yêu cầu xoá tài khoản khác" (`FORBIDDEN`);
  - "Chưa đăng nhập gửi yêu cầu xoá" (`UNAUTHENTICATED`);
  - "Xoá tài khoản Admin hoặc tài khoản đã xoá" (`NOT_FOUND`);
  - "Server từ chối tên đăng nhập không khớp" (`VALIDATION_FAILED`);
  - "Tài khoản vừa được mở khoá ở nơi khác" (`CONFLICT`);
  - "Kho ảnh lỗi" (`INTERNAL` kèm thông báo riêng).

## 2. Giao diện

- [x] 2.1 `components/account-list.tsx` bám mockup đã duyệt:
  - thêm dòng "N bệnh nhân · Sao lưu …" / "Chưa sao lưu";
  - dòng đã khoá có "Mở khoá" và "Xoá";
  - tiêu đề "Bác sĩ" nhận focus được (`tabIndex={-1}`).

  Kiểm: so với mockup ở 360/390/1280 px, sáng và tối.

- [x] 2.2 Viết `components/delete-account-button.tsx`:
  - `ConfirmDialog` với khối "Sẽ mất vĩnh viễn" và ô gõ tên đăng nhập;
  - nút chỉ bật khi `usernameMatches`; Enter xác nhận khi đã khớp;
  - đang xoá thì khoá ô;
  - lỗi hiện trong hộp thoại;
  - xoá xong: toast "Đã xoá tài khoản <tên đăng nhập>." và focus về tiêu đề danh sách.

  Kiểm: so với mockup, sáng và tối; điều hướng được bằng bàn phím.

- [x] 2.3 `src/app/admin/accounts/loading.tsx` thêm dòng skeleton cho meta mới. Kiểm: `pnpm lint` xanh.

## 3. E2E và tài liệu

- [x] 3.1 `tests/e2e/fake-storage.mjs`: thêm công tắc `POST /__fake/fail` cho route liệt kê, tắt khi `reset` (design §9). Thêm helper cho fixture E2E: tạo bệnh nhân, ghi chú, việc và ảnh cho một tài khoản; đếm dữ liệu theo tài khoản; đặt `last_backup_at`. Kiểm: các test hiện có vẫn xanh.
- [x] 3.2 Viết E2E trong `tests/e2e/account-management.spec.ts`:
  - "Đếm bệnh nhân không tính thùng rác"
  - "Chưa có bệnh nhân, chưa sao lưu"
  - "Xoá tài khoản cùng toàn bộ dữ liệu"
  - "Dữ liệu của bác sĩ khác còn nguyên"
  - "Tài khoản đang hoạt động không có nút xoá"
  - "Đăng nhập bằng tài khoản đã xoá"
  - "Dùng lại tên đăng nhập đã xoá"
  - "Chưa gõ đúng thì chưa xoá được"
  - "Hộp thoại cho biết sẽ mất gì"
  - "Đổi ý trong hộp thoại"
  - "Tài khoản vừa được mở khoá ở nơi khác"
  - "Kho ảnh lỗi"

  Kiểm: `pnpm test:e2e` xanh trên Pixel 7 và iPhone 14.

- [x] 3.3 Cập nhật tài liệu:
  - `src/modules/admin/README.md`: thêm luồng xoá vào bảng Implemented, bỏ D21 khỏi "Still to build", ghi thứ tự xoá và lý do;
  - `docs/architecture.md`: phần Storage ghi việc xoá theo tiền tố tài khoản.

  Kiểm: đọc lại khớp code.

## 4. Kiểm tra và hoàn tất

- [x] 4.1 Xem lại ở 390 px và 1280 px, sáng và tối, so với mockup; rà các file giao diện đã đổi bằng `web-design-guidelines`. Kiểm: không còn lỗi nào cần sửa.
- [x] 4.2 Chạy `pnpm check` (gồm `pnpm spec:check`), `pnpm build` và `pnpm test:e2e`. Trang `/admin/accounts` không còn `FeaturePlaceholder`. Kiểm: cả ba xanh.
- [x] 4.3 Hai lượt review code (đúng đắn, bảo mật), rồi đối chiếu delta spec với code và archive bằng `pnpm exec openspec archive add-account-deletion --yes` trong cùng PR. Kiểm: `openspec/specs/account-management/spec.md` có đủ requirement mới, và khối MODIFIED giữ trọn ba scenario cũ.

## Ngoài phạm vi

Xem proposal.md, mục "Ngoài phạm vi". Không có task nào trong change này bị hoãn.
