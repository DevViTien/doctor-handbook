# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: mọi trạng thái ở design.md §7, sáng/tối, điện thoại/máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 19/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §7 (mục "Trạng thái duyệt").

## 1. Định dạng file (module `backup`, dùng chung trình duyệt và server)

- [x] 1.1 Cài `fflate@0.8.3`. Thêm `NEXT_PUBLIC_APP_VERSION` vào `next.config.ts`. Kiểm: `pnpm install` không cảnh báo chính sách tuổi phiên bản; `pnpm build` xanh.
- [x] 1.2 Viết `constants.ts`, `types.ts`, `schemas.ts` (`backupFileSchema` cùng các kiểm chéo ở design §2) và `format.ts` (`upgradeBackup`, `backupFileName`). Kiểm bằng unit test:
  - file hợp lệ qua được;
  - thiếu họ tên, quá giới hạn, ghi chú mồ côi, id trùng, số đếm lệch đều bị từ chối;
  - `formatVersion` lớn hơn trả lỗi "mới hơn";
  - tên file theo giờ Việt Nam, có đuôi `_truoc-khi-nhap`.
- [x] 1.3 Viết `archive.ts` (`packBackup`, `unpackBackup`, `gzipJson`, `gunzipJson`). Kiểm bằng unit test:
  - đóng gói rồi mở lại ra đúng dữ liệu;
  - `.zip` không có `manifest.json` và dữ liệu không phải zip đều thành lỗi "hỏng";
  - vượt 64 MB khi giải nén bị từ chối.
- [x] 1.4 Viết `reminder.ts` (`shouldRemind`, `describeLastBackup`). Kiểm bằng unit test theo các scenario:
  - "Quá 7 ngày và có thay đổi";
  - "Quá 7 ngày nhưng không có thay đổi";
  - "Mới sao lưu";
  - chưa sao lưu lần nào (tính từ ngày tạo tài khoản);
  - "hôm nay" / "hôm qua" / "N ngày trước" theo ngày lịch Việt Nam, kể cả lúc gần nửa đêm.

## 2. Phía server

- [x] 2.1 Chuyển `trash-sql.ts` từ `patients/server/` xuống `src/server/db/trash-sql.ts` và sửa import. Kiểm: `pnpm typecheck`; unit test và E2E thùng rác vẫn xanh.
- [x] 2.2 Viết `server/queries.ts` (`getBackupStatus`, `getBackupSnapshot`), `server/mutations.ts` (`recordBackup`, `replaceAllData`) và `server/actions.ts` (`recordBackupAction`) theo design §3–§5. Kiểm: `pnpm typecheck`; unit test của action cho "Chưa đăng nhập hoặc Admin" và account id gửi từ client bị bỏ qua.
- [x] 2.3 Viết `src/app/api/backup/route.ts` (`GET`, `PUT`). Kiểm bằng unit test route:
  - "Chưa đăng nhập hoặc Admin tải sao lưu" / "… nhập dữ liệu";
  - PUT khác nguồn gốc, sai `Content-Type`, quá 4 MB, gzip hỏng;
  - "Dữ liệu sai gửi thẳng lên server";
  - câu trả lời có `Cache-Control: no-store`.

## 3. Giao diện

- [x] 3.1 Viết `backup-client.ts` (`downloadBackup`, `sendImport`) và `components/backup-panel.tsx`. Viết trang `src/app/(doctor)/settings/backup/page.tsx` kèm `loading.tsx`, và thêm `doctor.backup` vào `routes.ts`. Trong Cài đặt, thêm dòng "Sao lưu và nhập dữ liệu" và bỏ dòng "đang được xây dựng". Kiểm: so với mockup (bình thường, chưa lần nào, đang tạo file, vừa tải xong, lỗi) ở 360/390/1280 px, sáng và tối.
- [x] 3.2 Viết `components/import-panel.tsx`: chọn file, tóm tắt, cảnh báo tài khoản khác, `ConfirmDialog`, tự sao lưu, đang nhập theo bước, xong, các lỗi và "Thử lại". Kiểm: so với mockup mọi trạng thái nhập.
- [x] 3.3 Viết `components/backup-reminder.tsx` và đặt vào `src/app/(doctor)/patients/page.tsx` (cả lúc danh sách trống nếu có việc). Gồm "Sao lưu ngay", "Để mai" (`localStorage`, kiểm bằng Zod), và thông báo nổi không có dữ liệu bệnh nhân. Kiểm: so với mockup; không nháy khi đã bấm "Để mai".

## 4. E2E và tài liệu

- [x] 4.1 Thêm fixture `setLastBackup(account, daysAgo)`, `touchPatient(id, daysAgo)` và hàm tạo file sao lưu mẫu (bằng `fflate`) vào `tests/e2e/fixtures/`. Viết `tests/e2e/data-backup.spec.ts` cho mọi scenario của `specs/data-backup/spec.md`:
  - "Chưa sao lưu lần nào";
  - "Đã sao lưu 3 ngày trước";
  - "Tải file sao lưu";
  - "File có cả thùng rác" (đọc file tải về);
  - "Ghi lại ngày sao lưu";
  - "File không có dữ liệu của bác sĩ khác";
  - "Mất mạng khi tải file sao lưu";
  - "Nhắc sau khi tải";
  - "Quá 7 ngày và có thay đổi";
  - "Quá 7 ngày nhưng không có thay đổi";
  - "Mới sao lưu";
  - "Sao lưu ngay từ thanh nhắc";
  - "Để mai";
  - "Chưa đăng nhập hoặc Admin tải sao lưu".

  Kiểm: xanh trên `android`.

- [x] 4.2 Viết `tests/e2e/data-import.spec.ts` cho mọi scenario của `specs/data-import/spec.md`:
  - "Xem tóm tắt file";
  - "File của tài khoản khác";
  - "File hỏng";
  - "File của phiên bản mới hơn";
  - "File quá lớn";
  - "Dữ liệu sai gửi thẳng lên server" (sửa body gửi lên);
  - "Nhập vào tài khoản trống";
  - "Tìm được dữ liệu vừa nhập";
  - "Thay thế dữ liệu đang có" (đọc file `_truoc-khi-nhap` tải về);
  - "Trang cũ không được thay dữ liệu mới mà không hỏi";
  - "Đổi ý khi thay thế";
  - "Giữ ngày tháng và thùng rác";
  - "Ngày sao lưu sau khi nhập";
  - "Mất mạng khi nhập" (chặn request PUT);
  - "Chưa đăng nhập hoặc Admin nhập dữ liệu";
  - "Nhập không đụng dữ liệu bác sĩ khác".

  Thêm một vòng xuất rồi nhập lại, so từng trường. Kiểm: xanh trên `android`.

- [x] 4.3 Cập nhật `src/modules/backup/README.md` (định dạng v1, quy tắc nâng cấp khi siết luật, id đổi khi nhập) và `teckstack.md` §4.10 (gzip qua route thay cho Server Action và bảng tạm). Kiểm: `pnpm format:check` xanh.

## 5. Kiểm tra cuối

- [x] 5.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại ở 360/390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 5.2 Đối chiếu `specs/data-backup/spec.md` và `specs/data-import/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Nhập kiểu gộp, ảnh trong file, nháp ghi chú, nhận biết thay đổi chỉ gồm xoá hẳn, Web Share API: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-data-backup --yes` trong cùng PR với task cuối.
