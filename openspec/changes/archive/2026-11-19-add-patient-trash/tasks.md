# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: mọi trạng thái ở design.md §6, sáng/tối, điện thoại/máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §6 (mục "Trạng thái duyệt").

## 1. Phía server (module `patients`)

- [x] 1.1 Thêm `TRASH_RETENTION_DAYS`, `TRASH_MESSAGES`, `TrashedPatient`, `patientIdInputSchema` và `trash.ts` (`daysLeft`). Kiểm bằng unit test các mốc "còn 30 ngày" (vừa xoá), "còn 1 ngày" (29,5 ngày), và quá hạn.
- [x] 1.2 Viết `listTrash`, `countTrash` (`queries.ts`) và `moveToTrash`, `restoreFromTrash`, `deletePermanently`, `purgeExpiredTrash` (`mutations.ts`) theo design §2, với một định nghĩa `trashIsLive()`. Kiểm: `pnpm typecheck`; E2E nhóm 3 trên PostgreSQL thật.
- [x] 1.3 Viết ba action (`createAction`, `access: "doctor"`, `revalidatePath`). Kiểm bằng unit test "Chưa đăng nhập hoặc Admin gửi lệnh xoá", "Xoá bệnh nhân của bác sĩ khác" (0 dòng thành `NOT_FOUND`), và account id gửi từ client bị bỏ qua.
- [x] 1.4 Gọi `purgeExpiredTrash` trong `src/app/api/cron/daily-maintenance/route.ts`, chỉ log số dòng. Kiểm: E2E "Quá 30 ngày" và "Ngày cuối cùng" gọi route cron với `CRON_SECRET` của môi trường test.

## 2. Giao diện

- [x] 2.1 Gắn `Toaster` vào `src/app/(doctor)/layout.tsx`. Viết `patient-actions-menu.tsx` (menu ⋮, toast "Hoàn tác", lỗi mất mạng) và đặt vào thanh trên của `[id]/page.tsx`. Kiểm: so với mockup ở 360/390/1280 px, sáng và tối.
- [x] 2.2 Viết `trash-list.tsx` và `src/app/(doctor)/settings/trash/page.tsx` (có bệnh nhân, trống, hộp thoại xoá vĩnh viễn, xoá nháp trên máy). Thêm dòng Thùng rác vào Cài đặt và sửa dòng "đang được xây dựng". Kiểm: so với mockup mọi trạng thái.

## 3. E2E và tài liệu

- [x] 3.1 Thêm fixture `trashPatient(id, daysAgo)` và `findPatient(id)` vào `tests/e2e/fixtures/db.ts`. Viết `tests/e2e/patient-trash.spec.ts` cho mọi scenario của `specs/patient-trash/spec.md`:
  - "Chuyển vào thùng rác";
  - "Bệnh nhân trong thùng rác không hiện khi tìm";
  - "Hoàn tác";
  - "Xem thùng rác";
  - "Thùng rác trống";
  - "Khôi phục giữ nguyên ghi chú";
  - "Xoá vĩnh viễn";
  - "Đổi ý khi xoá vĩnh viễn";
  - "Quá 30 ngày";
  - "Ngày cuối cùng";
  - "Thùng rác của bác sĩ khác";
  - "Xoá bệnh nhân của bác sĩ khác" (cả xoá vĩnh viễn lẫn chuyển vào thùng rác và khôi phục, bằng form bị sửa id gửi lên).

  Kiểm: chạy xanh với PostgreSQL local trên `android`. Trên `iphone`, test cần giữ đăng nhập bị bỏ qua như mọi spec khác.

- [x] 3.2 Cập nhật `src/modules/patients/README.md`. Kiểm: `pnpm format:check` xanh.

## 4. Kiểm tra cuối

- [x] 4.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại ở 360/390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 4.2 Đối chiếu `specs/patient-trash/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Làm trống cả thùng rác, chọn nhiều, xem chi tiết trong thùng rác, xoá nháp khi cron xoá hẳn, xoá ảnh trong Storage: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-patient-trash --yes` trong cùng PR với task cuối.
