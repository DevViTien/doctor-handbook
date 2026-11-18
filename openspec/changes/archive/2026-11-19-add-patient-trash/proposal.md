# Proposal

## Why

Bác sĩ đã thêm, sửa, ghi chú và tìm được bệnh nhân, nhưng chưa **bỏ** được ai: một hồ sơ thêm nhầm hay trùng sẽ nằm mãi trong danh sách và kết quả tìm. idea.md BR3 chốt cách xoá: **xoá thì chuyển vào Thùng rác, khôi phục được trong 30 ngày, sau đó xoá vĩnh viễn**. Đây là mục Must cuối cùng của phần bệnh nhân trước ảnh đại diện (§11).

Change thứ 4/5 của module **`patients`** (`src/modules/patients`). Ảnh đại diện để change sau. Đáp ứng idea.md:

- BR3: xoá vào thùng rác, khôi phục trong 30 ngày, rồi xoá vĩnh viễn.
- §11: xoá vào thùng rác và khôi phục (Must).
- §12.6: Cài đặt có mục Thùng rác.
- N2: chỉ xác nhận thao tác không hoàn tác được. Chuyển vào thùng rác hoàn tác được, nên không hỏi xác nhận; xoá vĩnh viễn thì hỏi.
- S3, S7: chỉ bác sĩ sở hữu thấy và thao tác; thông báo không chứa dữ liệu bệnh nhân.
- §10.5, P3-1: sao lưu sẽ gồm cả bệnh nhân trong thùng rác (cột `deleted_at` đã nằm trong danh sách cột của README `backup`).

## What Changes

- **Chuyển vào thùng rác** từ trang chi tiết bệnh nhân:
  - Nút "Thêm thao tác" (⋮) cạnh nút "Sửa" mở menu, trong đó có "Chuyển vào thùng rác".
  - Không hỏi xác nhận, vì hoàn tác được.
  - Bệnh nhân rời khỏi danh sách, kết quả tìm và gợi ý trùng tên; URL của bệnh nhân đó ra "Không tìm thấy bệnh nhân".
  - App quay về danh sách và hiện thông báo nổi "Đã chuyển bệnh nhân vào thùng rác." kèm nút **"Hoàn tác"**, trong khoảng 8 giây. Thông báo không có tên bệnh nhân.
- **Trang Thùng rác** ở `/settings/trash`, mở từ một dòng "Thùng rác" trong Cài đặt (kèm số bệnh nhân đang trong thùng rác):
  - xoá gần nhất ở trên;
  - mỗi dòng có chữ cái đầu, họ tên, dòng phụ (giới, tuổi, quê), và "Xoá ngày 18/11/2026 · còn 30 ngày";
  - mỗi dòng có nút "Khôi phục" và "Xoá vĩnh viễn";
  - trống thì hiện "Thùng rác trống".
- **Khôi phục**: bệnh nhân trở lại danh sách ở trên cùng, đủ ghi chú như cũ. App hiện "Đã khôi phục bệnh nhân."
- **Xoá vĩnh viễn**: hỏi xác nhận bằng `ConfirmDialog` ("Xoá vĩnh viễn bệnh nhân này?"), nói rõ hồ sơ và mọi ghi chú bị xoá hẳn, không khôi phục được. Nháp ghi chú của bệnh nhân đó trên máy cũng bị xoá.
- **Tự xoá hẳn sau 30 ngày**: cron hằng ngày có sẵn (`/api/cron/daily-maintenance`) xoá các bệnh nhân đã ở thùng rác quá 30 ngày. Trước lúc cron chạy, những bệnh nhân này cũng không còn hiện trong thùng rác và không khôi phục được nữa.
- **Tách theo bác sĩ**: mọi lệnh xoá, khôi phục, xoá vĩnh viễn chỉ áp dụng cho bệnh nhân của bác sĩ đang đăng nhập; id của người khác bị từ chối và không đổi gì.
- Dòng "đang được xây dựng" trong Cài đặt bỏ chữ "thùng rác".

## Capabilities

### New Capabilities

- `patient-trash`: thùng rác của bệnh nhân. Gồm chuyển vào thùng rác kèm hoàn tác, trang thùng rác, khôi phục, xoá vĩnh viễn, tự xoá hẳn sau 30 ngày, và tách dữ liệu theo bác sĩ.

### Modified Capabilities

(Không có.) `patient-records`, `patient-notes` và `patient-search` đã quy định "chưa xoá" ở mọi chỗ đọc. Bệnh nhân trong thùng rác vì vậy đã tự biến khỏi danh sách, chi tiết, ghi chú và tìm kiếm, không cần sửa requirement nào.

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, gồm:
  - menu ⋮ trên trang chi tiết;
  - danh sách có thông báo "Hoàn tác";
  - Cài đặt có dòng Thùng rác;
  - trang Thùng rác có bệnh nhân, và khi trống;
  - hộp thoại xoá vĩnh viễn.

  Có sáng/tối, điện thoại/máy tính. Người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.

- **Module `patients`**:
  - `server/mutations.ts`: `moveToTrash`, `restoreFromTrash`, `deletePermanently`, `purgeExpiredTrash`;
  - `server/queries.ts`: `listTrash`, `countTrash`;
  - `server/actions.ts`: ba action (`createAction`, `access: "doctor"`);
  - `components/`: `patient-actions-menu.tsx`, `trash-list.tsx`.
- **Route**:
  - `src/app/(doctor)/settings/trash/page.tsx` (mới);
  - `src/app/(doctor)/settings/page.tsx`: dòng Thùng rác;
  - `src/app/(doctor)/patients/[id]/page.tsx`: menu ⋮;
  - `src/app/api/cron/daily-maintenance/route.ts`: thêm bước dọn thùng rác;
  - `src/config/routes.ts`: thêm `doctor.trash`.
- **Tầng dùng chung**:
  - gắn `Toaster` (`src/components/ui/sonner.tsx`, đã có) vào layout bác sĩ;
  - dùng lại `ConfirmDialog`, `PersonRow`, `DropdownMenu`.
- **Database**: dùng cột `patients.deleted_at` và index `(account_id, deleted_at)` có sẵn. Xoá vĩnh viễn kéo theo ghi chú nhờ `ON DELETE CASCADE` có sẵn. **Không đổi schema, không migration.**
- **Sao lưu**: không đổi. README `backup` đã ghi `deleted_at` là cột phải có (P3-1: sao lưu gồm cả thùng rác).
- **Thư viện và dịch vụ**: không thêm. `sonner` đã có trong `dependencies`.
- **Bất biến**:
  - DAL lọc theo `auth.account.id`. Action dựng bằng `createAction`.
  - Thông báo nổi không chứa dữ liệu bệnh nhân. Không log dữ liệu bệnh nhân.
  - Chỉ xoá vĩnh viễn mới hỏi xác nhận (N2).
  - Cron dọn thùng rác chạy cho mọi tài khoản. Đó là việc bảo trì của hệ thống, không phải code của Admin, và không đọc nội dung nào (N6).

## Ngoài phạm vi

- **Làm trống cả thùng rác bằng một nút**: chưa làm. Xoá vĩnh viễn từng người là đủ cho vài người mỗi tháng.
- **Xem chi tiết bệnh nhân đang ở thùng rác**: chưa làm. Muốn xem thì khôi phục trước.
- **Chọn nhiều để xoá hay khôi phục cùng lúc**: chưa làm.
- **Xoá nháp ghi chú trên máy khi cron xoá hẳn sau 30 ngày**: trình duyệt không biết lúc đó. Nháp như vậy bị server từ chối (`NOT_FOUND`), và được bỏ khi đã cũ hơn 31 ngày.
- **Ảnh đại diện**: change 5 (`add-patient-avatars`). Khi có ảnh, xoá vĩnh viễn phải xoá cả ảnh trong Storage; change đó sẽ thêm bước này.
