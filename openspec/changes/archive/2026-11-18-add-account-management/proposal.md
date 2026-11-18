# Proposal

## Why

Bác sĩ đã tự tạo được tài khoản (change `add-account-activation`). Nhưng Admin chưa thấy ai đang dùng app, và chưa có cách chặn một tài khoản. Vì phiên đăng nhập không tự hết hạn (D13), khi bác sĩ mất điện thoại thì **Admin khoá tài khoản là lớp bảo vệ duy nhất** (idea.md §8.3, R7). Trang `/admin/accounts` hiện chỉ là chỗ trống.

Change thuộc module **`admin`** (`src/modules/admin`). Nó đáp ứng các mục sau của idea.md:

- §10, phía Admin: danh sách tài khoản (tên, tên đăng nhập, ngày tạo, lần đăng nhập cuối, trạng thái); khoá và mở khoá tài khoản.
- §8.3 và S8: khoá tài khoản kết thúc mọi phiên, có hiệu lực ngay.
- N6 và S4: Admin không đọc dữ liệu bệnh nhân.
- N2: chỉ hỏi xác nhận khi khoá. Mở khoá thì không hỏi.

## What Changes

- **Danh sách tài khoản bác sĩ** ở `/admin/accounts`, mới tạo nhất ở trên.
  - Mỗi tài khoản hiện họ tên, tên đăng nhập, ngày tạo, lần đăng nhập cuối (hoặc "Chưa đăng nhập") và trạng thái "Đang hoạt động" hoặc "Đã khoá". Trạng thái có cả icon và chữ, không chỉ màu.
  - Tài khoản Admin không nằm trong danh sách.
  - Chưa có tài khoản bác sĩ nào thì hiện trạng thái rỗng, có liên kết sang trang Mã truy cập.
- **Khoá tài khoản.**
  - Nút "Khoá" mở hộp thoại xác nhận có tên bác sĩ.
  - Khi xác nhận: tài khoản chuyển sang "Đã khoá" và **mọi phiên của tài khoản bị xoá ngay**.
  - Bác sĩ bị đăng xuất ở mọi thiết bị ngay lần mở trang tiếp theo, và không đăng nhập lại được cho tới khi được mở khoá.
- **Mở khoá tài khoản.**
  - Nút "Mở khoá" chạy ngay, không hỏi xác nhận.
  - Bác sĩ đăng nhập lại được bằng mật khẩu cũ. Các phiên cũ **không** sống lại, nên máy bị mất vẫn bị đăng xuất.
- **Chỉ Admin** xem danh sách, khoá và mở khoá. Không ai khoá được tài khoản Admin qua các thao tác này.

## Capabilities

### New Capabilities

- `account-management`: Admin xem danh sách tài khoản bác sĩ, khoá và mở khoá tài khoản, và việc khoá kết thúc mọi phiên. Sau này xoá tài khoản (D21) và cấp mã đặt lại mật khẩu từ một tài khoản sẽ thêm requirement vào đây.

### Modified Capabilities

(Không có.) Hai hành vi liên quan đã có trong spec và giữ nguyên, change này chỉ cung cấp cách khoá thật để chúng được dùng tới:

- `account-session`: "Tài khoản bị khoá không đăng nhập được".
- `access-gate`: "Phiên không còn hiệu lực được dọn" (tài khoản bị khoá khi đang đăng nhập).

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token màu.
- **Module `admin`**:
  - `server/queries.ts`: `listDoctorAccounts`.
  - `server/mutations.ts`: `setDoctorAccountStatus` (một hàm cho cả khoá và mở khoá).
  - `server/actions.ts`: `lockAccountAction`, `unlockAccountAction`, cả hai `access: "admin"`.
  - `schemas.ts`, `constants.ts`.
  - `components/`: danh sách tài khoản, nút khoá/mở khoá.
- **Route**: `src/app/admin/accounts/page.tsx` bỏ `FeaturePlaceholder`; thêm `loading.tsx`.
- **Tầng dùng chung**: dùng lại `invalidateAccountSessions` (`src/server/auth/session.ts`, đã có, chưa ai gọi), `ConfirmDialog`, `EmptyState`, `formatDateTime`.
- **Database**: không đổi schema, không migration. Dùng `accounts.status`, `accounts.last_login_at`, `accounts.created_at` và bảng `sessions`. Không ảnh hưởng file sao lưu (bảng tài khoản và phiên không nằm trong sao lưu).
- **Thư viện và dịch vụ**: không thêm.
- **Bất biến**: không vi phạm.
  - Truy vấn chỉ đụng `accounts` (và xoá `sessions`), không đụng bảng bệnh nhân (N6).
  - Mọi action dựng bằng `createAction` với `access: "admin"`.
  - Khoá là thao tác có xác nhận, đúng N2.

## Ngoài phạm vi

- **Xoá tài khoản** kèm toàn bộ dữ liệu, gõ lại tên đăng nhập để xác nhận (D21): change sau, khi đã có dữ liệu bệnh nhân và ảnh để xoá cùng (người dùng chốt ngày 18/11/2026).
- **Mã đặt lại mật khẩu** cho một tài khoản (`add-password-reset`): change kế tiếp. Danh sách này sẽ là nơi Admin chọn tài khoản để cấp mã.
- **Số bệnh nhân, lần sao lưu cuối** của từng tài khoản: idea.md §10 không yêu cầu, và chưa có module bệnh nhân hay sao lưu.
- **Tìm kiếm, lọc, phân trang** danh sách: nhóm vài chục người, chưa cần.
- **Đổi tên hiển thị hay tên đăng nhập** của bác sĩ từ phía Admin.
- **Danh sách thiết bị đang đăng nhập** của một tài khoản.
