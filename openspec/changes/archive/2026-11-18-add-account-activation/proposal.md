# Proposal

## Why

Hiện chỉ đăng nhập được bằng Admin (tạo bằng `pnpm db:seed-admin`) và tài khoản mẫu trong test: chưa có cách nào để một bác sĩ thật có tài khoản. idea.md chốt rằng tài khoản **chỉ** được tạo bằng mã kích hoạt 72 giờ do Admin cấp (D2, D17), nên đây là bước bắt buộc trước khi dùng thử với bác sĩ (mục 16) và trước mọi module dữ liệu (bệnh nhân, việc cần làm).

Change thuộc module **`admin`** (`src/modules/admin`: cấp, xem, huỷ mã) và **`auth`** (`src/modules/auth`: bác sĩ kích hoạt tài khoản). Nó đáp ứng các mục sau của idea.md:

- D2, D17: mã kích hoạt 72 giờ, hết hạn thì xin mã mới.
- §8.2 "Thiết kế mã" và "Kích hoạt tài khoản": một lần dùng, 8 ký tự dễ đọc, ghi tên người nhận, huỷ được, chống dò mã; quy tắc tên đăng nhập và mật khẩu.
- S2: mã và mật khẩu chỉ lưu dạng băm.
- S6: giới hạn số lần nhập sai mã.
- S9 và §19: lưu ý sử dụng phải đồng ý khi kích hoạt.
- §10 phía Admin: tạo mã kèm tên bác sĩ, sao chép mã, danh sách mã theo trạng thái, huỷ mã chưa dùng.
- N2, N3: nhanh, điện thoại trước.

## What Changes

**Admin cấp mã kích hoạt** ở `/admin/access-codes`:

- Admin nhập tên người nhận (ví dụ "BS. Trần Thị B") rồi tạo mã.
- Mã gồm 8 ký tự in hoa và số, bỏ các ký tự dễ nhầm, hiển thị dạng `K7HM-3QXR`. Mã có hạn 72 giờ.
- Mã **chỉ hiện một lần**, ngay sau khi tạo, vì server chỉ lưu bản băm. Cùng lúc đó hiện nút sao chép một tin nhắn soạn sẵn (gồm mã, đường dẫn trang kích hoạt, giờ hết hạn) để gửi qua Zalo.

**Danh sách mã** trên cùng trang, mới nhất ở trên:

- Mỗi mã có tên người nhận, ngày tạo và trạng thái.
- Bốn trạng thái: **Còn hạn** (kèm giờ hết hạn), **Đã dùng** (kèm tên đăng nhập đã tạo và thời điểm), **Hết hạn**, **Đã huỷ**.
- Danh sách không bao giờ hiện lại mã.

**Huỷ mã** chưa dùng và còn hạn: Admin xác nhận trong hộp thoại, vì thao tác này không hoàn tác được. Mã đã huỷ không dùng được nữa.

**Bác sĩ kích hoạt tài khoản** ở `/activate`, gồm hai bước trên cùng trang:

1. Nhập mã. Bác sĩ gõ thế nào cũng được: chữ thường, có hay không có dấu gạch, có khoảng trắng.
2. Mã hợp lệ thì hiện tên người nhận và giờ hết hạn, rồi bác sĩ điền:
   - Họ tên hiển thị, điền sẵn tên người nhận và sửa được.
   - Tên đăng nhập: 3–32 ký tự, gồm chữ không dấu, số, dấu chấm, gạch dưới; không phân biệt hoa thường; không trùng với tài khoản khác.
   - Mật khẩu: tối thiểu 8 ký tự.
   - Ô tick đồng ý lưu ý sử dụng (§19).

Khi gửi, server kiểm lại mã. Nếu hợp lệ, server tạo tài khoản bác sĩ, đánh dấu mã đã dùng, đăng nhập luôn và đưa bác sĩ vào `/patients`. Tất cả trong một giao dịch, nên một mã không bao giờ tạo được hai tài khoản.

**Thông báo khi mã không dùng được.** Mã sai, đã dùng, đã huỷ và hết hạn dùng **cùng một thông báo** để không dò được mã nào có thật. Thông báo hướng dẫn bác sĩ liên hệ Admin xin mã mới.

**Giới hạn nhập sai mã** (S6): quá 10 lần nhập mã không dùng được từ một địa chỉ IP trong 15 phút thì tạm từ chối mọi lần nhập mã tiếp theo từ IP đó, cho tới khi hết cửa sổ.

**Trang đăng nhập** có thêm liên kết "Kích hoạt tài khoản" tới `/activate`, cho người đã có mã. Trang kích hoạt có liên kết quay lại đăng nhập.

## Capabilities

### New Capabilities

- `access-codes`: Admin cấp, xem và huỷ mã truy cập (change này: mã kích hoạt). Bao gồm mã chỉ hiện một lần, trạng thái, hạn 72 giờ và quyền chỉ dành cho Admin. Mã đặt lại mật khẩu sau này thêm requirement vào đây.
- `account-activation`: bác sĩ dùng mã kích hoạt để tạo tài khoản. Bao gồm kiểm mã, quy tắc tên đăng nhập và mật khẩu, đồng ý lưu ý sử dụng, đăng nhập ngay sau khi kích hoạt, thông báo lỗi không lộ mã và giới hạn nhập sai mã.

### Modified Capabilities

(Không có.) `access-gate` đã quy định `/activate` là trang công khai và người đã đăng nhập mở `/activate` thì được chuyển về trang chính. `account-session` không đổi; tài khoản vừa kích hoạt đăng nhập theo đúng các requirement hiện có.

## Impact

- **Thiết kế**: mockup local `mockup/index.html` phải được người dùng duyệt trước khi code giao diện. Mockup gồm trang Mã truy cập của Admin (tạo mã, mã vừa tạo, danh sách, huỷ) và trang kích hoạt (bước nhập mã, bước tạo tài khoản, các lỗi). Dùng bảng màu A đã chốt, không thêm token màu mới. Nếu cần nhãn trạng thái thì dùng token sẵn có.
- **Module `admin`** (bắt đầu có code):
  - `schemas.ts`, `constants.ts`
  - `server/queries.ts` (danh sách mã)
  - `server/mutations.ts` (tạo, huỷ)
  - `server/actions.ts`
  - `components/` (form tạo mã, thẻ mã vừa tạo, danh sách, nút huỷ)
- **Module `auth`**:
  - `schemas.ts` (`activationCodeSchema`, `activateAccountSchema`)
  - `server/activation.ts` (kiểm mã, kích hoạt trong giao dịch)
  - `server/code-rate-limit.ts` (hoặc mở rộng `rate-limit.ts`)
  - `server/actions.ts` (`checkActivationCodeFormAction`, `activateAccountFormAction`)
  - `components/activation-form.tsx`
- **Route**:
  - `src/app/admin/access-codes/page.tsx` và `src/app/(auth)/activate/page.tsx`: bỏ `FeaturePlaceholder`.
  - `src/app/(auth)/login/page.tsx`: thêm liên kết kích hoạt.
- **Tầng dùng chung**:
  - Dùng lại `generateAccessCode`, `hashAccessCode`, `formatAccessCode`, `ACCESS_CODE_TTL_MS`, `usernameSchema`, `passwordSchema`, `hashPassword`, `createSession`, `setSessionCookie`, `getClientIp`, `ConfirmDialog`.
  - Có thể thêm hằng số giới hạn nhập mã vào `src/server/auth/constants.ts`.
- **Database**: **không đổi schema, không migration mới.** Bảng `access_codes` (loại, mã băm, tên người nhận, `account_id`, hết hạn, đã dùng, đã huỷ) và các cột `accounts.display_name`, `accounts.terms_accepted_at` đã có từ migration `0001`. Tài khoản và mã không nằm trong file sao lưu của bác sĩ, nên không ảnh hưởng sao lưu/nhập.
- **E2E**: fixture DB thêm việc xoá `access_codes` và tạo mã ở các trạng thái khác nhau (còn hạn, hết hạn, đã dùng, đã huỷ). Fixture dùng cùng `ACCESS_CODE_PEPPER` giả với web server test.
- **Thư viện và dịch vụ**: không thêm.
- **Bất biến**:
  - Không vi phạm. Mọi action dựng bằng `createFormAction`/`createAction`: tạo và huỷ mã khai `access: "admin"`, kích hoạt khai `access: "public"`.
  - Code admin chỉ truy vấn `access_codes` và `accounts` (tên đăng nhập của tài khoản đã kích hoạt), không đụng dữ liệu bệnh nhân (N6).
  - Tài khoản chỉ tạo được bằng mã kích hoạt (D2).
  - Không log mã, mật khẩu hay tên đăng nhập. Mã không bao giờ nằm trong URL.

## Ngoài phạm vi

- **Mã đặt lại mật khẩu**: Admin cấp cho một tài khoản, bác sĩ dùng ở `/reset-password`, mọi phiên kết thúc. Làm ở change `add-password-reset`. Trang Mã truy cập của change này chỉ tạo mã kích hoạt; bố cục chừa chỗ cho loại mã thứ hai.
- **Danh sách tài khoản, khoá/mở khoá, xoá tài khoản** (`/admin/accounts`): change quản lý tài khoản riêng.
- **Đổi mật khẩu** khi đang đăng nhập: change riêng.
- **Gửi mã qua email/SMS**: không có dịch vụ gửi (idea.md §8.2). Admin tự gửi qua Zalo.
- **Đưa mã vào đường dẫn** (`/activate?code=…`) để bác sĩ bấm một lần: mã sẽ nằm trong lịch sử trình duyệt và log, nên không làm. Tin nhắn soạn sẵn tách mã và đường dẫn.
- **Xem lại mã đã tạo**: không thể, vì chỉ lưu bản băm. Admin làm mất mã thì huỷ mã đó và tạo mã mới.
- **Tự dọn mã cũ** khỏi database: bảng nhỏ (nhóm vài chục người), chưa cần.
- **Giới hạn nhập mã trên toàn hệ thống** (không theo IP): không làm, vì kẻ xấu có thể dùng nó chặn mọi bác sĩ kích hoạt. Mã ~40 bit cộng giới hạn theo IP là đủ cho nhóm nhỏ (xem design).
