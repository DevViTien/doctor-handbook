# Proposal

## Why

Server miễn phí có thể mất dữ liệu (D8). Bác sĩ chỉ chịu được rủi ro đó khi tự giữ được một bản sao trên máy và nhập lại được bất cứ lúc nào (N5, G3). Hiện bác sĩ đã ghi được bệnh nhân, ghi chú, tìm và xoá, nhưng chưa có cách nào lấy dữ liệu ra. Trang Cài đặt vẫn còn dòng "Sao lưu dữ liệu, nhập dữ liệu: đang được xây dựng". Đây là ba mục Must của nhóm Sao lưu ở idea.md §11.

Change đầu tiên của module **`backup`** (`src/modules/backup`). Đáp ứng idea.md:

- D8, N5, G3: sao lưu ra một file trên máy và nhập lại từ file đó.
- D18: file không có mật khẩu. Mỗi lần sao lưu đều có lời nhắc giữ file cẩn thận (§8.4).
- D20: nhập là **thay thế toàn bộ**. App tự tải về một file sao lưu dữ liệu hiện tại trước khi thay. Nhập kiểu tất cả hoặc không.
- §10.5: nội dung và tên file, thông tin kèm theo, ngày sao lưu gần nhất, thanh nhắc trên màn hình chính, các bước và ngoại lệ khi nhập.
- §8.1: nhắc sao lưu là bắt buộc, không phải tuỳ chọn.
- P3-1: sao lưu gồm cả bệnh nhân trong thùng rác.
- S3, S7: chỉ dữ liệu của bác sĩ đang đăng nhập; thông báo và URL không chứa dữ liệu bệnh nhân.

## What Changes

- **Trang "Sao lưu dữ liệu"** ở `/settings/backup`. Trong Cài đặt, dòng "đang được xây dựng" được thay bằng dòng **"Sao lưu và nhập dữ liệu"**, luôn kèm "Lần sao lưu gần nhất: 3 ngày trước", "hôm nay", "hôm qua" hoặc "Chưa sao lưu lần nào".
- **Tải file sao lưu**: nút "Tải file sao lưu" tạo **một file** `doctor-handbook_<tên-đăng-nhập>_<yyyy-mm-dd>.zip` và lưu về máy.
  - File có toàn bộ bệnh nhân (kể cả trong thùng rác), ghi chú và việc cần làm của bác sĩ.
  - Kèm phiên bản định dạng, ngày giờ sao lưu, phiên bản app, tên đăng nhập và số lượng từng loại.
  - Không có ảnh, vì chưa có tính năng ảnh đại diện.
  - Sau khi tải, app ghi lại ngày sao lưu gần nhất và nhắc: "File chứa thông tin bệnh nhân. Giữ file cẩn thận, không gửi cho người khác."
- **Thanh nhắc sao lưu** trên màn hình chính (`/patients`):
  - hiện khi đã **quá 7 ngày** chưa sao lưu (chưa sao lưu lần nào thì tính từ ngày tạo tài khoản) **và** dữ liệu có thay đổi kể từ lần sao lưu trước;
  - nút **"Sao lưu ngay"** tải file ngay tại chỗ;
  - nút **"Để mai"** ẩn thanh nhắc 1 ngày trên máy đó.
- **Nhập dữ liệu** trên cùng trang:
  1. bác sĩ chọn file `.zip`;
  2. app kiểm tra file và hiện tóm tắt: "File sao lưu ngày 10/11/2026: 132 bệnh nhân, 845 ghi chú, 20 việc";
  3. nếu tài khoản đang có dữ liệu, app cảnh báo bằng `ConfirmDialog` rằng toàn bộ dữ liệu hiện tại sẽ bị thay, rồi **tự tải về một file sao lưu dữ liệu hiện tại** trước khi thay;
  4. app thay toàn bộ trong một lần, tất cả hoặc không;
  5. app báo kết quả.
- **Ngoại lệ khi nhập**, mọi trường hợp đều không đổi dữ liệu:
  - file hỏng hoặc không phải file sao lưu: báo lỗi;
  - file của phiên bản app mới hơn: báo "Vui lòng cập nhật app";
  - file quá lớn: báo lỗi kèm dung lượng tối đa (4 MB);
  - mất mạng: báo lỗi, có nút "Thử lại";
  - file của tài khoản khác: vẫn cho nhập, chỉ cảnh báo.
- **Định dạng có phiên bản**: file ghi `formatVersion` (bắt đầu từ 1). App MUST đọc được mọi phiên bản cũ hơn. Dữ liệu nhập vào được kiểm tra lại đầy đủ ở server, không tin file.
- **Tách theo bác sĩ**: sao lưu chỉ chứa dữ liệu của bác sĩ đang đăng nhập; nhập chỉ thay dữ liệu của chính bác sĩ đó. Chưa đăng nhập và Admin bị từ chối.

## Capabilities

### New Capabilities

- `data-backup`: sao lưu ra file. Gồm trang sao lưu, dòng trong Cài đặt kèm ngày sao lưu gần nhất, nội dung và tên file, lời nhắc giữ file, thanh nhắc trên màn hình chính, và quyền truy cập.
- `data-import`: nhập lại từ file sao lưu, thay thế toàn bộ. Gồm kiểm tra file và phiên bản, tóm tắt, xác nhận, tự sao lưu trước khi thay, nhập tất cả hoặc không, các ngoại lệ, và quyền truy cập.

### Modified Capabilities

(Không có.) Nhập dữ liệu ghi bệnh nhân, ghi chú, việc theo đúng quy tắc của `patient-records`, `patient-notes` và `patient-search`, gồm giới hạn trường và chữ để tìm, nên không đổi requirement nào của các spec đó.

## Impact

- **Thiết kế**: mockup local `mockup/index.html`, gồm:
  - Cài đặt có dòng sao lưu;
  - trang sao lưu: bình thường, chưa sao lưu lần nào, đang tạo file, vừa tải xong, lỗi;
  - nhập dữ liệu: tóm tắt, cảnh báo tài khoản khác, hộp thoại thay thế, đang nhập, xong, và các lỗi;
  - thanh nhắc trên màn hình chính.

  Có sáng/tối, điện thoại/máy tính. Người dùng duyệt trước khi code. Dùng bảng màu A, không thêm token.

- **Module `backup`**:
  - mới: `constants.ts`, `schemas.ts`, `types.ts`, `format.ts`, `archive.ts`, `reminder.ts`, `backup-client.ts`;
  - `server/queries.ts`: `getBackupStatus`, `getBackupSnapshot`;
  - `server/mutations.ts`: `recordBackup`, `replaceAllData`;
  - `server/actions.ts`: `recordBackupAction`;
  - `components/`: `backup-panel.tsx`, `import-panel.tsx`, `backup-reminder.tsx`.
- **Route**:
  - `src/app/api/backup/route.ts` (mới): `GET` trả dữ liệu để tạo file, `PUT` thay toàn bộ;
  - `src/app/(doctor)/settings/backup/page.tsx` (mới);
  - `src/app/(doctor)/settings/page.tsx`: dòng "Sao lưu và nhập dữ liệu", bỏ dòng "đang được xây dựng";
  - `src/app/(doctor)/patients/page.tsx`: thanh nhắc;
  - `src/config/routes.ts`: thêm `doctor.backup`.
- **Cấu hình**: `next.config.ts` đưa phiên bản app (`package.json`) vào `NEXT_PUBLIC_APP_VERSION` để ghi vào file.
- **Database**: dùng cột `accounts.last_backup_at` có sẵn. **Không đổi schema, không migration.** File sao lưu không đổi gì ngoài chính nó.
- **Thư viện**: thêm `fflate@0.8.3` (đã chọn ở teckstack.md §4.10 và §4.11) để đóng gói, giải nén `.zip` và nén dữ liệu trên trình duyệt. Server nén bằng `node:zlib` có sẵn. Không thêm dịch vụ ngoài.
- **Bất biến** "File lớn (ảnh, file sao lưu) đi thẳng giữa trình duyệt và Storage, không qua Vercel Function": giữ đúng.
  - File `.zip` được đóng gói và mở **trên trình duyệt**, không bao giờ gửi lên.
  - Chỉ phần dữ liệu chữ (data.json) đi qua function, đúng như teckstack §4.10 đã chốt, và được nén gzip, tối đa 4 MB mỗi chiều. Với 300 bệnh nhân và 3.000 ghi chú, phần này chỉ khoảng vài trăm KB sau nén.
  - Khi có ảnh, change ảnh đại diện sẽ đưa ảnh đi thẳng qua Storage.
- **Bất biến khác**:
  - DAL lọc theo `auth.account.id`; account id không bao giờ lấy từ client hay từ file.
  - Action dựng bằng `createAction`. Route handler cùng nguồn gốc, chỉ cho bác sĩ.
  - Không log dữ liệu bệnh nhân. Thông báo nổi chỉ có tên file, tên file chỉ có tên đăng nhập và ngày.
  - Chỉ thay thế dữ liệu khi nhập mới hỏi xác nhận (N2).

## Ngoài phạm vi

- **Nhập kiểu gộp**: Phase 2 (D20, §11 Could).
- **Ảnh đại diện trong file** (`images/<patientId>.webp`): change ảnh đại diện thêm, kèm `formatVersion` mới và hàm nâng cấp.
- **Nháp ghi chú trên máy**: không nằm trong file sao lưu, vì chỉ sống trên một máy cho tới khi server nhận (README `backup`). Sau khi nhập, nháp của bệnh nhân cũ bị server từ chối như nháp của bệnh nhân đã xoá.
- **Nhận biết thay đổi chỉ gồm xoá hẳn**: thanh nhắc dựa vào thời điểm thêm, sửa, chuyển vào thùng rác. Một lần xoá vĩnh viễn hay xoá ghi chú mà không có thay đổi nào khác thì không làm thanh nhắc hiện. Lần thêm hay sửa kế tiếp sẽ làm nó hiện.
- **Chia sẻ file qua bảng chia sẻ của điện thoại** (Web Share API), hay lưu thẳng lên Google Drive: chưa làm. File được tải về như mọi file tải xuống. iPhone lưu vào ứng dụng Tệp.
- **Sao lưu tự động phía server**: Won't (§11).
