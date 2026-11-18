# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi: mọi trạng thái ở design.md §7, sáng/tối, điện thoại/máy tính. Kiểm: tự xem bằng ảnh Playwright local, không tràn ngang ở 360 px.
- [x] 0.2 Người dùng duyệt mockup ngày 19/11/2026, nguyên trạng. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md §7 (mục "Trạng thái duyệt").

## 1. Phía server (module `todos`)

- [x] 1.1 Viết `constants.ts`, `schemas.ts`, `types.ts` và `due.ts`; chuyển giới hạn nội dung việc từ `backup/constants.ts` sang `todos/constants.ts`. Kiểm bằng unit test cho `describeDue` (quá hạn, hôm nay, ngày mai, cùng năm, khác năm, gần nửa đêm giờ Việt Nam) và cho thứ tự ở scenario "Thứ tự việc chưa xong"; unit test sao lưu vẫn xanh.
- [x] 1.2 Viết `listTodos` (`queries.ts`) và `insertTodo`, `updateTodo`, `setTodoDone`, `deleteTodo`, `deleteCompletedTodos` (`mutations.ts`) theo design §2. Kiểm: `pnpm typecheck`; E2E nhóm 3 trên PostgreSQL thật.
- [x] 1.3 Viết sáu action (`createAction`, `access: "doctor"`). Kiểm bằng unit test:
  - "Chưa đăng nhập hoặc Admin gửi lệnh";
  - "Sửa hoặc xoá việc của bác sĩ khác" (0 dòng thành `NOT_FOUND`);
  - account id gửi từ client bị bỏ qua;
  - nội dung trống và quá 1000 ký tự bị từ chối.

## 2. Giao diện

- [x] 2.1 Viết `todo-composer.tsx`, `todo-item.tsx`, `todo-list.tsx` (cập nhật lạc quan, mục "Đã xong", hộp thoại xoá các việc đã xong) và trang `src/app/(doctor)/todos/page.tsx` kèm `loading.tsx`; xoá `FeaturePlaceholder`. Kiểm: so với mockup (danh sách, đang gõ, mất mạng, trống, đã xong, hộp thoại) ở 360/390/1280 px, sáng và tối.
- [x] 2.2 Viết `todo-edit-sheet.tsx` (sửa, bỏ ngày hạn, xoá) và toast "Hoàn tác". Kiểm: so với mockup bảng sửa và toast.

## 3. E2E và tài liệu

- [x] 3.1 Thêm fixture `insertTodo`, `listTodoRows` vào `tests/e2e/fixtures/db.ts`. Viết `tests/e2e/todo-list.spec.ts` cho mọi scenario của `specs/todo-list/spec.md`:
  - "Chưa có việc nào";
  - "Việc đã xong thu gọn ở cuối";
  - "Thêm việc bằng Enter";
  - "Thêm việc có ngày hạn";
  - "Mất mạng khi thêm việc";
  - "Việc quá hạn";
  - "Thứ tự việc chưa xong";
  - "Đánh dấu xong";
  - "Mở lại việc";
  - "Sửa nội dung và ngày hạn";
  - "Xoá rồi hoàn tác";
  - "Xoá các việc đã xong";
  - "Đổi ý khi xoá việc đã xong";
  - "Việc của bác sĩ khác";
  - "Sửa hoặc xoá việc của bác sĩ khác" (lệnh bị sửa id gửi lên);
  - "Chưa đăng nhập hoặc Admin gửi lệnh" (unit test của action).

  Kiểm: xanh với PostgreSQL local trên `android`.

- [x] 3.2 Cập nhật `src/modules/todos/README.md`. Kiểm: `pnpm format:check` xanh.

## 4. Kiểm tra cuối

- [x] 4.1 Kiểm tích hợp:
  - `pnpm check`, `pnpm build`, `pnpm test:e2e` (`android` và `iphone`) xanh;
  - xem lại ở 360/390/1280 px, sáng và tối, so với mockup;
  - rà bằng `web-design-guidelines`.
- [x] 4.2 Đối chiếu `specs/todo-list/spec.md` với code hiện tại và sửa delta nếu code đã đi khác.

## Ngoài phạm vi

- Gắn việc với bệnh nhân, nhắc việc, nháp offline, kéo thả, việc lặp lại, huy hiệu số việc quá hạn: xem proposal.

## Workflow follow-up

- Hai lượt review code (đúng đắn, bảo mật) trước khi archive.
- Archive bằng `pnpm exec openspec archive add-todo-list --yes` trong cùng PR với task cuối.
