# Proposal: add-feedback

## Why

Đợt dùng thử (idea.md §15) lấy phản hồi chủ yếu qua "nút góp ý trong app", mục **Should** cuối cùng
còn thiếu của MVP (idea.md §11, hàng "Nút gửi góp ý trong app"; điều hướng §12.6 đặt "Góp ý" trong
Cài đặt). Hiện bác sĩ gặp lỗi hay khó chịu giữa buổi khám chỉ có cách nhớ để kể lại sau, và thường quên.
Cần một chỗ gửi trong vài giây, ngay trên điện thoại, và một chỗ để Admin (chủ dự án) đọc lại.

## What Changes

- **Bác sĩ**: Cài đặt có thêm dòng "Góp ý", mở trang `/settings/feedback` với một ô chữ (bắt buộc, tối
  đa 2.000 ký tự) và nút "Gửi góp ý". Ngay trên ô có lời nhắc không ghi tên hay thông tin bệnh nhân,
  vì Admin đọc được nội dung. Gửi xong: ô trống lại và báo "Đã gửi góp ý. Cảm ơn bác sĩ!" ngay trên
  trang. Gửi không được (mất mạng, lỗi): chữ đã gõ vẫn còn.
- **Giới hạn**: mỗi tài khoản gửi tối đa 20 góp ý trong 24 giờ, đủ cho dùng thật và chặn gửi lặp do lỗi.
- **Thông tin kèm theo, tự động**: thời điểm gửi, loại máy và trình duyệt (đọc từ request, hiện gọn kiểu
  "iPhone · Safari"), mã bản triển khai đang chạy. Không kèm trang đang mở hay bất kỳ dữ liệu nào khác.
- **Admin**: thêm tab "Góp ý" (`/admin/feedback`): danh sách mới nhất trước, mỗi mục có tên và tên đăng
  nhập người gửi, thời điểm, loại máy, nội dung. Mục chưa xem có nhãn "Mới". Admin bấm "Đã xem" để bỏ
  nhãn, hoặc "Xoá" (có hộp thoại xác nhận) để xoá hẳn, ví dụ khi góp ý lỡ chứa thông tin bệnh nhân.
- **Xoá tài khoản**: góp ý của tài khoản bị xoá vẫn ở lại cho Admin, người gửi hiện "Tài khoản đã xoá".
- Module mới **`src/modules/feedback`**, gồm phần gửi (`access: "doctor"`) và phần đọc
  (`access: "admin"`).

## Capabilities

### New Capabilities

- `feedback`: bác sĩ gửi góp ý trong app, Admin đọc, đánh dấu đã xem và xoá góp ý; giới hạn số lần
  gửi; góp ý còn lại khi xoá tài khoản; quyền truy cập.

### Modified Capabilities

(không có; trang Cài đặt và thanh tab Admin chỉ thêm đường dẫn, không đổi requirement nào đang có)

## Ngoài phạm vi

- Bác sĩ xem lại các góp ý mình đã gửi hay trạng thái Admin đã xem chưa: đợt dùng thử có hỏi trực tiếp
  sau tuần 1 (idea.md §15).
- Admin trả lời góp ý trong app, hay thông báo (email, push) khi có góp ý mới: cần dịch vụ ngoài, trái D1.
- Đính kèm ảnh chụp màn hình: tốn Storage và dễ chụp phải dữ liệu bệnh nhân.
- Số góp ý mới trên tab "Góp ý": thanh tab Admin là layout dùng chung, không đọc dữ liệu; số mới hiện
  ngay đầu trang Góp ý.
- Phân trang: trang Admin hiện 200 góp ý mới nhất, quá đủ cho một nhóm nhỏ.

## Bất biến bị chạm

- **"Dữ liệu mới thêm vào schema MUST có mặt trong sao lưu/nhập" (D8, N5)**: bảng `feedback` **không**
  vào file sao lưu và không bị nhập thay thế. Góp ý là thư bác sĩ gửi Admin, không phải dữ liệu sổ tay
  của bác sĩ: nhập lại một file cũ mà gửi lại góp ý cũ cho Admin là sai, và file sao lưu không nên chứa
  thư đã gửi người khác. Nếu duyệt, sửa câu bất biến trong `openspec/config.yaml` thành "dữ liệu sổ tay
  của bác sĩ thêm vào schema MUST có mặt trong sao lưu/nhập (góp ý gửi Admin không thuộc sổ tay)".
- **N6, S4 (Admin không đọc dữ liệu bệnh nhân)**: không đổi. Code của Admin chỉ đọc bảng `feedback` và
  tên tài khoản, không chạm `patients`, `notes`, `todos`. Rủi ro còn lại là bác sĩ tự gõ thông tin bệnh
  nhân vào góp ý. Giảm bằng lời nhắc ngay trên ô chữ và nút "Xoá" của Admin; nội dung góp ý không bao
  giờ vào log, toast hay tiêu đề.

## Impact

- **Database**: bảng mới `feedback` (`id`, `account_id` → `accounts.id` **ON DELETE SET NULL**,
  `content`, `device`, `deployment_id`, `seen_at`, `created_at`), `.enableRLS()`, index theo
  `created_at` và theo (`account_id`, `created_at`) cho giới hạn 24 giờ. Migration chỉ thêm bảng, tương
  thích ngược.
- **Sao lưu/nhập**: không đổi định dạng (xem Bất biến bị chạm).
- **Code**: `src/modules/feedback/**` (mới); `src/app/(doctor)/settings/feedback/` và
  `src/app/admin/feedback/` (route mới); `src/app/(doctor)/settings/page.tsx` (thêm dòng);
  `src/config/routes.ts`, `src/config/navigation.ts` (đường dẫn và tab); `src/server/db/schema/`.
- **Tài liệu**: `src/modules/README.md`, `src/modules/feedback/README.md`, `docs/architecture.md`
  (bảng dữ liệu), `openspec/config.yaml` (câu bất biến, nếu duyệt).
- Không thêm thư viện, không dịch vụ ngoài.
