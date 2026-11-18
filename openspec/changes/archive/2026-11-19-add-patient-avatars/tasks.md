# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: mọi trạng thái ở design.md §9, sáng/tối, điện thoại/máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 19/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §9 (mục "Trạng thái duyệt").

## 1. Hạ tầng Storage và kiểm thử

- [x] 1.1 Viết `tests/e2e/fake-storage.mjs` theo design §7 và thêm vào `webServer` của `playwright.config.ts`; thêm fixture `listStoredObjects`, `resetStorage`. Kiểm: E2E `patient-avatars.spec.ts` chạy trọn đường app → `src/server/storage` → server giả lập (ký URL tải lên, PUT, ký URL đọc, GET, xoá) và đọc lại object bằng `/__fake/*`.
- [x] 1.2 Thêm `newAvatarObjectName`, `isAvatarPathOf`, `createSignedReadUrls` vào `src/server/storage/objects.ts`; CSP trong `next.config.ts` lấy origin từ `SUPABASE_URL`. Kiểm bằng unit test: `isAvatarPathOf` từ chối tài khoản khác, `..`, thư mục con, đuôi lạ.

## 2. Ảnh đại diện (module `patients`)

- [x] 2.1 Viết `avatar-image.ts` (kiểm file, `createImageBitmap`, cắt vuông 384, WebP rồi JPEG). Kiểm: E2E "Chọn ảnh có sẵn" đọc lại ảnh trong kho giả lập và kiểm 384 × 384; "File không phải ảnh".
- [x] 2.2 Thêm `getAvatarPath`, `avatarUrl` vào DTO danh sách, chi tiết và thùng rác. Viết `setAvatar`, `clearAvatar` và ba action theo design §3; viết route `GET /api/patients/[id]/avatar` theo §4. Kiểm bằng unit test route và action:
  - "Ảnh của bác sĩ khác";
  - "Gắn ảnh của tài khoản khác";
  - "Chưa đăng nhập hoặc Admin xem ảnh";
  - 404 khi chưa có ảnh;
  - 307 kèm `Cache-Control: private`.
- [x] 2.3 `deletePermanently`, `purgeExpiredTrash` và cron xoá ảnh (design §6). Kiểm: E2E "Xoá vĩnh viễn xoá ảnh", "Khôi phục còn ảnh", và một lần chạy cron xoá ảnh của bệnh nhân quá 30 ngày.
- [x] 2.4 Viết `patient-avatar.tsx` (bảng chọn, đang lưu, lỗi + "Thử lại", xem, xoá có xác nhận) và đặt vào trang chi tiết; `InitialsAvatar` (lazy, quay về chữ cái đầu) và `PersonRow` hiện ảnh trong danh sách, kết quả tìm, gợi ý trùng tên, thùng rác. Kiểm: so với mockup ở 360/390/1280 px, sáng và tối; E2E "Danh sách có ảnh", "Xoá ảnh", "Đổi ý khi xoá ảnh", "Mất mạng khi lưu ảnh".

## 3. Sao lưu và nhập (module `backup`)

- [x] 3.1 Định dạng bản 2: schema ảnh, `counts.images`, hàm nâng cấp v1 → v2, đóng và mở `images/` trong `archive.ts`, giới hạn 50 MB và 512 KB mỗi ảnh. Kiểm bằng unit test: file v1 nâng lên v2; ảnh không khớp bệnh nhân bị bỏ; ảnh không đúng chữ ký đầu file bị coi là hỏng.
- [x] 3.2 Xuất có ảnh (URL ký trong `GET /api/backup`, tải 4 ảnh cùng lúc, tiến độ). Nhập có ảnh (`prepareImportUploadsAction`, tải lên, `images` trong PUT, gắn ảnh trong transaction, xoá ảnh cũ sau commit, `discardImportUploadsAction`). Kiểm: E2E "File có ảnh", "Nhập file có ảnh", "Nhập file định dạng cũ không có ảnh", "Mất mạng khi tải ảnh lên", "File quá lớn" (50 MB); vòng xuất rồi nhập lại giữ ảnh. Unit test route PUT từ chối path ngoài thư mục tài khoản.

## 4. Tài liệu

- [x] 4.1 Cập nhật README của `patients`, `backup`, `docs/architecture.md` (Storage, server giả lập) và teckstack §4.6, §4.10, §4.11 (URL ký 24 giờ, không bucket `imports`, không `browser-image-compression`); ghi bước tạo bucket vào hướng dẫn triển khai. Kiểm: `pnpm format:check` xanh.

## 5. Kiểm tra cuối

- [x] 5.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại ở 360/390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 5.2 Đối chiếu các delta spec (`patient-avatars`, `data-backup`, `data-import`) với code hiện tại; diff thân requirement MODIFIED với `openspec/specs/data-import/spec.md` trước khi archive.

## Ngoài phạm vi

- Ảnh ở form thêm, cắt/xoay bằng tay, đính kèm ảnh vào ghi chú, ảnh khi Admin xoá tài khoản: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-patient-avatars --yes` trong cùng PR với task cuối.
- Sau khi deploy: tạo bucket `avatars` private và thử một lần trên Preview (design, Migration Plan).
