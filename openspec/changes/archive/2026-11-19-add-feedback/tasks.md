# Tasks

## 0. Thiết kế

- [x] 0.1 Làm mockup HTML local `mockup/index.html` theo skill `doctor-handbook-ui` + `frontend-design`. Phạm vi:
  - Cài đặt có dòng "Góp ý".
  - Trang Góp ý của bác sĩ: rỗng, đang gõ (bộ đếm), đang gửi, đã gửi, lỗi trống, quá dài, giới hạn 24 giờ, mất mạng.
  - Trang Góp ý của Admin: có góp ý (mới, đã xem, tài khoản đã xoá, nhiều dòng), rỗng, đang tải, hộp thoại xoá, lỗi "Góp ý này không còn.".
  - Sáng và tối, điện thoại và máy tính.

  Kiểm: tự xem bằng ảnh Playwright local; không tràn ngang ở 360 px, ba tab Admin vừa 360 px (đã kiểm 19/11/2026).

- [x] 0.2 Người dùng duyệt mockup ngày 19/11/2026, nguyên trạng, đồng ý ngoại lệ sao lưu. Kiểm: ngày duyệt và các điều chỉnh đã chốt được ghi vào design.md (mục Giao diện, dòng "Ngày duyệt").

## 1. Database

- [x] 1.1 Thêm `src/server/db/schema/feedback.ts` (design §2: `account_id` SET NULL, `CHECK` độ dài, hai index, `.enableRLS()`), export trong `index.ts`, quan hệ trong `relations.ts` nếu cần. Chạy `pnpm db:generate`, xem lại SQL: chỉ `CREATE TABLE` + index + FK, không đụng bảng cũ. Kiểm: `pnpm typecheck`, migration chạy được trên database `_e2e`.
- [x] 1.2 Xác nhận sao lưu/nhập không đổi: `backup` không đọc bảng `feedback`, nhập thay thế không xoá góp ý. Kiểm: unit test hiện có của backup vẫn xanh; thêm một assertion E2E nhập file rồi góp ý vẫn còn (`seedFeedback` trước khi nhập).

## 2. Phía server

- [x] 2.1 `src/modules/feedback/constants.ts`, `schemas.ts` (`sendFeedbackSchema`, `feedbackIdSchema`). Kiểm bằng unit test: trống, chỉ khoảng trắng, đúng 2.000, 2.001 ký tự (đếm sau trim), trường thừa `accountId` bị bỏ, id không phải UUID bị từ chối.
- [x] 2.2 `src/modules/feedback/device.ts` (`describeDevice`). Kiểm bằng unit test: iPhone Safari, iPhone Chrome (`CriOS`), Android Chrome, Samsung Internet, Windows Edge, Mac Safari, chuỗi rỗng hoặc null → "Máy khác · Trình duyệt khác". Scenario "Gửi từ iPhone" (phần nhãn).
- [x] 2.3 `server/mutations.ts`: `sendFeedback` (transaction, `FOR UPDATE` dòng tài khoản, đếm 24 giờ, insert với `account_id` từ auth), `markFeedbackSeen`, `deleteFeedback` (design §3, §5). Kiểm bằng unit test có transaction giả:
  - "Vượt 20 góp ý trong 24 giờ" (ném `RATE_LIMITED`, không insert);
  - `account_id` luôn là `auth.account.id`;
  - đánh dấu/xoá id không tồn tại → `NOT_FOUND`; đánh dấu góp ý đã xem → không lỗi.
- [x] 2.4 `server/queries.ts`: `listFeedback()` (left join `accounts`, 200 mới nhất, số chưa xem). Kiểm: `pnpm typecheck`; E2E "Xem danh sách góp ý" ở nhóm 4.
- [x] 2.5 `server/actions.ts`: `sendFeedbackFormAction` (`createFormAction`, `access: "doctor"`, User-Agent từ `headers()`, `VERCEL_DEPLOYMENT_ID`, log chỉ id), `markFeedbackSeenAction`, `deleteFeedbackAction` (`createAction`, `access: "admin"`, `revalidatePath`). Kiểm bằng unit test có mock DAL và session:
  - "Nội dung không vào log" (spy `logger`, không đối số nào chứa nội dung);
  - "Admin hoặc người chưa đăng nhập gửi góp ý";
  - "Bác sĩ gửi lệnh đánh dấu hoặc xoá góp ý";
  - "Gửi góp ý mạo danh bác sĩ khác" (DAL nhận auth của người gửi, input không có `accountId`).

## 3. Giao diện bác sĩ

- [x] 3.1 Chuyển `src/modules/admin/components/row-action.ts` xuống `src/components/common/row-action.ts`, sửa import ở module `admin`. Kiểm: `pnpm lint`, `pnpm typecheck`, E2E account-management vẫn xanh.
- [x] 3.2 `routes.doctor.feedback`, dòng "Góp ý" trong `settings/page.tsx`, trang `src/app/(doctor)/settings/feedback/page.tsx` với `PatientPageBar` về Cài đặt.
- [x] 3.3 `components/feedback-form.tsx` theo design §4 và mockup đã duyệt (giữ chữ khi lỗi, bộ đếm, lời nhắc riêng tư, khối "Đã gửi").
- [x] 3.4 E2E `tests/e2e/feedback.spec.ts` cho: "Gửi góp ý", "Chưa gõ gì", "Quá dài", "Mất mạng khi gửi", "Vượt 20 góp ý trong 24 giờ", "Bác sĩ khác không bị chặn", "Gửi từ iPhone" (chạy trên project iphone hoặc đặt User-Agent), "Chưa đăng nhập mở trang góp ý". Fixture `db.ts`: `seedFeedback`, `countFeedback`.

## 4. Giao diện Admin

- [x] 4.1 `routes.admin.feedback`, tab "Góp ý" trong `adminNavItems`, trang `src/app/admin/feedback/page.tsx` + `loading.tsx`.
- [x] 4.2 `components/feedback-list.tsx`, `mark-seen-button.tsx`, `delete-feedback-button.tsx` theo design §5 và mockup đã duyệt.
- [x] 4.3 E2E cho: "Xem danh sách góp ý", "Nội dung nhiều dòng", "Chưa có góp ý", "Đánh dấu đã xem", "Xoá góp ý", "Đổi ý khi xoá góp ý", "Góp ý đã bị xoá ở nơi khác", "Xoá tài khoản đã gửi góp ý", "Bác sĩ mở trang góp ý của Admin".

## 5. Tài liệu và kiểm tra cuối

- [x] 5.1 `src/modules/feedback/README.md`, dòng mới trong `src/modules/README.md`, bảng dữ liệu trong `docs/architecture.md`, sửa câu bất biến sao lưu trong `openspec/config.yaml` và tóm tắt bất biến trong `CLAUDE.md` (proposal, Bất biến bị chạm), thêm tab "Góp ý" của Admin vào sơ đồ điều hướng idea.md §12.6.
- [x] 5.2 Xem lại ở 390 px và 1280 px, sáng và tối, so với mockup; rà `web-design-guidelines` trên các file giao diện đã đổi.
- [x] 5.3 `pnpm check`, `pnpm build`, `pnpm test:e2e` xanh. Không có `FeaturePlaceholder` nào cho route này.
- [x] 5.4 Archive change (`pnpm exec openspec archive add-feedback --yes`) sau khi đối chiếu delta với code.

## Ngoài phạm vi

Xem proposal.md, mục "Ngoài phạm vi".
