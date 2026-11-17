# Proposal

## Why

Khung ứng dụng đã chặn mọi màn hình khi chưa đăng nhập (`access-gate`) nhưng trang `/login` mới là chỗ trống: chưa ai vào được app, kể cả Admin đã được tạo bằng `pnpm db:seed-admin`. Đăng nhập là cửa vào của mọi module khác (Admin cấp mã, bác sĩ ghi bệnh nhân), nên phải làm trước.

Change thuộc module **`auth`** (`src/modules/auth`), đáp ứng idea.md: D13 (tên đăng nhập + mật khẩu, giữ đăng nhập mãi, phiên thu hồi được), §8.3 (các sự kiện kết thúc phiên), S2 (mật khẩu băm), S6 (giới hạn số lần thử), S8 (phiên thu hồi được), N2 (nhanh, ít thao tác), N3 (điện thoại trước).

## What Changes

- **Đăng nhập** ở `/login` cho cả bác sĩ và Admin bằng tên đăng nhập + mật khẩu. Tên đăng nhập không phân biệt hoa thường, bỏ khoảng trắng hai đầu.
- **Một thông báo chung** cho tên đăng nhập không tồn tại và sai mật khẩu, để không dò được tên nào có thật. Tài khoản bị khoá chỉ được báo "đã bị khoá" khi mật khẩu đúng.
- **Sau khi đăng nhập**, đi tới trang đã định mở (`next`, chỉ đường dẫn an toàn) hoặc trang chính theo vai trò (bác sĩ: `/patients`; Admin: `/admin/access-codes`).
- **Giữ đăng nhập mãi** trên thiết bị (D13): phiên không tự hết hạn, chỉ kết thúc khi đăng xuất hoặc bị thu hồi.
- **Đăng xuất** cho bác sĩ (màn hình Cài đặt) và Admin (thanh trên khu vực quản trị): chỉ kết thúc phiên trên thiết bị đó.
- **Giới hạn đăng nhập sai** (S6): quá 5 lần sai cho một tên đăng nhập, hoặc quá 20 lần sai từ một địa chỉ IP, trong 15 phút thì tạm từ chối mọi lần thử tiếp (kể cả mật khẩu đúng) cho tới khi hết cửa sổ.
- **Form tối ưu cho điện thoại**: không tự viết hoa chữ đầu, không tự sửa chính tả ở ô tên đăng nhập, gợi ý tự điền của trình duyệt/trình quản lý mật khẩu, nút hiện/ẩn mật khẩu, bàn phím "Đi" gửi form.
- **Hạ tầng kiểm thử**: CI chạy PostgreSQL thật cho E2E (migration + tài khoản mẫu), để kiểm các scenario cần đăng nhập, kể cả các scenario của `access-gate` trước đây chưa có test (sai vai trò, phiên bị thu hồi).

## Capabilities

### New Capabilities

- `account-session`: đăng nhập và đăng xuất của tài khoản (bác sĩ, Admin), nơi đến sau khi đăng nhập, thông báo lỗi, thời hạn phiên, giới hạn số lần đăng nhập sai.

### Modified Capabilities

(Không có. `access-gate` giữ nguyên requirement; change này chỉ bổ sung test cho các scenario cần người đã đăng nhập.)

## Impact

- **Thiết kế**: mockup local `mockup/index.html` phải được người dùng duyệt trước khi code giao diện. Đây là change giao diện đầu tiên nên chốt luôn bảng màu của app (đề xuất "Mực bút bi": đổi token màu trong `src/app/globals.css`; hoặc giữ trung tính).
- **Module `auth`** (mới có code): `schemas.ts`, `server/queries.ts`, `server/mutations.ts`, `server/rate-limit.ts`, `server/actions.ts` (`login`, `logout`), `components/login-form.tsx`, `components/logout-button.tsx`.
- **Route**: `src/app/(auth)/login/page.tsx` (bỏ `FeaturePlaceholder`), `src/app/(doctor)/settings/page.tsx` (thêm mục đăng xuất), `src/app/admin/layout.tsx` (nút đăng xuất).
- **Tầng dùng chung**: `AdminShell` nhận slot hành động ở thanh trên (layout không được import module). `src/server/auth`: dùng lại `password`, `session`, `cookies`, `attempts`; thêm hằng số giới hạn.
- **Database**: không đổi schema, không migration mới. Dùng bảng `auth_attempts` có sẵn và cột `accounts.last_login_at`. Không ảnh hưởng file sao lưu (bảng tài khoản và phiên không nằm trong sao lưu).
- **CI**: job E2E có service PostgreSQL, chạy `db:migrate` và tạo tài khoản mẫu trước khi test.
- **Thư viện và dịch vụ**: không thêm.
- **Bất biến**: không vi phạm. Đăng nhập là action `access: "public"` qua `createAction`; không log mật khẩu hay tên đăng nhập.

## Ngoài phạm vi

- **Kích hoạt tài khoản bằng mã** (bác sĩ tự đặt tên đăng nhập + mật khẩu) và **Admin cấp mã**: change `add-account-activation` / `add-access-codes`. Trước khi có chúng, tài khoản bác sĩ chỉ có trong test.
- **Đặt lại mật khẩu bằng mã** và **đổi mật khẩu**: change riêng.
- **Admin khoá / mở khoá / xoá tài khoản**: module `admin`. Change này chỉ xử lý việc tài khoản đã bị khoá thì không đăng nhập được.
- "Đăng xuất khỏi mọi thiết bị", danh sách thiết bị đang đăng nhập: idea.md không có.
- Đăng nhập Google (D14), mã PIN, vân tay/Face ID.
- CAPTCHA: nhóm nhỏ, giới hạn số lần thử là đủ.
