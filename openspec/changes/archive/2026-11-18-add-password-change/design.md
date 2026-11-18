# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **`src/server/auth/session.ts`**: `invalidateAccountSessions(accountId, { exceptSessionId })`, viết sẵn cho đúng trường hợp này và chưa ai gọi với `exceptSessionId`.
- **Đăng nhập** (`src/modules/auth/server/login.ts` + `rate-limit.ts`): đếm lần sai theo khoá `login:user:<sha256(username)>`, ngưỡng 5 lần trong 15 phút, kiểu "ghi rồi đếm"; `clearUsernameFailures` khi thành công.
- **`createFormAction` với `access: "doctor"`**: lấy `auth` (phiên hiện tại, có `sessionId` và `account.id`) từ cookie, không nhận gì từ client.
- **`PasswordInput`**, `FormAlert`, `Field`.
- **Màn hình Cài đặt** (`src/app/(doctor)/settings/page.tsx`): thẻ Tài khoản, rồi một dòng "đang được xây dựng".

## Goals / Non-Goals

**Goals:**

- Đổi mật khẩu và kết thúc phiên ở thiết bị khác trong cùng một giao dịch.
- Một phiên bị lộ (máy để quên chưa khoá) không dò được mật khẩu hiện tại, vì lần sai bị đếm chung với đăng nhập.
- Trình quản lý mật khẩu nhận ra form, để lưu mật khẩu mới cho đúng tài khoản.

**Non-Goals:** Admin đổi mật khẩu qua giao diện; danh sách thiết bị (xem proposal).

## Decisions

### 1. Cấu trúc

```
src/modules/auth/
├── schemas.ts                   + changePasswordSchema (currentPassword, newPassword)
├── constants.ts                 + PASSWORD_CHANGE_MESSAGES
├── server/
│   ├── queries.ts               + findPasswordHash(accountId)
│   ├── mutations.ts             + changePasswordHash(accountId, hash, keepSessionId) (giao dịch)
│   ├── password-change.ts       changePassword(): luồng thuần, mock được
│   └── actions.ts               + changePasswordFormAction (createFormAction, access "doctor")
└── components/change-password-form.tsx
src/app/(doctor)/settings/page.tsx   + thẻ "Đổi mật khẩu" giữa Tài khoản và dòng placeholder
```

### 2. Luồng `changePassword({ account, sessionId, currentPassword, newPassword })`

1. **Ghi lần thử rồi mới đếm**, dùng lại các hàm của đăng nhập với **chỉ khoá theo tên đăng nhập** (`login:user:*`), đúng spec. Không dùng khoá theo IP: nhiều bác sĩ ở cùng phòng khám dùng chung một IP. Bị chặn thì xoá lần thử vừa ghi và trả `RATE_LIMITED`.
2. Đọc hash hiện tại, rồi `verifyPassword(hash, currentPassword)`:
   - **Sai**: giữ lần thử, ném `AppError("VALIDATION_FAILED", …, { fieldErrors: { currentPassword: ["Mật khẩu hiện tại không đúng."] } })`.
   - Dùng mã `VALIDATION_FAILED`, không dùng `UNAUTHENTICATED`. Phía client hiểu `UNAUTHENTICATED` là phiên đã hết, và lỗi này thuộc về một ô.
3. **Mật khẩu hiện tại đúng.** Xoá lần thử vừa ghi, vì nhập đúng thì không phải lần đoán sai.
4. So sánh chuỗi `newPassword === currentPassword`. Trùng thì báo lỗi ô `newPassword` "Mật khẩu mới phải khác mật khẩu hiện tại." So sánh chuỗi là đủ chính xác vì `currentPassword` vừa được xác minh; không cần thêm một lần Argon2.
5. `hashPassword(newPassword)`, chạy ngoài giao dịch.
6. `changePasswordHash`, trong một giao dịch:
   1. Khoá dòng tài khoản (`SELECT … FOR UPDATE`), cùng thứ tự khoá với đặt lại mật khẩu và khoá tài khoản.
   2. Chỉ ghi khi đủ ba điều kiện:
      - tài khoản còn `active`. Nếu không: `locked`, ném `FORBIDDEN` với "Tài khoản đã bị khoá…".
      - phiên của thiết bị này còn. Nếu không: `session-ended`, ném `UNAUTHENTICATED`.
      - **hash đang lưu vẫn là hash vừa kiểm** ở bước 2. Nếu không: `stale`, ném `CONFLICT` với "Mật khẩu vừa được đổi ở nơi khác. Vui lòng nhập lại mật khẩu hiện tại."

      Điều kiện thứ ba giữ cho một lần đổi mật khẩu đang chạy không bao giờ ghi đè lên một lần đặt lại bằng mã (hay một lần đổi ở thiết bị khác) vừa xảy ra.

   3. Đổi `password_hash`, rồi `invalidateAccountSessions(id, { exceptSessionId: sessionId })`.
7. Chỉ khi đổi thành công mới xoá các lần sai trước đó của tên đăng nhập, như khi đăng nhập thành công. Lần đổi bị từ chối (trùng mật khẩu, `stale`…) không xoá bộ đếm.
8. Action trả `{ changed: true }`. Không chuyển trang: trang hiện thông báo thành công và xoá các ô (React tự `form.reset()` sau action).

Các phương án đã cân nhắc:

- **Kiểm mật khẩu bên trong giao dịch.** Phải giữ khoá dòng trong lúc chạy Argon2 (khoảng 100 ms). So hash đã kiểm bên trong giao dịch cho cùng bảo đảm mà không giữ khoá lâu.
- **Bộ đếm riêng cho đổi mật khẩu.** Kẻ xấu cầm phiên bị lộ sẽ được thêm 5 lần đoán ngoài 5 lần của trang đăng nhập. Dùng chung bộ đếm theo tên thì tổng chỉ còn 5.
- **Không đếm lần sai, vì đã có phiên.** Phiên bị lộ trên máy để quên sẽ thành công cụ dò mật khẩu vô hạn. Bỏ.
- **Đăng xuất cả thiết bị đang dùng.** Trái §8.3: thiết bị đang dùng phải giữ đăng nhập.

### 3. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-password-change/mockup/index.html`. Đây là file local, không upload lên đâu.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng (không điều chỉnh bố cục hay câu chữ).

**Hướng hình ảnh:** cùng thẻ với mục Tài khoản trong Cài đặt (nền `--card`, viền, bo 16 px), dùng bảng màu A, không thêm token. Không có phần tử nào được nhấn mạnh riêng: đây là việc làm một lần, giữ yên lặng.

**Bố cục** trên điện thoại, cũng là bản máy tính rộng tối đa 672 px:

- Tiêu đề thẻ "Đổi mật khẩu".
- Câu phụ "Các thiết bị khác sẽ bị đăng xuất; thiết bị này vẫn giữ đăng nhập."
- Ô ẩn `autocomplete="username"` chứa tên đăng nhập, để trình quản lý mật khẩu lưu đúng tài khoản.
- "Mật khẩu hiện tại" (`PasswordInput`, `autocomplete="current-password"`).
- "Mật khẩu mới" (`PasswordInput`, `autocomplete="new-password"`, gợi ý "Tối thiểu 8 ký tự.").
- Nút chính "Đổi mật khẩu", rộng hết thẻ, cao 48 px. Lúc gửi đổi thành "Đang đổi mật khẩu…".

**Trạng thái:**

- Thành công: khối `role="status"` có icon `CircleCheck`, nền `--muted`, chữ `--foreground`, nội dung "Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.". Các ô được xoá.
- Mật khẩu hiện tại sai: lỗi dưới ô.
- Mật khẩu mới ngắn hoặc trùng: lỗi dưới ô mật khẩu mới.
- Thử quá nhiều: khối vàng `--warning`, icon đồng hồ.
- Sau mỗi lỗi, focus vào ô lỗi đầu tiên.

**Dòng placeholder** của Cài đặt đổi thành "Sao lưu dữ liệu, nhập dữ liệu, thùng rác: đang được xây dựng".

**Cách kiểm tra:** xem trang thật ở 360/390/1280 px, sáng và tối, so với mockup. Rà bằng `web-design-guidelines`.

**Ghi chú khi apply và sửa sau review code (18/11/2026), không đổi bố cục đã duyệt:**

- Đã kiểm trang thật bằng ảnh Playwright ở 390/1280 px, sáng và tối: khớp mockup.
- **Sửa sau review code:**
  - Giao dịch khoá dòng tài khoản và kiểm hash, kiểm phiên trước khi ghi (§2).
  - Chỉ đếm lần sai theo tên đăng nhập.
  - Tài khoản bị khoá giữa chừng thì báo đúng câu "bị khoá".
  - Bộ đếm lần sai chỉ được xoá khi đổi thành công.
  - Test "Sai quá nhiều lần" chỉ xoá `auth_attempts` thay vì dựng lại cả DB.

### 4. Kiểm thử

**Unit (`password-change.test.ts`, mock DAL, rate-limit và mật khẩu):**

- sai mật khẩu hiện tại thì giữ lần thử và trả lỗi ô;
- bị chặn thì không kiểm mật khẩu;
- trùng mật khẩu thì báo lỗi ô và không đổi;
- thành công thì xoá đếm và giữ phiên hiện tại (`exceptSessionId`);
- tài khoản vừa bị khoá thì `FORBIDDEN`.

**Action:** chưa đăng nhập nhận `UNAUTHENTICATED`, Admin nhận `FORBIDDEN`.

**E2E:** mọi scenario của spec. Dùng hai browser context cho scenario "thiết bị khác bị đăng xuất". Scenario cần cookie phiên bỏ qua trên WebKit như hiện nay.

## Risks / Trade-offs

- **[Lần sai ở trang đổi mật khẩu làm bác sĩ bị chặn đăng nhập trên thiết bị khác trong 15 phút]** Đúng ý muốn: kẻ xấu dùng phiên bị lộ cũng chỉ có 5 lần đoán. Bác sĩ thật hiếm khi gõ sai 5 lần.

## Migration Plan

Không có migration, không đổi schema. Deploy như bình thường. Rollback: deploy bản trước. Mật khẩu đã đổi vẫn là hash Argon2 bình thường.
