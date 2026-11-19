# Proposal

## Why

Admin mới chỉ khoá được tài khoản. Khi một bác sĩ thôi hẳn không dùng app, hoặc yêu cầu xoá dữ liệu của mình, thì bệnh nhân, ghi chú, ảnh và việc cần làm vẫn nằm trên server mãi, dù không ai dùng tới. D21 đã chốt Admin **được xoá** tài khoản cùng toàn bộ dữ liệu, có xác nhận bằng cách gõ lại tên đăng nhập. Đây là một trong hai mục MVP còn thiếu trước đợt dùng thử (mục 15). Change `add-account-management` đã cố ý hoãn việc này tới lúc có dữ liệu bệnh nhân và ảnh để xoá cùng; nay hai thứ đó đã có.

Cùng lúc, Admin cần biết một tài khoản đang có bao nhiêu dữ liệu và bác sĩ sao lưu lần cuối khi nào, trước khi quyết định xoá. idea.md §17 P3-3 đã dự kiến hai con số này: số bệnh nhân và ngày sao lưu gần nhất, chỉ là con số, không phải nội dung (N6).

Change thuộc module **`admin`** (`src/modules/admin`). Nó đáp ứng các mục sau của idea.md:

- D21 và §10.4, phía Admin: "Xoá tài khoản kèm toàn bộ dữ liệu, gõ lại tên đăng nhập để xác nhận".
- §11: dòng "Xoá tài khoản" (Should, MVP).
- §17 P3-3: số bệnh nhân và ngày sao lưu gần nhất trong danh sách tài khoản.
- N2: xoá là thao tác không hoàn tác được nên phải xác nhận.
- N6 và S4: Admin không đọc dữ liệu bệnh nhân, chỉ đếm.
- S5: ảnh bệnh nhân không được sót lại trong kho sau khi tài khoản bị xoá.

## What Changes

- **Danh sách tài khoản** (`/admin/accounts`) thêm hai thông tin cho mỗi tài khoản bác sĩ:
  - số bệnh nhân (không tính thùng rác);
  - ngày sao lưu gần nhất, hoặc "Chưa sao lưu".
- **Nút "Xoá" chỉ có ở tài khoản đã khoá.** Dòng đang hoạt động giữ nguyên hai nút "Cấp mã đặt lại mật khẩu" và "Khoá". Dòng đã khoá có "Mở khoá" và "Xoá". Cách này đi đúng ý D21, "thông thường chỉ cần khoá": muốn xoá thì khoá trước, nên không bấm nhầm được ngay trên một tài khoản đang dùng.
- **Hộp thoại xoá:**
  - nêu họ tên bác sĩ, số bệnh nhân và ngày sao lưu gần nhất;
  - nói rõ sẽ mất những gì: bệnh nhân (cả thùng rác), ghi chú, ảnh, việc cần làm; không hoàn tác được;
  - nhắc rằng nếu bác sĩ còn cần dữ liệu thì mở khoá để bác sĩ tự sao lưu trước;
  - có ô "Gõ tên đăng nhập để xác nhận". Nút "Xoá vĩnh viễn" chỉ bấm được khi chữ gõ vào trùng tên đăng nhập. Server kiểm lại, không tin trình duyệt.
- **Khi xác nhận:**
  - xoá ảnh của tài khoản trong kho lưu trữ;
  - xoá tài khoản; theo đó mọi phiên, bệnh nhân, ghi chú, việc cần làm và mã của tài khoản cũng mất;
  - dòng biến mất khỏi danh sách, và trang báo "Đã xoá tài khoản bs.lan.".
  - Tên đăng nhập được giải phóng: sau này có thể dùng lại khi kích hoạt bằng mã mới.
- **Từ chối và báo lỗi trong hộp thoại**, không xoá gì, khi:
  - tài khoản không còn bị khoá (ví dụ vừa được mở khoá ở thiết bị khác);
  - tên đăng nhập gõ vào không khớp;
  - không tìm thấy tài khoản (đã bị xoá, hoặc là tài khoản Admin);
  - xoá ảnh thất bại. Khi đó tài khoản vẫn còn và vẫn khoá, Admin thử lại sau.
- **Chỉ Admin** được xoá. Người chưa đăng nhập bị từ chối với `UNAUTHENTICATED`, bác sĩ với `FORBIDDEN`.

## Capabilities

### New Capabilities

(Không có.)

### Modified Capabilities

- `account-management`:
  - ADDED "Xoá tài khoản" và "Xác nhận xoá bằng tên đăng nhập".
  - MODIFIED "Danh sách tài khoản bác sĩ": thêm số bệnh nhân và ngày sao lưu gần nhất.
  - MODIFIED "Chỉ Admin quản lý tài khoản": thêm việc xoá vào phạm vi quyền.

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, người dùng duyệt trước khi code. Dùng bảng màu đã chốt, không thêm token màu.
- **Module `admin`**:
  - `server/queries.ts`: `listDoctorAccounts` thêm `patientCount` (một truy vấn con `count(*)`) và `lastBackupAt`.
  - `server/mutations.ts`: `deleteDoctorAccount`.
  - `server/actions.ts`: `deleteAccountAction` (`createAction`, `access: "admin"`).
  - `schemas.ts`, `constants.ts`.
  - `components/`: `account-list.tsx`, một nút xoá mới kèm hộp thoại.
- **Tầng dùng chung**:
  - `src/server/storage/objects.ts`: hàm xoá mọi object dưới tiền tố `<accountId>/` của một bucket.
  - Dùng lại `ConfirmDialog`, vốn đã có chỗ (`children`) dành cho ô "gõ tên đăng nhập".
- **E2E**: `tests/e2e/fake-storage.mjs` đã có route liệt kê theo tiền tố và xoá. Thêm test vào `tests/e2e/account-management.spec.ts`.
- **Database**: không đổi schema, không migration. Mọi bảng chứa dữ liệu của tài khoản đã khai `ON DELETE CASCADE` theo `accounts.id`: `sessions`, `patients`, `notes`, `todos`, và `access_codes` qua `account_id`. Mã do chính Admin tạo dùng `created_by_id` với `SET NULL`.
- **Sao lưu**: không đổi định dạng file. Bảng tài khoản không nằm trong sao lưu.
- **Thư viện và dịch vụ**: không thêm.
- **Bất biến**, có chạm nhưng không vi phạm:
  - **N6** ("code admin không truy vấn patients, notes, todos, chỉ được đếm"). Danh sách chỉ đếm số bệnh nhân. Lúc xoá, code admin không đọc dòng nào: database tự xoá dây chuyền. Ảnh được xoá theo tiền tố thư mục của tài khoản trong kho, không đọc `patients.avatar_path`.
  - **N2**: xoá là thao tác không hoàn tác được, nên có hộp thoại xác nhận.
  - **"Mọi truy vấn lọc theo `auth.account.id`"**: không áp dụng ở đây. Đây là thao tác của Admin trên tài khoản người khác, giống khoá và mở khoá. Id tài khoản đến từ client, nhưng chỉ khớp được dòng `role = 'doctor'`.

## Ngoài phạm vi

- **Xoá tài khoản đang hoạt động trong một bước.** Phải khoá trước. Nếu đợt dùng thử cho thấy bước khoá là thừa thì làm change sau.
- **Bác sĩ tự xoá tài khoản của mình** ở Cài đặt. idea.md không có mục này.
- **Admin tải sao lưu thay bác sĩ trước khi xoá.** Admin không được đọc dữ liệu bệnh nhân (N6). Nếu cần giữ dữ liệu, bác sĩ tự sao lưu.
- **Lịch sử xoá** (ai xoá, khi nào). Log server chỉ ghi id tài khoản và số lượng.
- **Giữ lại dòng mã kích hoạt đã dùng** của tài khoản bị xoá trong danh sách mã. Muốn giữ thì phải đổi khoá ngoại sang `SET NULL` và đổi cách hiện trạng thái "Đã dùng", tức là cần migration. Dòng này hiện mất theo tài khoản; chưa ai cần nó.
- **Dọn định kỳ ảnh mồ côi.** Một link tải ảnh lên đã cấp trước lúc khoá vẫn còn hạn ngắn. Ảnh tải lên theo link đó sau khi xoá không có dòng nào trỏ tới và tên ngẫu nhiên, nên không ai mở được. Ghi lại rủi ro này trong design.
