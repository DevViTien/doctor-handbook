# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: mọi trạng thái ở design.md §7, sáng/tối, điện thoại/máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §7 (mục "Trạng thái duyệt").

## 1. Phần thuần (module `search`)

- [x] 1.1 Viết `constants.ts`, `types.ts`, `schemas.ts`, `match.ts` (`searchTokens`, `matchesLocally`, `rankLocal`). Kiểm bằng unit test:
  - "Gõ không dấu";
  - "Từ theo thứ tự bất kỳ, gồm cả quê";
  - khớp tên đứng trước khớp quê;
  - giữ thứ tự gốc trong mỗi nhóm;
  - từ khoá rỗng trả mọi người.
- [x] 1.2 Viết `deep-match.ts` (`matchPatientFields`: số điện thoại theo chữ số, mã bệnh nhân, tóm tắt không dấu). Kiểm bằng unit test "Tìm theo số điện thoại", "Tìm theo mã bệnh nhân", "Tìm trong tóm tắt", và các trường hợp không khớp (từ khoá ít hơn 3 chữ số không khớp số điện thoại).

## 2. Phía server (module `search`)

- [x] 2.1 Viết `server/queries.ts` (`searchPatients`) theo design §3: lọc theo tài khoản và `deleted_at IS NULL`; tìm ghi chú bằng `LIKE … ESCAPE` đã thoát ký tự; tìm gần đúng bằng `word_similarity` (ngưỡng 0.35, tối đa 5); chỉ trả id và loại khớp. Kiểm: `pnpm typecheck`; E2E nhóm 4 trên PostgreSQL thật ("Tìm trong ghi chú", "Gõ sai một chữ", "Không tìm thấy ghi chú của bác sĩ khác").
- [x] 2.2 Viết `server/actions.ts` (`searchPatientsAction`, `createAction`, `access: "doctor"`). Kiểm bằng unit test "Chưa đăng nhập hoặc Admin gửi lệnh tìm" và từ khoá quá dài bị từ chối.

## 3. Giao diện

- [x] 3.1 Viết `src/components/common/person-row.tsx`, rồi chuyển `PatientList` sang dùng nó. Kiểm: E2E `patient-records` vẫn xanh.
- [x] 3.2 Viết `hooks/use-speech-search.ts`, `components/search-box.tsx`, `components/patient-search.tsx`; đưa vào `src/app/(doctor)/patients/page.tsx`. Cho form thêm đọc `NEW_PATIENT_NAME_KEY`. Sửa `teckstack.md` §4.7 cho khớp design §3. Kiểm: so với mockup mọi trạng thái ở 360/390/1280 px, sáng và tối.

## 4. E2E và tài liệu

- [x] 4.1 Viết `tests/e2e/patient-search.spec.ts` cho mọi scenario của `specs/patient-search/spec.md`; giọng nói dùng một `SpeechRecognition` giả nạp bằng `addInitScript`:
  - "Xoá từ khoá";
  - "Thuộc tính ô tìm";
  - "Gõ không dấu";
  - "Từ theo thứ tự bất kỳ, gồm cả quê";
  - "Lọc khi mất mạng";
  - "Tìm trong ghi chú";
  - "Tìm trong tóm tắt";
  - "Tìm theo số điện thoại";
  - "Tìm theo mã bệnh nhân";
  - "Gõ sai một chữ";
  - "Gõ sai số điện thoại không gợi ý ai";
  - "Thêm từ kết quả trống";
  - "Đọc tên để tìm";
  - "Trình duyệt không hỗ trợ giọng nói";
  - "Bị từ chối quyền micro";
  - "Lỗi micro không che dòng mất mạng";
  - "Tìm ghi chú khi mất mạng";
  - "Từ khoá không lên URL hay tiêu đề";
  - "Không tìm thấy ghi chú của bác sĩ khác".

  Kiểm: chạy xanh với PostgreSQL local trên `android`. Trên `iphone`, test cần giữ đăng nhập bị bỏ qua như mọi spec khác.

- [x] 4.2 Cập nhật `src/modules/search/README.md` và `src/modules/patients/README.md`. Kiểm: `pnpm format:check` xanh.

## 5. Kiểm tra cuối

- [x] 5.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại ở 360/390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 5.2 Đối chiếu `specs/patient-search/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Giữ từ khoá khi quay lại, tô đậm phần khớp, phân trang, tìm việc cần làm: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-patient-search --yes` trong cùng PR với task cuối.
