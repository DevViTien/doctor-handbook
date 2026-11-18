# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Cột `patients.deleted_at`** (timestamptz, null = chưa xoá) và index `(account_id, deleted_at)`, có từ migration `0001`. `notes` trỏ tới `patients (id, account_id)` với `ON DELETE CASCADE`.
- **Mọi chỗ đọc bệnh nhân đã lọc `deleted_at IS NULL`**:
  - `listPatients`, `getPatient` (trang chi tiết và trang sửa);
  - `updatePatient`;
  - `saveNote` (bao gồm `UPDATE` khi sửa);
  - `searchPatients`, kể cả phần ghi chú.

  Vì vậy chỉ cần đặt `deleted_at` là bệnh nhân biến khỏi mọi màn hình.

- **Cron hằng ngày** `GET /api/cron/daily-maintenance` (xác thực bằng `CRON_SECRET`, lịch trong `vercel.json`) đang dọn `auth_attempts`.
- **Dùng chung**:
  - `src/components/ui/sonner.tsx` (có sẵn, chưa gắn vào layout nào);
  - `DropdownMenu`, `ConfirmDialog`, `PersonRow`;
  - `formatDate` (giờ Việt Nam).
- **Trang chi tiết** có thanh trên với nút "Sửa". Trang Cài đặt có dòng "đang được xây dựng".

## Goals / Non-Goals

**Goals:**

- Xoá nhầm thì lấy lại được trong một chạm ("Hoàn tác"), và trong 30 ngày (Thùng rác).
- Không có đường nào để bác sĩ này xoá, khôi phục hay thấy thùng rác của bác sĩ khác.
- Thời hạn 30 ngày đúng tuyệt đối, kể cả khi cron chưa chạy.

**Non-Goals:** làm trống cả thùng rác, chọn nhiều, xem chi tiết trong thùng rác (xem proposal, "Ngoài phạm vi").

## Decisions

### 1. Cấu trúc

```
src/modules/patients/
├── constants.ts              + TRASH_RETENTION_DAYS (30), TRASH_MESSAGES
├── types.ts                  + TrashedPatient (PatientListItem + deletedAt ISO)
├── schemas.ts                + patientIdInputSchema { patientId: uuid }
├── trash.ts                  daysLeft(deletedAt, now) (thuần)
├── server/queries.ts         + listTrash(auth), countTrash(auth)
├── server/mutations.ts       + moveToTrash, restoreFromTrash, deletePermanently, purgeExpiredTrash
├── server/actions.ts         + moveToTrashAction, restoreFromTrashAction, deletePermanentlyAction
└── components/
    ├── patient-actions-menu.tsx   "use client": nút ⋮, "Chuyển vào thùng rác", toast "Hoàn tác"
    └── trash-list.tsx             "use client": dòng, "Khôi phục", "Xoá vĩnh viễn" + ConfirmDialog
src/app/(doctor)/layout.tsx          + <Toaster />
src/app/(doctor)/settings/page.tsx   + dòng "Thùng rác · n bệnh nhân"
src/app/(doctor)/settings/trash/page.tsx
src/app/(doctor)/patients/[id]/page.tsx   + PatientActionsMenu trong thanh trên
src/app/api/cron/daily-maintenance/route.ts   + purgeExpiredTrash()
src/config/routes.ts                 + doctor.trash = "/settings/trash"
```

`purgeExpiredTrash` là hàm DAL của `patients`, được cron (tầng `app`) gọi. Nó không lọc theo tài khoản vì là việc bảo trì của hệ thống: chỉ xoá theo hạn, không đọc hay trả về nội dung. Code của Admin không gọi tới (N6).

### 2. Ba lệnh và hạn 30 ngày

Mọi câu đều có `id = $patientId AND account_id = $session`. Không có dòng nào khớp thì báo `NOT_FOUND`, nên không phân biệt được "của người khác", "không có" hay "sai trạng thái".

| Lệnh                | SQL                                                                                                                          | Ghi chú                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `moveToTrash`       | `UPDATE patients SET deleted_at = now() WHERE … AND deleted_at IS NULL RETURNING id`                                         | Không đụng `updated_at`, nên form sửa đang mở ở thiết bị khác không bị báo "vừa được sửa"              |
| `restoreFromTrash`  | `UPDATE patients SET deleted_at = NULL, updated_at = now() WHERE … AND deleted_at > now() - interval '30 days' RETURNING id` | Đặt `updated_at` để bệnh nhân lên đầu danh sách (spec)                                                 |
| `deletePermanently` | `DELETE FROM patients WHERE … AND deleted_at IS NOT NULL RETURNING id`                                                       | Ghi chú đi theo nhờ `ON DELETE CASCADE`. Bệnh nhân **chưa** vào thùng rác thì không xoá vĩnh viễn được |
| `purgeExpiredTrash` | `DELETE FROM patients WHERE deleted_at <= now() - interval '30 days'`                                                        | Trả về số dòng, chỉ log con số đó                                                                      |

**Hạn 30 ngày** chỉ có một định nghĩa SQL, `trashIsLive() = deleted_at > now() - interval '30 days'`. `listTrash`, `countTrash` và `restoreFromTrash` cùng dùng nó. Nhờ vậy, bệnh nhân quá hạn biến khỏi thùng rác ngay lúc quá hạn, không phải đợi tới lần cron chạy.

**`daysLeft(deletedAt, now)`** = `ceil(30 − số ngày đã trôi qua)`, giới hạn trong [1, 30], vì `deleted_at` lấy giờ của database còn `now` lấy giờ của server ứng dụng, hai đồng hồ có thể lệch vài giây. Kết quả:

- vừa xoá: "còn 30 ngày";
- xoá được 29,5 ngày: "còn 1 ngày".

Ngày xoá hiện bằng `formatDate` (giờ Việt Nam).

Các phương án đã cân nhắc:

- **Bảng `trash` riêng**: phải chép dữ liệu qua lại, và phải sửa sao lưu. `deleted_at` có sẵn đã đủ.
- **Chỉ dựa vào cron để hết hạn**: nếu cron trễ hay lỗi, bác sĩ vẫn thấy và khôi phục được bệnh nhân đã quá 30 ngày.

### 3. Chuyển vào thùng rác và hoàn tác (trang chi tiết)

- **Nút ⋮** (`aria-label="Thêm thao tác"`, 44 px) đặt cạnh "Sửa", mở `DropdownMenu`. Mục "Chuyển vào thùng rác" có icon thùng rác và chữ màu `--destructive`.
- **Bấm mục đó**:
  1. Gọi `moveToTrashAction({ patientId })`.
  2. Thành công thì `router.replace(routes.doctor.patients)`, rồi `toast("Đã chuyển bệnh nhân vào thùng rác.", { action: { label: "Hoàn tác" }, duration: 8000 })`.
  3. Bấm "Hoàn tác" thì gọi `restoreFromTrashAction`, rồi `router.refresh()` và `toast.success("Đã khôi phục bệnh nhân.")`.
- **Thông báo không bao giờ có tên bệnh nhân** (S7). Toast nằm ở `Toaster` gắn trong layout bác sĩ, nên vẫn còn sau khi chuyển trang.
- `AppProviders` đã có một `Toaster` chung (trên cùng màn hình). `Toaster` của khu bác sĩ mang `id = DOCTOR_TOASTER_ID` (`src/config/site.ts`), và mọi toast của thùng rác gửi kèm `toasterId`, để mỗi thông báo chỉ hiện một lần.
- Toast nằm **trên nút nổi** "Thêm bệnh nhân" và thanh điều hướng (`bottom: calc(8.75rem + safe-area)`), không che nút đó.
- **Lỗi**:
  - mất mạng (lời gọi ném lỗi): `toast.error("Chưa chuyển được vì mất mạng. Thử lại khi có mạng.")`, và ở lại trang chi tiết;
  - lỗi khác: `toast.error(message)` lấy từ `ActionResult`.
- **Không hỏi xác nhận** (N2): thao tác này hoàn tác được, bằng "Hoàn tác" ngay, hoặc bằng thùng rác trong 30 ngày.

**`revalidatePath`**:

- `restoreFromTrash` và `deletePermanently` gọi cho `/patients`, trang chi tiết, `/settings` và `/settings/trash`.
- `moveToTrash` **không** gọi. Nếu gọi, Next sẽ render lại trang hiện tại (trang chi tiết của chính bệnh nhân đó) vào câu trả lời của action, và "Không tìm thấy bệnh nhân" loé lên trước khi app về danh sách. Mọi trang liên quan đều là trang động, được lấy lại khi điều hướng.
- Lỗi mất mạng có nút "Thử lại" ngay trong toast. `NOT_FOUND` thì `router.refresh()` để hiện đúng trạng thái hiện tại (ví dụ: câu trả lời lần đầu bị mất nhưng bệnh nhân đã vào thùng rác).

### 4. Trang Thùng rác

- **Server Component** `/settings/trash`:
  - thanh trên có lối về "Cài đặt";
  - tiêu đề "Thùng rác", câu phụ "Bệnh nhân ở đây được xoá hẳn sau 30 ngày.";
  - `TrashList` nhận các dòng đã tính sẵn: id, họ tên, dòng phụ, "Xoá ngày … · còn N ngày".
- **Mỗi dòng** là chữ cái đầu, họ tên, dòng phụ, dòng hạn, và hai nút cao 44 px:
  - "Khôi phục" kiểu viền;
  - "Xoá vĩnh viễn" kiểu chữ màu `--destructive`.
- **Không phải liên kết**, vì không xem được chi tiết bệnh nhân trong thùng rác.
- **Danh sách lấy từ dữ liệu server** (`rows`), trừ các dòng trang vừa khôi phục hay xoá. Một lần "Hoàn tác" ở nơi khác, hay `router.refresh()`, luôn cho danh sách đúng. Gặp `NOT_FOUND` (hết hạn, đã khôi phục hay xoá ở thiết bị khác) thì chỉ `router.refresh()`.
- **"Khôi phục"**: gọi action, bỏ dòng khỏi danh sách tại chỗ, hiện toast "Đã khôi phục bệnh nhân."
- **"Xoá vĩnh viễn"**:
  - mở `ConfirmDialog` với tiêu đề "Xoá vĩnh viễn bệnh nhân này?";
  - lời giải thích "Hồ sơ của {họ tên} cùng mọi ghi chú sẽ bị xoá hẳn, không khôi phục được.";
  - hai nút "Xoá vĩnh viễn" / "Không xoá";
  - lỗi hiện ngay trong hộp thoại.

  Thành công thì bỏ dòng, xoá các nháp ghi chú của bệnh nhân đó trên máy (`listNoteDrafts(account, patient)` rồi `removeNoteDraft`), và hiện toast "Đã xoá vĩnh viễn."
  - Họ tên xuất hiện trong hộp thoại (trên màn hình, để bác sĩ chắc là đúng người), nhưng không bao giờ trong toast.

- **Trống**: `EmptyState` với icon thùng rác, "Thùng rác trống", câu phụ "Bệnh nhân bị xoá sẽ nằm ở đây 30 ngày trước khi bị xoá hẳn."

**Cài đặt**: thêm một thẻ "Thùng rác". Đó là liên kết 56 px có icon, chữ "Thùng rác", số "`n` bệnh nhân" (hoặc "Trống"), và mũi tên. Dòng "đang được xây dựng" còn lại "Sao lưu dữ liệu, nhập dữ liệu: đang được xây dựng".

### 5. Lỗi

| Tình huống                                                     | Xử lý                                                                                                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Id không thuộc bác sĩ, không có, sai trạng thái, đã quá hạn    | `NOT_FOUND`, "Không tìm thấy bệnh nhân."                                                                                                                                                     |
| Chưa đăng nhập / Admin                                         | `UNAUTHENTICATED` / `FORBIDDEN` từ `createAction`                                                                                                                                            |
| Mất mạng                                                       | Thông báo riêng. Trang thùng rác giữ nguyên dòng                                                                                                                                             |
| Cron lỗi                                                       | Hai việc (dọn `auth_attempts`, dọn thùng rác) chạy độc lập bằng `Promise.allSettled`: việc này lỗi không chặn việc kia. Mỗi lỗi được log, và route trả 500. Hạn vẫn đúng nhờ `trashIsLive()` |
| Nháp ghi chú của bệnh nhân đã bị xoá hẳn (cron, thiết bị khác) | `sendAllNoteDrafts` bỏ nháp bị từ chối `NOT_FOUND` mà cũ hơn 31 ngày: bệnh nhân đó không thể quay lại nữa. Nhờ vậy không gửi lại mãi                                                         |

### 6. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-patient-trash/mockup/index.html`. Đây là file local, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng, gồm các điểm nêu trong mockup: chuyển vào thùng rác không hỏi xác nhận (menu ⋮, toast "Hoàn tác" 8 giây, không có tên); thùng rác ở Cài đặt; khôi phục lên đầu danh sách; chỉ xoá vĩnh viễn mới hỏi; tự xoá hẳn sau 30 ngày.

**Hướng hình ảnh**: bảng màu A, không thêm token.

- Điểm nhấn là **toast "Hoàn tác"**: nền `--foreground`, chữ `--background` (đảo màu, nổi trên mọi nền), nút "Hoàn tác" chữ đậm. Toast nằm trên thanh điều hướng, trong tầm ngón cái.
- Màu đỏ `--destructive` chỉ dùng cho chữ của "Chuyển vào thùng rác" và "Xoá vĩnh viễn", không bao giờ làm nền to.

**Trạng thái trong mockup:**

| Màn hình       | Trạng thái                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Trang chi tiết | menu ⋮ đang mở                                                                                          |
| Danh sách      | có toast "Hoàn tác"                                                                                     |
| Cài đặt        | có dòng Thùng rác                                                                                       |
| Thùng rác      | có bệnh nhân (gồm một người "còn 1 ngày"); trống; đang khôi phục; hộp thoại xoá vĩnh viễn; lỗi mất mạng |

**Tương phản**:

- `--destructive` trên `--card`: 6.57:1 (sáng) và 7.47:1 (tối).
- Toast đảo màu: chữ `--background` trên nền `--foreground` đạt 16.56:1 (sáng) và 15.97:1 (tối).

**Kiểm tra trước khi coi là xong:**

- xem ở 360/390/1280 px, sáng và tối;
- toast không che nút "Thêm bệnh nhân" quá 8 giây;
- rà bằng `web-design-guidelines`.

## Risks / Trade-offs

- [Bấm nhầm "Chuyển vào thùng rác"] → Không hỏi xác nhận, nhưng có "Hoàn tác" ngay và thùng rác 30 ngày. Mục nằm trong menu ⋮, không bấm nhầm được bằng một chạm.
- [Cron là cron của Vercel gói Hobby, chạy một lần mỗi ngày, có thể lệch giờ] → Hạn tính bằng `trashIsLive()` khi đọc, nên lệch giờ chỉ ảnh hưởng lúc dữ liệu thật sự bị xoá, không ảnh hưởng điều bác sĩ thấy.
- [Toast dùng thư viện `sonner` đã có] → Đã có trong `dependencies` từ đầu, chỉ là chưa gắn vào layout.

## Migration Plan

Không đổi schema, không migration, không thêm thư viện. Rollback bằng cách deploy lại bản trước: bệnh nhân đang ở thùng rác vẫn bị ẩn, vì mọi chỗ đọc của bản trước đã lọc `deleted_at`. Chúng chỉ không được dọn sau 30 ngày cho tới khi bản mới quay lại.
