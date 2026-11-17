# Design

## Context

Xem proposal.md (Why). Hiện trạng liên quan trong code:

- `src/server/auth` đã có: băm/kiểm mật khẩu Argon2id (`password.ts`), tạo/kiểm/thu hồi phiên lưu DB (`session.ts`), đọc/ghi cookie (`cookies.ts`, chỉ gọi được trong Server Action và Route Handler), `getCurrentAuth`/`requireAccess` (`guards.ts`), `pruneAuthAttempts` (`attempts.ts`, cron dọn hằng ngày, giữ 24 giờ).
- Bảng `accounts` (`username` luôn viết thường, có CHECK; `status` `active | locked`; `last_login_at`), `sessions`, `auth_attempts` (`key`, `created_at`, index `(key, created_at)`) đã có trong migration `0001`. Change này **không đổi schema**.
- `createAction` (`src/server/actions/create-action.ts`) nhận một object đầu vào; chưa có cách dùng trực tiếp làm `action` của `<form>`.
- `(auth)/layout.tsx` đã chuyển người đã đăng nhập về trang chính (`redirectIfAuthenticated`). `proxy.ts` đặt `?next=` khi chuyển về `/login`; `getSafeRedirectPath` (`src/lib/url.ts`) lọc đích chuyển hướng.
- `AdminShell` nằm ở `src/components/layout` (tầng dùng chung), nên **không được import** `src/modules/auth` (ESLint chặn).
- CI chưa có database; E2E hiện chỉ chạy các scenario không cần DB.

## Goals / Non-Goals

**Goals:**

- Đăng nhập nhanh trên điện thoại, chạy được cả khi JavaScript chưa tải xong (form gửi bằng POST, không bao giờ lộ mật khẩu lên URL).
- Không dò được tên đăng nhập qua nội dung thông báo hay thời gian phản hồi.
- Giới hạn đăng nhập sai không cần thêm dịch vụ nào ngoài PostgreSQL.
- Mọi scenario trong `specs/account-session/spec.md` có test, kể cả scenario cần DB.

**Non-Goals:**

- Tạo tài khoản bác sĩ thật (kích hoạt bằng mã là change khác). Tài khoản bác sĩ trong change này chỉ có trong fixture E2E.
- Chống tấn công phân tán từ nhiều IP (ngoài phạm vi một nhóm nhỏ, xem Risks).

## Decisions

### 1. Cấu trúc trong module `auth`

```
src/modules/auth/
├── schemas.ts               loginSchema (Zod), dùng chung form và action
├── constants.ts             thông báo lỗi riêng của đăng nhập
├── server/
│   ├── queries.ts           findAccountForLogin(username)
│   ├── mutations.ts         recordLoginSuccess(accountId) (last_login_at)
│   ├── rate-limit.ts        đếm/ghi/xoá lần sai, khoá theo tên và IP
│   ├── login.ts             authenticate(): luồng kiểm tra, không biết gì về cookie
│   └── actions.ts           "use server": loginFormAction, logoutAction
└── components/
    ├── login-form.tsx       "use client"
    └── logout-button.tsx    form POST một nút
```

`login.ts` tách khỏi `actions.ts` để unit test được luồng (giới hạn, khoá, sai mật khẩu) bằng cách mock `queries`/`rate-limit`, không cần cookie hay request.

### 2. Form gửi thẳng tới Server Action (`createFormAction`)

Thêm `createFormAction` vào `src/server/actions/create-action.ts`: cùng xác thực, Zod và ánh xạ lỗi như `createAction`, nhưng chữ ký `(prevState, formData) => Promise<ActionResult>` để dùng với `useActionState` và `<form action={…}>`. FormData được chuyển thành object (`Object.fromEntries`) rồi parse bằng schema.

- **Đã cân nhắc:** (a) gọi `createAction` từ `onSubmit` + `useTransition`: form không chạy khi JS chưa tải, và nếu JS lỗi thì trình duyệt gửi GET, **đưa mật khẩu lên URL**. (b) `react-hook-form`: thừa cho hai ô, thêm thư viện. (c) Viết adapter riêng trong module auth: lặp lại ở mọi form sau này.
- **Chọn** `createFormAction`: form là `<form action>` của React 19, gửi POST kể cả khi chưa hydrate, có `isPending` sẵn; các module sau (kích hoạt, đặt lại mật khẩu, thêm bệnh nhân) dùng lại.

### 3. Luồng `authenticate` và chống dò tài khoản

1. Parse: `username` = trim + lowercase (không áp regex của `usernameSchema`: tên sai định dạng chỉ là "sai thông tin", không báo định dạng); `password` không rỗng (không trim), tối đa 64/128 ký tự với thông báo tiếng Việt; `next` tuỳ chọn và không bao giờ làm form bị từ chối (`.catch(undefined)`; `getSafeRedirectPath` đã lọc độ dài).
2. **Ghi lần thử rồi mới đếm** (mục 4), trước khi kiểm mật khẩu. Bị chặn → xoá lần thử vừa ghi (không tính là lần sai), `AppError("RATE_LIMITED")`.
3. Tìm tài khoản theo `username`. Không có → vẫn chạy `verifyPassword` với một **hash giả** (tạo một lần, nhớ trong module) để thời gian phản hồi giống khi sai mật khẩu.
4. Sai mật khẩu hoặc không có tài khoản → lần thử đã ghi được giữ lại làm lần sai, `AppError("UNAUTHENTICATED", "Tên đăng nhập hoặc mật khẩu không đúng.")`.
5. Mật khẩu đúng nhưng `status = locked` → `AppError("FORBIDDEN", "Tài khoản đã bị khoá. …")`. Xoá lần thử vừa ghi (mật khẩu đúng nên không phải lần sai), không tạo phiên.
6. Thành công → song song: xoá lần thử vừa ghi, xoá các lần sai của tên đó, cập nhật `last_login_at`; trả về tài khoản. Hash giả được tính ngay khi nạp module (không làm chậm request đầu sau cold start), lỗi thì tính lại chứ không cache lỗi.

`loginFormAction` (access `"public"`) gọi `authenticate`, thu hồi phiên đang có của trình duyệt (nếu có, ví dụ form mở ở tab cũ) để không để lại phiên mồ côi, rồi `createSession(accountId, { userAgent })`, `setSessionCookie(token)`, cuối cùng `redirect(getSafeRedirectPath(next) ?? getHomeRouteForRole(role))`. `redirect` đi qua `createAction` nhờ `unstable_rethrow`.

- **Đã cân nhắc:** báo "tài khoản không tồn tại" riêng cho dễ hiểu → lộ danh sách tên đăng nhập (S6). Báo "bị khoá" cả khi sai mật khẩu → lộ trạng thái tài khoản cho người không có mật khẩu.

### 4. Giới hạn đăng nhập sai trong PostgreSQL

- Khoá: `login:user:<sha256(username)>` và `login:ip:<sha256(ip)>` trong bảng `auth_attempts` có sẵn. Băm để không lưu IP và tên đăng nhập thô (dữ liệu cá nhân) trong bảng dọn rác.
- Ngưỡng (hằng số trong `src/server/auth/constants.ts`): `LOGIN_MAX_FAILURES_PER_USERNAME = 5`, `LOGIN_MAX_FAILURES_PER_IP = 20`, `LOGIN_FAILURE_WINDOW_MS = 15 phút` (≤ `AUTH_ATTEMPT_RETENTION_MS` 24 giờ).
- **Ghi rồi đếm** (sửa sau review code, 18/11/2026): mỗi lần thử được ghi (`recordLoginAttempt`, trả id) TRƯỚC khi đếm, rồi một truy vấn đếm theo hai khoá với `created_at > now - window` (số đếm gồm cả lần thử hiện tại). Cách "đếm rồi mới ghi" ban đầu để các request song song cùng thấy số cũ và lọt qua giới hạn; ghi trước thì yêu cầu thứ 6 trở đi luôn thấy ≥ 6. Lần thử bị chặn, bị khoá hay thành công được xoá theo id (`forgetLoginAttempt`); chỉ lần sai ở lại. Quyết định "bị chặn" là hàm thuần `isLoginBlocked(counts)`: chặn khi số lần thử (gồm lần này) vượt ngưỡng.
- Cửa sổ trượt: không có trạng thái "đang khoá"; hết chặn khi lần sai cũ nhất trượt ra khỏi 15 phút.
- IP: `x-real-ip`, rồi phần tử đầu của `x-forwarded-for` (Vercel ghi đè các header này, nên chỉ tin được khi chạy trên Vercel — đích triển khai duy nhất), rồi `"unknown"`. IP `"unknown"` thì **không** áp giới hạn theo IP (chỉ còn theo tên): một nhóm "unknown" chung sẽ để 20 lần sai của bất kỳ ai khoá tất cả mọi người.
- **Đã cân nhắc:** Upstash Redis (thêm dịch vụ ngoài, trái bất biến), bộ nhớ trong function (mỗi instance Vercel đếm riêng, mất khi cold start), khoá cứng tài khoản sau N lần sai (kẻ xấu khoá được tài khoản của bác sĩ khác).

### 5. Đăng xuất

`logoutAction` (access `"public"`, idempotent): có phiên thì `invalidateSession(auth.sessionId)`; luôn `deleteSessionCookie()` rồi `redirect("/login")`. Chọn `"public"` thay vì `"authenticated"` (đổi khi apply, 18/11/2026): nếu phiên đã mất trước đó (đăng xuất ở tab khác, bị thu hồi), `"authenticated"` trả lỗi và người dùng không thoát được; Server Action đã được Next.js kiểm Origin nên không mở thêm CSRF. `LogoutButton` (client, `useActionState`) là form một nút, chạy được không cần JS, không hỏi xác nhận (N2).

- Bác sĩ: mục "Tài khoản" ở `src/app/(doctor)/settings/page.tsx` (tên hiển thị, tên đăng nhập, nút đăng xuất); phần còn lại của Cài đặt vẫn là `FeaturePlaceholder`.
- Admin: `AdminShell` nhận prop `actions?: ReactNode` hiện ở thanh trên; `src/app/admin/layout.tsx` truyền `<LogoutButton />`. Giữ tầng dùng chung không biết gì về module.

### 6. Giao diện (theo mockup)

**Mockup:** `openspec/changes/add-account-login/mockup/index.html` (file local, mở bằng trình duyệt). Gồm ba màn hình: trang đăng nhập (6 trạng thái: mặc định, đang gửi, sai thông tin, bỏ trống mật khẩu, bị khoá, thử quá nhiều), mục Tài khoản trong Cài đặt của bác sĩ, thanh trên khu vực quản trị; sáng/tối; điện thoại 390 px/máy tính. Đã tự kiểm bằng ảnh Playwright local: không tràn ngang ở 360 px.

**Trạng thái duyệt:** người dùng DUYỆT ngày 18/11/2026, nguyên trạng (không điều chỉnh bố cục hay câu chữ), chọn bảng màu **A "Mực bút bi"**.

**Hướng hình ảnh (đã chốt A):** đây là change giao diện đầu tiên nên nó chốt luôn bảng màu của app.

- **Phương án A, "Mực bút bi" (ĐÃ CHỌN):** màu nhấn xanh mực trên nền trung tính hơi ngả xanh, gợi cây bút và cuốn sổ app thay thế; nút chính nổi rõ dưới nắng. Thay token `--primary`, `--ring`, nền và viền trong `src/app/globals.css` (bảng dưới).
- **Phương án B, "Trung tính" (không chọn):** giữ token mặc định của shadcn đang có (đen/trắng/xám). Không đổi `globals.css`.

| Token (shadcn)         | Sáng      | Tối       | Tương phản đã tính                       |
| ---------------------- | --------- | --------- | ---------------------------------------- |
| `--background`         | `#F6F7FA` | `#0D121C` | chữ trên nền: 16,6 / 16,0                |
| `--card`, `--popover`  | `#FFFFFF` | `#151C2A` | chữ trên thẻ: 17,7 / 14,5                |
| `--foreground`         | `#111827` | `#E9EDF5` |                                          |
| `--muted-foreground`   | `#525C70` | `#9BA5B8` | trên thẻ: 6,7 / 6,9                      |
| `--border`             | `#DCE1EA` | `#283244` | (đường chia, không phải viền điều khiển) |
| `--input`              | `#7D879A` | `#68748B` | viền ô nhập trên thẻ: 3,6 / 3,6 (≥ 3)    |
| `--primary` / `--ring` | `#1E40AF` | `#8EA8FF` | trên thẻ: 8,7 / 7,5                      |
| `--primary-foreground` | `#FFFFFF` | `#0D121C` | chữ trên nút: 8,7 / 8,2                  |
| `--destructive`        | `#B42318` | `#FF8A80` | trên thẻ: 6,6 / 7,5                      |

Thêm hai token cho khối cảnh báo "thử quá nhiều" (khác khối lỗi đỏ): `--warning` `#8A4B00` / `#FFC56B` trên `--warning-bg` `#FFF4E0` / `#33240A`.

**Bố cục:**

- Trang đăng nhập: một cột (`max-w-sm`), trên điện thoại không có thẻ bao, trên máy tính là thẻ có viền giữa màn hình. Từ trên xuống: dấu hiệu app (cuốn sổ + bút, SVG tự vẽ) + tên app + "Sổ tay ghi nhớ bệnh nhân", tiêu đề "Đăng nhập", khối lỗi (`role="alert"`, ngay trên các ô), hai ô, nút, hai dòng phụ ("Chưa có tài khoản? Liên hệ quản trị viên để nhận mã kích hoạt." và "Đây là sổ ghi nhớ cá nhân, không thay thế hồ sơ bệnh án.").
- Ô nhập cao 48 px, chữ 16 px, nhãn luôn hiện. Ô tên đăng nhập: `autoComplete="username"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, `enterKeyHint="next"`, tự focus. Ô mật khẩu: `autoComplete="current-password"`, `enterKeyHint="go"`, nút `Eye`/`EyeOff` 44 px có `aria-label` "Hiện mật khẩu"/"Ẩn mật khẩu".
- Nút "Đăng nhập" rộng hết cột, cao 48 px; khi đang gửi: spinner + "Đang đăng nhập…", `disabled`.
- Lỗi: sai thông tin và bị khoá là khối đỏ (icon cảnh báo / ổ khoá); thử quá nhiều là khối vàng (icon đồng hồ); bỏ trống là lỗi dưới ô ("Nhập tên đăng nhập.", "Nhập mật khẩu.") với `aria-invalid` + `aria-describedby`. Sau lỗi: giữ tên đăng nhập (controlled), xoá mật khẩu (React 19 xoá ô uncontrolled sau khi gửi).
- Cài đặt (bác sĩ): thẻ "Tài khoản" gồm `InitialsAvatar` 48 px, tên hiển thị, "Tên đăng nhập: …", nút viền "Đăng xuất" rộng hết thẻ cao 48 px có icon `LogOut`; phần còn lại của Cài đặt giữ `FeaturePlaceholder`.
- Quản trị: thanh trên gồm tên app + nhãn nhỏ "Quản trị" (thay chuỗi "Doctor Handbook · Quản trị" hiện có) và nút ghost "Đăng xuất" (icon + chữ) ở góc phải.

**Cách kiểm tra:** xem lại các màn hình thật ở 390 px và 1280 px, sáng/tối, so với mockup; rà bằng `web-design-guidelines`.

**Điều chỉnh khi apply (18/11/2026), không đổi bố cục đã duyệt:**

- Ô tên đăng nhập là _uncontrolled_, nhận `defaultValue` = tên vừa gửi. Lý do: sau mỗi action React gọi `form.reset()`; Safari (WebKit) xoá ô controlled vì React không render lại khi state không đổi. E2E trên WebKit bắt được lỗi này.
- Sau một lần đăng nhập không thành công, focus về ô cần sửa (ô bị lỗi, nếu không thì ô mật khẩu vừa xoá).
- Spinner trong nút là trang trí (`aria-hidden`), chữ "Đang đăng nhập…" đã nói trạng thái; mọi spinner có `motion-reduce`.
- Avatar chữ cái là trang trí (tên luôn hiện cạnh); tên app có `translate="no"`; khu quản trị có skip link "Bỏ qua tới nội dung chính"; toàn app có `touch-action: manipulation`.
- Nút "Đăng xuất" ở Cài đặt dùng viền `--input` và nền thẻ như mockup (biến thể outline mặc định của shadcn nhạt hơn).
- `BottomNav` tự đọc danh sách menu (danh sách chứa component icon, không truyền được từ Server Component sang Client Component — lỗi có từ scaffold, lộ ra khi trang bác sĩ được render lần đầu).

### 7. Kiểm thử

- **Unit (Vitest):** `loginSchema`; `isLoginBlocked` (biên 4/5, 19/20); `authenticate` với `queries`/`rate-limit`/`password` được mock (sai mật khẩu, không có tài khoản vẫn gọi `verifyPassword`, khoá, bị chặn không ghi lần sai, thành công xoá đếm); `createFormAction` (FormData → object, lỗi, `redirect` đi qua).
- **E2E (Playwright) với PostgreSQL thật:**
  - CI: job `e2e` thêm service `postgres:17`, chạy `pnpm db:migrate`, đặt biến môi trường giả cho Supabase/pepper (không dùng tới trong các luồng này).
  - `tests/e2e/fixtures/db.ts`: kết nối trực tiếp bằng `postgres` + `@node-rs/argon2` (không import `src/server`, vì `server-only`), tạo lại tài khoản mẫu (Admin, `bs.lan`, `bs.minh`, một tài khoản bị khoá), xoá `auth_attempts` và `sessions` trước mỗi test, chèn lần sai "cũ" cho scenario cửa sổ 15 phút.
  - Test cần DB **tự bỏ qua** khi không có `E2E_DATABASE_URL`, để máy chưa có DB vẫn chạy được phần còn lại.
  - Chạy tuần tự trong CI (`workers: 1`) vì mọi test chung một IP và một bảng `auth_attempts`.
  - Bổ sung test cho các scenario của `access-gate` cần đăng nhập: "Admin mở danh sách bệnh nhân", "Bác sĩ mở khu vực quản trị", "Đã đăng nhập mở trang đăng nhập", "Gọi dọn phiên khi phiên còn hiệu lực", "Tài khoản bị khoá khi đang đăng nhập".

## Risks / Trade-offs

- [Phòng khám dùng chung một IP (NAT), nhiều bác sĩ gõ sai cùng lúc chạm ngưỡng IP] → ngưỡng IP 20 lần/15 phút, gấp bốn ngưỡng theo tên; nhóm nhỏ hiếm khi chạm. Nếu xảy ra, tăng hằng số.
- [Hai lần thử song song cùng lúc có thể vượt ngưỡng một chút] → chấp nhận; chỉ lệch vài lần, không phá giới hạn.
- [Tấn công phân tán từ nhiều IP vẫn bị giới hạn theo tên đăng nhập (5 lần/15 phút)] → đủ cho mật khẩu ≥ 8 ký tự; không làm khoá cứng để tránh bị khoá ác ý.
- [Database Supabase vừa thức dậy, lần đăng nhập đầu chậm] → nút có trạng thái đang xử lý; cron hằng ngày giữ DB thức.
- [Fixture E2E xoá dữ liệu bảng tài khoản] → chỉ chạy với `E2E_DATABASE_URL` (DB riêng cho test, không bao giờ là DB dev/prod); fixture từ chối chạy nếu URL trỏ tới host `supabase.co`.

## Migration Plan

Không có migration. Triển khai như bình thường; Admin phải được tạo trước bằng `pnpm db:seed-admin` để đăng nhập được. Rollback: deploy bản trước, phiên đã tạo vẫn hợp lệ (schema không đổi).
