# Design

## Context

Lý do làm change: xem proposal.md. Những gì code đã có:

- **Form gửi được cả khi mất mạng**: `patient-form.tsx` bọc form action của `createFormAction` trong
  `useActionState` với `try/catch`: lỗi mạng trả về `NETWORK_FAILURE`, trang cũ hơn bản đang chạy trả
  `STALE_PAGE` (`isStaleActionError`), và giá trị đã gõ đi kèm state nên không mất.
- **Hành động theo dòng của Admin**: `useConfirmedRowAction` (`admin/components/row-action.ts`) giữ lỗi
  trong `ConfirmDialog`, `router.refresh()` khi đóng; `ROW_ACTION_BUTTON_CLASS` cho nút trong dòng.
- **Điều hướng**: `adminNavItems` trong `src/config/navigation.ts` (tĩnh, `AdminShell` là client dùng
  chung); trang con của Cài đặt dùng `PatientPageBar` với `backHref={routes.doctor.settings}`.
- **Mã bản triển khai**: `process.env.VERCEL_DEPLOYMENT_ID` (đã dùng ở `/api/health`).
- **Định dạng giờ**: `formatDateTime` trong `src/lib/date/format.ts` (giờ Việt Nam).
- **Lỗi**: `AppError` có sẵn `RATE_LIMITED`, `NOT_FOUND`; `createAction` giữ `message` của `AppError`.

## Goals / Non-Goals

**Goals:**

- Bác sĩ gửi một góp ý trong dưới 10 giây, từ Cài đặt, không mất chữ khi mạng chập chờn.
- Admin đọc, đánh dấu đã xem, xoá góp ý; không đường nào dẫn tới dữ liệu bệnh nhân (N6).
- Nội dung góp ý không vào log, toast, tiêu đề.

**Non-Goals:** xem proposal, mục Ngoài phạm vi.

## Decisions

### 1. Module riêng `feedback`, không nhét vào `admin`

```
src/server/db/schema/feedback.ts            bảng feedback (+ export trong index.ts)
src/modules/feedback/
├── README.md
├── constants.ts                            FEEDBACK_MAX_LENGTH = 2000, FEEDBACK_DAILY_LIMIT = 20,
│                                           FEEDBACK_LIST_LIMIT = 200, FEEDBACK_MESSAGES
├── schemas.ts                              sendFeedbackSchema { content }, feedbackIdSchema { id }
├── device.ts (+ .test.ts)                  describeDevice(userAgent) → "iPhone · Safari"
├── server/
│   ├── queries.ts                          listFeedback() (admin), countUnseen trong cùng kết quả
│   ├── mutations.ts                        sendFeedback(auth, input), markFeedbackSeen(id), deleteFeedback(id)
│   └── actions.ts                          sendFeedbackFormAction (doctor), markFeedbackSeenAction,
│                                           deleteFeedbackAction (admin)
└── components/
    ├── feedback-form.tsx                   "use client": ô chữ + nút gửi, giữ chữ khi lỗi
    ├── feedback-list.tsx                   danh sách cho Admin (server component)
    ├── mark-seen-button.tsx                "use client": nút "Đã xem"
    └── delete-feedback-button.tsx          "use client": nút "Xoá" + ConfirmDialog
src/app/(doctor)/settings/feedback/page.tsx
src/app/admin/feedback/page.tsx (+ loading.tsx)
```

Phương án khác: đặt phần đọc vào module `admin`. Bỏ vì góp ý là một capability riêng có cả hai phía;
gom một chỗ thì schema, hằng số và DAL không bị chia đôi. Module `feedback` không import `patients`;
`delete-feedback-button.tsx` cần `useConfirmedRowAction` của `admin` (không nằm trong danh sách import
chéo được phép), nên **chuyển `row-action.ts` xuống `src/components/common/row-action.ts`** (chỉ dùng
`ConfirmDialog`, `router`, không phụ thuộc module). Chiều phụ thuộc:
`app → modules/feedback → components/common, server/{db,auth}`.

### 2. Bảng `feedback`

| Cột             | Kiểu                               | Ghi chú                                                              |
| --------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `id`            | uuid PK                            | `primaryId()`                                                        |
| `account_id`    | uuid null → `accounts.id`          | **ON DELETE SET NULL**: góp ý ở lại khi xoá tài khoản                |
| `content`       | text not null                      | đã trim, 1–2000 ký tự (Zod + `CHECK (char_length(content) <= 2000)`) |
| `user_agent`    | text null                          | header `User-Agent` đọc **trên server**, cắt 400 ký tự               |
| `deployment_id` | text null                          | `VERCEL_DEPLOYMENT_ID` lúc gửi (null khi chạy local)                 |
| `seen_at`       | timestamptz null                   | null = "Mới"                                                         |
| `created_at`    | timestamptz not null default now() |                                                                      |

Index `feedback_created_at_idx (created_at desc)` cho trang Admin, `feedback_account_id_created_at_idx`
cho giới hạn 24 giờ. `.enableRLS()`. Không có `updated_at` (góp ý không sửa được).

- **SET NULL thay vì CASCADE**: góp ý là thư gửi Admin, Admin xoá một tài khoản dùng thử xong vẫn cần đọc
  lại góp ý của người đó khi tổng kết đợt. Người gửi hiện "Tài khoản đã xoá". Hộp thoại xoá tài khoản
  không cần đổi (nó liệt kê dữ liệu sổ tay sẽ mất).
- **Không vào sao lưu/nhập**: xem proposal (Bất biến bị chạm). `backup` không đọc bảng này; nhập thay
  thế toàn bộ không xoá nó.
- **Thông tin máy đọc trên server**: client không gửi gì ngoài `content`, nên không thể nhét dữ liệu
  khác vào. Lưu chuỗi User-Agent gốc (để chủ dự án tra khi cần), giao diện chỉ hiện nhãn ngắn của
  `describeDevice`: máy (iPhone, iPad, Android, Windows, Mac, "Máy khác") + trình duyệt (Safari,
  Chrome, Firefox, Edge, Samsung Internet, "Trình duyệt khác"). Tự viết vài regex, không thêm thư viện
  `ua-parser` cho việc chỉ hiện một nhãn.

### 3. Gửi góp ý và giới hạn 24 giờ

`sendFeedback(auth, { content }, meta)` trong `db.transaction`:

1. `SELECT id FROM accounts WHERE id = auth.account.id FOR NO KEY UPDATE` (khoá dòng của chính người gửi để hai
   lần gửi cùng lúc không cùng vượt giới hạn).
2. `count(*) FROM feedback WHERE account_id = $me AND created_at > now() - interval '24 hours'`; ≥ 20 →
   `AppError("RATE_LIMITED", FEEDBACK_MESSAGES.rateLimited)`.
3. `INSERT` với `account_id = auth.account.id`: **luôn lấy từ phiên** (S3). Schema chỉ có `content`, nên
   trường thừa như `accountId` bị Zod bỏ đi.

Action `sendFeedbackFormAction` (`createFormAction`, `access: "doctor"`): đọc `headers()` lấy
`user-agent`, gọi DAL, `logger.info("Feedback sent", { feedbackId })`, chỉ id, không nội dung.

Phương án khác cho giới hạn: dùng bảng `auth_attempts` sẵn có. Bỏ vì bảng đó dành cho đăng nhập theo
khoá IP/tên; đếm thẳng trên `feedback` không cần thêm gì.

### 4. Form của bác sĩ

- Theo mẫu `patient-form.tsx`: `useActionState(async (prev, formData) => { try { … } catch { … } })`.
  State mang `{ result, content }`; lỗi (validation, `RATE_LIMITED`, mạng, `STALE_PAGE`) đặt lại
  `defaultValue` bằng chữ vừa gửi; thành công thì `key` của textarea đổi để trống ô.
- Textarea `name="content"`, `rows={6}`, chữ 16 px, `maxLength` không đặt (để báo lỗi rõ thay vì cắt
  ngầm khi dán). Bộ đếm "123/2.000" dưới ô, đổi sang màu `destructive` và chữ "quá N ký tự" khi vượt.
- Lời nhắc riêng tư là `FieldDescription` gắn `aria-describedby`, icon `ShieldAlert` màu `primary` trên
  nền `secondary`. Không dùng nền `warning-bg` để màu vàng chỉ dành cho lỗi giới hạn 24 giờ (`FormAlert`
  với `RATE_LIMITED` vốn vàng + đồng hồ).
- Thành công: khối `role="status"` "Đã gửi góp ý. Cảm ơn bác sĩ!" có icon check, nền `secondary`;
  không toast (toast không bao giờ chứa nội dung góp ý, ở đây cũng không cần).
- Lỗi chung: `FormAlert` sẵn có. Lỗi trường: `FieldError` + focus về ô.
- Nút "Gửi góp ý" full width `h-12`, đang gửi: spinner + "Đang gửi…".

### 5. Trang Admin

- `listFeedback()`: `select … from feedback left join accounts on accounts.id = feedback.account_id order
by created_at desc limit 200`, cộng `count(*) filter (where seen_at is null)` toàn bảng cho số mới.
  Chỉ đọc `accounts.display_name`, `accounts.username`. Không join `patients`/`notes`/`todos` (N6).
- `markFeedbackSeen(id)`: `UPDATE … SET seen_at = now() WHERE id = $id AND seen_at IS NULL RETURNING id`;
  không có dòng → kiểm tra tồn tại; không tồn tại → `NOT_FOUND` ("Góp ý này không còn."), đã xem rồi
  → coi như xong. Nút gọi action trong `useTransition`, lỗi báo bằng `toast.error` (chỉ chữ cố định),
  rồi `router.refresh()`.
- `deleteFeedback(id)`: `DELETE … RETURNING id`; không có dòng → `NOT_FOUND`. Nút dùng
  `useConfirmedRowAction` + `ConfirmDialog` (title "Xoá góp ý này?", mô tả "Góp ý của {tên}, gửi lúc
  {giờ}. Không hoàn tác được.", trích tối đa 3 dòng đầu nội dung để chắc xoá đúng góp ý, nút "Xoá góp
  ý" / "Không xoá", `destructive`). Xoá xong: `toast.success
("Đã xoá góp ý.")`, focus về tiêu đề danh sách như trang Tài khoản.
- Cả hai action `access: "admin"`, `revalidatePath(routes.admin.feedback)`.
- Tab mới `{ href: routes.admin.feedback, label: "Góp ý", icon: MessageSquareTextIcon }` trong
  `adminNavItems`. Ba tab vừa 360 px (đo trong mockup).

### 6. Lỗi

| Tình huống                 | Mã AppError                     | Lời báo                                                                          |
| -------------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| Ô trống                    | `VALIDATION_FAILED`             | "Nhập nội dung góp ý." (trường)                                                  |
| Quá 2.000 ký tự            | `VALIDATION_FAILED`             | "Góp ý tối đa 2.000 ký tự." (trường)                                             |
| Quá 20 trong 24 giờ        | `RATE_LIMITED`                  | "Đã gửi 20 góp ý trong 24 giờ qua. Thử lại sau."                                 |
| Mất mạng                   | (client)                        | "Chưa gửi được vì mất mạng. Chữ đã nhập vẫn còn, bấm Gửi góp ý lại khi có mạng." |
| Trang cũ hơn bản đang chạy | (client)                        | `APP_UPDATE_MESSAGES` sẵn có                                                     |
| Góp ý không còn            | `NOT_FOUND`                     | "Góp ý này không còn."                                                           |
| Sai vai trò                | `FORBIDDEN` / `UNAUTHENTICATED` | mặc định của `createAction`                                                      |

### 7. Kiểm thử

- Unit: `describeDevice` (iPhone Safari, iPhone Chrome `CriOS`, Android Chrome, Samsung Internet, Windows Edge,
  Mac Safari, chuỗi rỗng → "Máy khác · Trình duyệt khác"); schema (trống, khoảng trắng, 2.000,
  2.001, trường thừa `accountId` bị bỏ); mutations với transaction giả (giới hạn 20, gắn `account_id`
  từ auth); actions (map lỗi, log không chứa nội dung, sai vai trò).
- E2E (`tests/e2e/feedback.spec.ts`): mỗi scenario trong spec. Mất mạng dùng `context.setOffline(true)`.
  "Nội dung không vào log" kiểm ở unit (spy `logger`). Fixture `db.ts` thêm `seedFeedback`,
  `countFeedback`, và `truncate` thêm bảng `feedback`.

## Giao diện

**Mockup**: `openspec/changes/add-feedback/mockup/index.html` (file local, mở trực tiếp bằng trình
duyệt). **Ngày duyệt**: 19/11/2026, nguyên trạng. Người dùng đồng ý ngoại lệ sao lưu (bảng `feedback` không vào file sao lưu/nhập).

- **Hướng hình ảnh**: giữ nguyên hệ thống hiện có (Be Vietnam Pro, token trong `globals.css`), không
  token mới. Trang bác sĩ là một thẻ đơn giản như Đổi mật khẩu; trang Admin là danh sách thẻ như Tài khoản.
- **Bác sĩ, 390 px**: thanh "‹ Cài đặt", tiêu đề "Góp ý", một dòng giới thiệu, thẻ chứa lời nhắc riêng
  tư, ô chữ 6 dòng, bộ đếm, nút "Gửi góp ý". Máy tính: cùng bố cục trong `PageContainer` (max-w).
- **Cài đặt**: dòng "Góp ý" (icon `MessageSquareText`) đặt sau "Thùng rác", mô tả phụ "Báo lỗi, gợi ý
  thêm tính năng".
- **Admin**: tiêu đề "Góp ý", mô tả "Góp ý bác sĩ gửi từ app. Nếu góp ý lỡ chứa thông tin bệnh nhân,
  đọc xong hãy xoá.", tiêu đề danh sách "Hộp thư" + "2 mới · 4 góp ý"; mỗi thẻ: tên + nhãn "Mới" (chữ, không chỉ màu), dòng phụ
  "bs.lan · 19/11/2026 14:32 · iPhone · Safari", nội dung `whitespace-pre-wrap`, hàng nút "Đã xem" /
  "Xoá". Thẻ mới có viền trái `primary` 3 px (phụ, nhãn chữ vẫn là tín hiệu chính).
- **Trạng thái trong mockup**: bác sĩ: rỗng, đang gửi, đã gửi, lỗi trường (trống/quá dài), giới hạn 24
  giờ, mất mạng; Admin: có góp ý (mới và đã xem, tài khoản đã xoá, nội dung nhiều dòng), rỗng, hộp thoại
  xoá, lỗi "Góp ý này không còn.", đang tải (skeleton).
- **Tương phản** (token có sẵn, đo lại): `warning` trên `warning-bg` 6.2:1 sáng, 9.6:1 tối;
  `muted-foreground` trên `card` 6.7:1 / 6.9:1; `primary` trên `card` 8.7:1 / 7.5:1; `destructive` trên
  `card` 6.6:1 / 7.5:1. Tất cả đạt AA.

## Risks / Trade-offs

- **Bác sĩ vẫn có thể gõ thông tin bệnh nhân vào góp ý** → lời nhắc ngay trên ô, Admin xoá được, nội dung
  không vào log hay toast. Không lọc tự động (không đoán được tên người).
- **Góp ý không có trong file sao lưu**: server mất dữ liệu thì mất góp ý. Chấp nhận: góp ý chỉ phục vụ
  đợt dùng thử, Admin đọc ngay.
- **Không có thông báo góp ý mới**: Admin phải mở tab. Chấp nhận cho nhóm 3–5 người; số mới hiện đầu trang.
- **User-Agent của iPad** giả làm Mac: nhãn có thể sai ("Mac · Safari"). Chấp nhận, chỉ để tham khảo.
