# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: mọi trạng thái ở design.md §10, sáng/tối, điện thoại/máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 18/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §10 (mục "Trạng thái duyệt").

## 1. Phía server (module `patients`)

- [x] 1.1 Thêm `NOTE_LIMITS`, `NOTE_AUTOSAVE_DELAY_MS`, `NOTE_MESSAGES` vào `constants.ts`, `PatientNote` vào `types.ts`, và `saveNoteSchema` / `deleteNoteSchema` vào `schemas.ts` (uuid, NFC, cắt khoảng trắng, tối đa 5000, từ chối nội dung trống). Kiểm bằng unit test "Ghi chú quá dài", ghi chú trống bị từ chối, id không phải uuid bị từ chối.
- [x] 1.2 Viết `listNotes` (`queries.ts`), `saveNote` và `deleteNote` (`mutations.ts`) theo design §2 và §7, tính lại `search_text`. Kiểm: `pnpm typecheck`; E2E "Ghi đè ghi chú của bác sĩ khác" và "Ghi vào bệnh nhân của bác sĩ khác" chạy trên PostgreSQL thật.
- [x] 1.3 Viết `saveNoteAction` và `deleteNoteAction` (`createAction`, `access: "doctor"`). Kiểm bằng unit test "Chưa đăng nhập hoặc Admin gửi lệnh lưu ghi chú", ánh xạ 0 dòng thành `NOT_FOUND`, và account id gửi từ client bị bỏ qua.

## 2. Nháp và tự lưu (phía client)

- [x] 2.1 Thêm `idb-keyval@6.3.0` (phiên bản và lý do đã ghi ở design.md §3 và Migration Plan, chọn sẵn trong teckstack.md §4.9). Viết `note-drafts.ts`: khoá `${accountId}/${noteId}`, kiểm bằng Zod khi đọc, liệt kê theo tài khoản và bệnh nhân. Kiểm bằng unit test (mock `idb-keyval`): bản hỏng bị bỏ, tài khoản khác không đọc được ("Đổi tài khoản trên cùng trình duyệt").
- [x] 2.2 Viết `note-sync.ts` (`sendNoteDraft`: Web Locks hoặc hàng đợi trong tab, gửi bản mới nhất, chỉ xoá nháp khi nội dung khớp). Kiểm bằng unit test:
  - gõ thêm trong lúc gửi thì giữ nháp và gửi tiếp;
  - lời gọi ném lỗi thì trả `offline`, giữ nháp;
  - `NOT_FOUND` thì giữ nháp;
  - hai lần gọi cùng lúc cho một ghi chú chạy lần lượt, lần sau gửi nội dung mới nhất;
  - trống và quá dài thì không gọi server.
- [x] 2.3 Viết `hooks/use-note-autosave.ts` (trễ 1000 ms, trạng thái idle/saving/saved/offline/error, thử lại khi `online` và mỗi 15 giây) và `components/note-draft-sync.tsx`, rồi gắn `NoteDraftSync` vào `src/app/(doctor)/layout.tsx`. Kiểm: `pnpm typecheck`, và E2E nhóm 4.

## 3. Giao diện

- [x] 3.1 Viết `note-item.tsx`, `note-composer.tsx`, `patient-notes.tsx` (danh sách, nút "Ghi chú mới", khôi phục nháp, sửa, hộp thoại xoá), đưa vào `[id]/page.tsx`, và cập nhật `[id]/loading.tsx`. Kiểm: so với mockup mọi trạng thái ở 360/390/1280 px, sáng và tối.

## 4. E2E và tài liệu

- [x] 4.1 Thêm fixture `insertNote` / `listNoteRows` vào `tests/e2e/fixtures/db.ts`. Viết `tests/e2e/patient-notes.spec.ts` cho mọi scenario E2E của `specs/patient-notes/spec.md`:
  - "Xem ghi chú mới nhất ở trên";
  - "Chưa có ghi chú";
  - "Ghi chú không hiện ở danh sách bệnh nhân";
  - "Ghi một ý";
  - "Ghi chú trống không được tạo";
  - "Tự lưu khi ngừng gõ";
  - "Gõ tiếp không tạo ghi chú thứ hai";
  - "Mất mạng khi đang ghi";
  - "Đóng ô soạn khi đang chờ mạng";
  - "Rời trang khi chưa gửi được";
  - "Đóng trang khi chưa gửi được";
  - "Đổi tài khoản trên cùng trình duyệt";
  - "Sửa giữ ngày tạo";
  - "Ghi chú mới không hiện Đã sửa";
  - "Xoá ghi chú";
  - "Đổi ý khi xoá";
  - "Ghi chú quá dài";
  - "Đóng ô soạn khi ghi chú bị từ chối";
  - "Ghi vào bệnh nhân của bác sĩ khác";
  - "Ghi đè ghi chú của bác sĩ khác";
  - "Thuộc tính ô soạn";
  - "Ghi chú không lên URL hay tiêu đề".

  Kiểm: chạy xanh với PostgreSQL local trên `android`. Trên `iphone`, test cần giữ đăng nhập bị bỏ qua như mọi spec khác.

- [x] 4.2 Cập nhật `src/modules/patients/README.md` và `src/modules/backup/README.md` (cột `notes` phải có trong sao lưu; nháp trên máy không thuộc sao lưu). Kiểm: `pnpm format:check` xanh.

## 5. Kiểm tra cuối

- [x] 5.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại ở 360/390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 5.2 Đối chiếu `specs/patient-notes/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Tìm trong ghi chú, xem offline hoàn toàn, đính kèm, đọc để ghi: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-patient-notes --yes` trong cùng PR với task cuối.
