# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: mọi màn hình và trạng thái liệt kê ở design.md §10, sáng/tối, điện thoại/máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng, và xác nhận cách hiểu N2 (form hồ sơ có một nút "Lưu", ghi chú mới tự lưu). Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §10 (mục "Trạng thái duyệt").

## 1. Phần thuần (module `patients`, `src/lib`)

- [x] 1.1 Viết `src/lib/text/linkify.ts` (`splitLinks`). Kiểm bằng unit test các scenario:
  - "Link trong tóm tắt" (bỏ dấu câu cuối, chữ HTML giữ nguyên);
  - "Không biến địa chỉ lạ thành liên kết" (`javascript:`, `ftp:`, `www.` không có scheme).
- [x] 1.2 Viết `birth.ts` (`parseBirthInput`, `formatBirthInput`, `describeAge`, lấy ngày hôm nay theo giờ Việt Nam). Kiểm bằng unit test với ngày cố định các scenario:
  - "Nhập tuổi nhanh";
  - "Nhập ngày sinh đầy đủ";
  - "Chưa tới sinh nhật trong năm";
  - "Chưa đầy một tuổi";
  - "Năm sinh ở tương lai";
  - "Ngày không có thật";
  - "Nhập không hiểu được";
  - cùng các biên `0t`, `120`, `121`, `1900`, `29/02/2024` và `29/02/2023`.
- [x] 1.3 Viết `duplicates.ts`, `constants.ts`, `types.ts`. Kiểm bằng unit test "Trùng tên và năm sinh", "Khác năm sinh thì không gợi ý", trường hợp một bên chưa có năm sinh, và giới hạn 3 người.
- [x] 1.4 Viết `schemas.ts` (`patientFormSchema`, `updatePatientSchema` có `id` uuid và `version`). Kiểm bằng unit test:
  - "Bỏ chọn giới tính";
  - "Thiếu họ tên";
  - "Họ tên quá dài";
  - "Số điện thoại sai";
  - cắt khoảng trắng, ô trống thành `null`, giới tính lạ bị từ chối.

## 2. Phía server (module `patients`)

- [x] 2.1 Viết `server/queries.ts` (`listPatients`, `getPatient`) và `server/mutations.ts` (`insertPatient`, `updatePatient` có kiểm `version` và tính lại `search_text`). Mọi hàm lọc theo `auth.account.id` và `deleted_at IS NULL`. Kiểm: `pnpm typecheck`; unit test action ánh xạ `not-found` / `stale` thành `NOT_FOUND` / `CONFLICT`; E2E "Sửa cùng lúc ở hai thiết bị" và "Mở bệnh nhân của bác sĩ khác" kiểm `updatePatient` / `getPatient` trên PostgreSQL thật (không mock db).
- [x] 2.2 Viết `server/actions.ts`:
  - `createPatientFormAction` và `updatePatientFormAction`, dựng bằng `createFormAction` với `access: "doctor"`;
  - trả `{ id }`, gọi `revalidatePath`.

  Kiểm bằng unit test các scenario:
  - "Chưa đăng nhập gửi lệnh thêm bệnh nhân" (`UNAUTHENTICATED`);
  - "Admin gửi lệnh thêm bệnh nhân" (`FORBIDDEN`);
  - "Sửa bệnh nhân của bác sĩ khác" (`NOT_FOUND`);
  - `CONFLICT` ra đúng thông báo.

## 3. Giao diện

- [x] 3.1 Thêm đường dẫn vào `src/config/routes.ts`. Viết `patient-list.tsx`, `add-patient-button.tsx` và `src/app/(doctor)/patients/page.tsx` + `error.tsx`; gỡ `FeaturePlaceholder`. Kiểm: so với mockup (có dữ liệu, sổ trống, lỗi) ở 360/390/1280 px, sáng và tối.
- [x] 3.2 Viết `patient-form.tsx` (hàm bọc giữ `values`, bắt lỗi mạng, focus ô lỗi, dòng nhắc mất mạng), `birth-field.tsx`, `gender-field.tsx`, `duplicate-hint.tsx` và `new/page.tsx`. Kiểm:
  - unit test render HTML (`renderToStaticMarkup`) có `action` bắt đầu bằng `javascript:`;
  - so với mockup mọi trạng thái của form thêm.
- [x] 3.3 Viết `patient-header.tsx`, `patient-summary.tsx`, `[id]/page.tsx`, `[id]/loading.tsx`, `[id]/not-found.tsx` và `[id]/edit/page.tsx`. Kiểm: so với mockup (đủ thông tin, chỉ họ tên, không tìm thấy, form sửa, `CONFLICT`).

## 4. E2E và tài liệu

- [x] 4.1 Thêm fixture `insertPatient` / `listPatientRows` vào `tests/e2e/fixtures/db.ts`. Viết `tests/e2e/patient-records.spec.ts` cho mọi scenario E2E của `specs/patient-records/spec.md`:
  - "Xem danh sách";
  - "Sửa thì lên đầu danh sách";
  - "Danh sách không lộ tóm tắt";
  - "Họ tên rất dài";
  - "Sổ chưa có bệnh nhân";
  - "Thêm chỉ với họ tên";
  - "Thêm với đủ thông tin";
  - "Thiếu họ tên";
  - "Số điện thoại sai";
  - "Nhập tuổi nhanh";
  - "Trùng tên và năm sinh";
  - "Khác năm sinh thì không gợi ý";
  - "Gợi ý không chặn việc thêm";
  - "Gọi điện từ trang chi tiết";
  - "Link trong tóm tắt";
  - "Chưa có tóm tắt";
  - "Sửa và xoá một ô";
  - "Sửa cùng lúc ở hai thiết bị";
  - "Mất mạng khi lưu" (`context.setOffline`);
  - "Mạng hỏng dù máy báo vẫn có mạng" (`page.route` huỷ yêu cầu lưu);
  - "Lỗi ở một ô không xoá các ô khác";
  - "Tiêu đề tab của trang chi tiết";
  - "URL không chứa dữ liệu đã nhập";
  - "Mở bệnh nhân của bác sĩ khác";
  - "Sửa bệnh nhân của bác sĩ khác" (form bị sửa id gửi lên);
  - "Danh sách chỉ có bệnh nhân của mình";
  - "Id sai định dạng";
  - "Thuộc tính ô của form";
  - "Enter để lưu nhanh".

  Kiểm: chạy xanh với PostgreSQL local trên `android`. Trên `iphone` các test này bị bỏ qua như mọi test cần giữ đăng nhập (WebKit của Playwright bỏ cookie `Secure` trên http://localhost).

- [x] 4.2 Cập nhật `src/modules/patients/README.md` (phần đã làm, các change còn lại) và `src/modules/backup/README.md` (các cột `patients` phải có trong sao lưu). Kiểm: `pnpm format:check` xanh.

## 5. Kiểm tra cuối

- [x] 5.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại mọi màn hình ở 360/390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 5.2 Đối chiếu `specs/patient-records/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Ghi chú, tìm kiếm, ảnh đại diện, thùng rác: các change 2–5 trong proposal.
- Nháp form lưu qua lần đóng tab: change ghi chú dựng kho nháp trước.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-patient-records --yes` trong cùng PR với task cuối.
