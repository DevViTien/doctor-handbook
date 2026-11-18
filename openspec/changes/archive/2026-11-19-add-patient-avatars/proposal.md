# Proposal

## Why

Khi khám, bác sĩ hay gặp nhiều người trùng tên hoặc tên gần giống nhau. Chữ cái đầu không giúp phân biệt; một tấm ảnh nhỏ cạnh tên thì giúp được (idea.md P6). Ảnh đại diện là mục **Must** cuối cùng của phần Bệnh nhân (§11). Cột `patients.avatar_path`, bucket private và mã ký URL đã có sẵn, nhưng chưa màn hình nào dùng tới.

Change thứ 5/5 của module **`patients`** (`src/modules/patients`). Change này cũng đụng module `backup`, vì ảnh là dữ liệu mới và bất biến yêu cầu nó phải có trong sao lưu và nhập.

Đáp ứng idea.md:

- §10.1: mặc định hiện chữ cái đầu; chụp trực tiếp hoặc chọn ảnh; app tự nén ảnh.
- P6: ảnh hiện cạnh tên trong danh sách để phân biệt người trùng tên.
- §8.4 và §10.5: ảnh nằm **trong cùng một file sao lưu**.
- S5: ảnh chỉ ở kho riêng tư, không có link công khai.
- K4 (teckstack): ảnh đi thẳng giữa trình duyệt và Storage, không qua Vercel Function.
- N2:
  - thêm ảnh không chặn việc ghi nhanh (vẫn chỉ bắt buộc họ tên);
  - chỉ thao tác không hoàn tác được mới hỏi xác nhận.
- BR3: xoá vĩnh viễn bệnh nhân thì xoá cả ảnh.

## What Changes

- **Đặt ảnh** từ trang chi tiết bệnh nhân:
  - chạm vào ảnh hoặc chữ cái đầu (có huy hiệu máy ảnh) mở bảng chọn gồm "Chụp ảnh", "Chọn ảnh có sẵn", và khi đã có ảnh thì thêm "Xem ảnh", "Xoá ảnh";
  - app tự cắt ảnh thành hình vuông ở giữa, thu nhỏ còn 384 × 384 px và nén WebP (khoảng 20–40 KB) ngay trên máy trước khi gửi;
  - đang gửi thì ảnh mờ đi kèm vòng xoay, và có chữ "Đang lưu ảnh…";
  - mất mạng thì app báo "Chưa lưu được ảnh vì mất mạng." kèm "Thử lại", ảnh cũ giữ nguyên.
- **Xem ảnh lớn**: hộp thoại hiện ảnh to hơn, không có tên trong tiêu đề tab.
- **Xoá ảnh**: hỏi bằng `ConfirmDialog` ("Xoá ảnh đại diện?"), vì ảnh bị xoá hẳn khỏi kho. Sau khi xoá, trang lại hiện chữ cái đầu.
- **Hiện ảnh ở mọi chỗ đang hiện chữ cái đầu của bệnh nhân**:
  - danh sách và kết quả tìm;
  - gợi ý trùng tên;
  - trang chi tiết;
  - thùng rác.

  Ảnh chỉ tải khi dòng hiện ra trên màn hình (lazy), và được trình duyệt nhớ khoảng một ngày. Ảnh hỏng hoặc chưa tải xong thì hiện chữ cái đầu.

- **Riêng tư**:
  - ảnh nằm ở bucket private `avatars`, đường dẫn `<accountId>/<chuỗi ngẫu nhiên>.webp`;
  - trình duyệt chỉ nhận URL ký có hạn, do server tạo sau khi kiểm bệnh nhân thuộc về bác sĩ đang đăng nhập;
  - bác sĩ khác, người chưa đăng nhập và Admin không xem được ảnh.
- **Xoá theo bệnh nhân**: xoá vĩnh viễn (từ thùng rác hay bởi cron sau 30 ngày) cũng xoá ảnh trong kho.
- **Sao lưu và nhập (định dạng file phiên bản 2)**:
  - file `.zip` có thêm thư mục `images/<id bệnh nhân>.webp`, và `manifest.json` ghi thêm số ảnh;
  - **xuất**: trình duyệt tải từng ảnh trực tiếp từ kho và đóng vào file, kèm tiến độ "Đang tải ảnh 5/12…";
  - **nhập**: trình duyệt tải ảnh lên kho trước ("Đang tải ảnh lên 5/12…"), rồi mới thay dữ liệu, tất cả hoặc không. Ảnh của dữ liệu cũ bị xoá sau khi nhập xong;
  - file phiên bản 1 (không có ảnh) vẫn nhập được;
  - giới hạn file `.zip` khi nhập tăng từ 4 MB lên **50 MB**. Phần dữ liệu chữ gửi lên server vẫn tối đa 4 MB sau nén.
- **Kiểm thử**: E2E chạy kèm một server nhỏ **giả lập Supabase Storage** (chỉ các API app dùng). Không thêm dịch vụ ngoài nào.

## Capabilities

### New Capabilities

- `patient-avatars`: ảnh đại diện bệnh nhân. Gồm đặt ảnh (chụp hoặc chọn, tự nén), xem, xoá, hiện ảnh trong danh sách và trang chi tiết, riêng tư và quyền truy cập, và xoá ảnh khi xoá bệnh nhân.

### Modified Capabilities

- `data-backup`:
  - ADDED requirement "Ảnh trong file sao lưu": thư mục `images/`, số ảnh trong manifest, tiến độ tải ảnh.
- `data-import`:
  - MODIFIED requirement "Giới hạn dung lượng file": file `.zip` tối đa 50 MB, phần dữ liệu chữ vẫn tối đa 4 MB;
  - ADDED requirement "Nhập ảnh đại diện": tải ảnh lên trước, gắn ảnh vào bệnh nhân mới, xoá ảnh của dữ liệu cũ, và nhập được file không có ảnh.

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, sáng/tối, điện thoại/máy tính. Gồm:
  - trang chi tiết có ảnh và chưa có ảnh, bảng chọn, đang lưu, lỗi mất mạng, xem ảnh, xác nhận xoá;
  - danh sách có ảnh lẫn chữ cái đầu;
  - sao lưu: tiến độ tải ảnh, và tóm tắt file có số ảnh;
  - nhập: bước "Tải ảnh lên".

  Người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.

- **Module `patients`**:
  - mới: `avatar-image.ts` (cắt, thu nhỏ, nén trên trình duyệt);
  - `server/queries.ts`: `getAvatarPath`; danh sách trả thêm `avatarUrl`;
  - `server/mutations.ts`: `setAvatar`, `clearAvatar`. `deletePermanently` và `purgeExpiredTrash` trả đường dẫn ảnh để xoá;
  - `server/actions.ts`: `prepareAvatarUploadAction`, `setAvatarAction`, `removeAvatarAction`;
  - `components/`: `patient-avatar.tsx` (bảng chọn, đang lưu, xem, xoá).
- **Route**: `src/app/api/patients/[id]/avatar/route.ts` (GET, kiểm chủ sở hữu rồi chuyển hướng tới URL ký 24 giờ).
- **Tầng dùng chung**:
  - `InitialsAvatar` và `PersonRow` nhận ảnh (lazy, quay về chữ cái đầu khi lỗi);
  - `src/server/storage/objects.ts`: thêm `createSignedReadUrls` (nhiều ảnh một lần) và `newAvatarObjectName`.
- **Module `backup`**:
  - định dạng v2 kèm hàm nâng cấp v1 → v2;
  - `GET /api/backup` trả thêm URL ký của ảnh, nằm ngoài nội dung file;
  - action mới `prepareImportUploadsAction` và `discardImportUploadsAction`;
  - `replaceAllData` gắn ảnh vào bệnh nhân mới và xoá ảnh cũ.
- **Cron**: `purgeExpiredTrash` xoá ảnh của bệnh nhân bị xoá hẳn.
- **Cấu hình**: CSP `connect-src` và `img-src` lấy origin từ `SUPABASE_URL` (mặc định vẫn `https://*.supabase.co`).
- **Database**: dùng cột `patients.avatar_path` có sẵn. **Không đổi schema, không migration.**
- **Sao lưu**: `formatVersion` lên 2. App đọc được file bản 1. App bản cũ gặp file bản 2 thì báo "Vui lòng cập nhật app", đúng requirement đã có.
- **Thư viện**: không thêm. Bỏ `browser-image-compression` (teckstack §4.11), vì `createImageBitmap` và canvas có sẵn đã làm được việc cắt, thu nhỏ và nén, chỉ khoảng 40 dòng code.
- **Dịch vụ**: dùng Supabase Storage đã chốt (teckstack). Khi triển khai cần tạo bucket **private** `avatars`. Bucket `imports` không cần nữa.
- **Kiểm thử**: thêm `tests/e2e/fake-storage.mjs` vào `webServer` của Playwright.
- **Bất biến**:
  - DAL lọc theo `auth.account.id`; đường dẫn ảnh luôn bắt đầu bằng account id của session (`accountObjectPath`), và server kiểm lại đường dẫn trình duyệt gửi lên;
  - ảnh không đi qua Vercel Function: tải lên và tải xuống đều đi thẳng tới Storage bằng URL ký;
  - không log đường dẫn ảnh hay tên bệnh nhân.

## Ngoài phạm vi

- **Ảnh khi thêm bệnh nhân mới**: không có ở form thêm, để thêm bệnh nhân vẫn chỉ cần họ tên (N2). Thêm ảnh sau ở trang chi tiết.
- **Cắt hay xoay ảnh bằng tay**: chưa làm. App luôn cắt hình vuông ở giữa và dùng hướng ảnh của máy (EXIF).
- **Đính kèm ảnh vào ghi chú**: Could (§11), để sau.
- **Ảnh của tài khoản bác sĩ**: không có.
- **Xoá ảnh khi Admin xoá tài khoản**: Admin chưa có tính năng xoá tài khoản (D21, Should). Change làm tính năng đó sẽ xoá cả thư mục `<accountId>/` trong kho.
