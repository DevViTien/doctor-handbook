# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **`accounts.last_backup_at`** (timestamptz, null) có từ migration đầu, chưa ai ghi. `accounts.created_at` có sẵn.
- **Bảng dữ liệu của bác sĩ**:
  - `patients`: có `deleted_at` cho thùng rác, `avatar_path` luôn null vì chưa có ảnh;
  - `notes`: id do trình duyệt tạo, khoá ngoại `(patient_id, account_id)` có `ON DELETE CASCADE`;
  - `todos`: bảng có sẵn nhưng module `todos` chưa có tính năng, nên luôn rỗng.

  Mọi bảng có `created_at`, `updated_at`. `search_text` do app tính bằng `buildSearchText` (`src/lib/text/normalize-vi.ts`).

- **Quy tắc trường**: `PATIENT_LIMITS`, `NOTE_LIMITS`, `PHONE_PATTERN` (module `patients`, `constants.ts`, được import chéo). Ngày sinh đầy đủ luôn kèm năm sinh đúng năm đó (`parseBirthInput`). Thùng rác: `trashIsLive()` (30 ngày).
- **Mẫu Route Handler** `POST /api/patients/search`: `requireAccess("doctor")`, kiểm cùng nguồn gốc, `toErrorResponse`, `Cache-Control: no-store`.
- **Cài đặt** có dòng "Thùng rác" và dòng tạm "Sao lưu dữ liệu, nhập dữ liệu: đang được xây dựng". `DOCTOR_TOASTER_ID` cho thông báo nổi của khu bác sĩ. Có `ConfirmDialog`.
- **Giới hạn**: Vercel Function nhận và trả tối đa khoảng 4,5 MB mỗi request.

## Goals / Non-Goals

**Goals:**

- File sao lưu đọc được bằng mắt (JSON trong `.zip`), tự mô tả (`manifest.json`), và nhập lại được mãi về sau (có phiên bản và hàm nâng cấp).
- Nhập không bao giờ để tài khoản ở trạng thái nửa cũ nửa mới, và không bao giờ đụng tài khoản khác.
- Nội dung file và yêu cầu nhập đều qua cùng một bộ kiểm tra Zod ở trình duyệt và ở server.

**Non-Goals:** nhập gộp, ảnh, chia sẻ qua Web Share API (xem proposal, "Ngoài phạm vi").

## Decisions

### 1. Cấu trúc

```
src/modules/backup/
├── constants.ts        BACKUP_FORMAT_VERSION (1), BACKUP_APP_ID, BACKUP_LIMITS,
│                       BACKUP_REMINDER_DAYS (7), BACKUP_MESSAGES
├── schemas.ts          backupManifestSchema, backupDataSchema (v1), backupFileSchema
│                       (kiểm chéo: id không trùng, ghi chú thuộc bệnh nhân trong file, số đếm khớp)
├── types.ts            BackupFile, BackupStatus (DTO cho trang và thanh nhắc)
├── format.ts           upgradeBackup(manifest, data): đọc mọi formatVersion ≤ hiện tại;
│                       backupFileName(username, exportedAt, suffix?)
├── archive.ts          (client) packBackup(file) → .zip; unpackBackup(bytes) → BackupFile | lỗi;
│                       gzipJson / gunzipJson (fflate)
├── reminder.ts         shouldRemind(status, now), describeLastBackup(lastBackupAt, now)
├── backup-client.ts    (client) downloadBackup({ suffix }), sendImport(file)
├── server/queries.ts   getBackupStatus(auth), getBackupSnapshot(auth)
├── server/mutations.ts recordBackup(auth), replaceAllData(auth, file)
├── server/actions.ts   recordBackupAction (createAction, access "doctor")
└── components/
    ├── backup-panel.tsx      thẻ "Sao lưu" trên /settings/backup
    ├── import-panel.tsx      thẻ "Nhập dữ liệu": chọn file → tóm tắt → xác nhận → nhập
    └── backup-reminder.tsx   thanh nhắc trên /patients

src/app/api/backup/route.ts                 GET (dữ liệu để tạo file), PUT (thay toàn bộ)
src/app/(doctor)/settings/backup/page.tsx   trang Sao lưu dữ liệu
src/app/(doctor)/settings/page.tsx          dòng "Sao lưu và nhập dữ liệu"
src/app/(doctor)/patients/page.tsx          thanh nhắc
src/config/routes.ts                        + doctor.backup
next.config.ts                              + env NEXT_PUBLIC_APP_VERSION (từ package.json)
```

Chiều phụ thuộc:

- `app → modules/backup → shared`.
- `backup` import `patients/constants` (giới hạn trường, `TRASH_RETENTION_DAYS`), đúng quy tắc 4 của `src/modules/README.md`.
- `backup` dùng `trashIsLive()` để chỉ lấy bệnh nhân thùng rác còn hạn. Hàm này nằm ở `patients/server/trash-sql.ts`, không thuộc phần được import chéo, nên chuyển nó xuống `src/server/db/trash-sql.ts` (tầng dùng chung). Tầng `server` không được import module, nên hằng `TRASH_RETENTION_DAYS` cũng chuyển xuống `src/config/retention.ts`; `patients/constants.ts` export lại. Hành vi giữ nguyên.
- Kiểm cùng nguồn gốc của route tìm kiếm được tách thành `src/server/http/same-origin.ts` (`assertSameOrigin`, thêm `assertNotCrossSite` cho GET) để hai route dùng chung.
- DAL của `backup` đọc, ghi thẳng ba bảng `patients`, `notes`, `todos`. Sao lưu tự bản chất là cắt ngang mọi bảng của bác sĩ, và mutation của `patients` không được import chéo. Mọi truy vấn vẫn lọc theo `auth.account.id`.

### 2. Định dạng file (formatVersion 1)

```
doctor-handbook_bs.lan_2026-11-19.zip
├── manifest.json
└── data.json
```

```jsonc
// manifest.json
{
  "app": "doctor-handbook",
  "formatVersion": 1,
  "appVersion": "0.1.0",
  "exportedAt": "2026-11-19T08:30:00.000Z",
  "account": { "username": "bs.lan" },
  "counts": { "patients": 132, "notes": 845, "todos": 20 }
}
// data.json — camelCase, thời điểm ISO 8601 UTC, ngày lịch "yyyy-mm-dd"
{
  "patients": [{ "id", "fullName", "birthYear", "birthDate", "gender", "hometown", "phone",
                 "patientCode", "summary", "createdAt", "updatedAt", "deletedAt" }],
  "notes":    [{ "id", "patientId", "content", "createdAt", "updatedAt" }],
  "todos":    [{ "id", "content", "dueDate", "completedAt", "createdAt", "updatedAt" }]
}
```

Không có trong file: `accountId`, `searchText`, `avatarPath`, mật khẩu, phiên.

**Bộ kiểm tra `backupFileSchema`** dùng chung ở trình duyệt (`archive.ts`) và ở server (route `PUT`):

- **Bệnh nhân**:
  - `fullName` NFC, trim, khác rỗng, tối đa `PATIENT_LIMITS.fullName`;
  - các trường chữ khác null hoặc trong giới hạn; `phone` khớp `PHONE_PATTERN`;
  - `birthYear` trong [1900, năm nay]; `birthDate` là ngày có thật, và năm của nó bằng `birthYear`;
  - `gender` thuộc enum.
- **Ghi chú**: `content` khác rỗng, tối đa `NOTE_LIMITS.content`.
- **Việc**: `content` khác rỗng, tối đa `BACKUP_LIMITS.todoContent` (1000). Module `todos` sau này sẽ chốt giới hạn thật và chuyển hằng số về đó.
- **Kiểm chéo**:
  - id là UUID và không trùng trong từng loại;
  - mỗi `note.patientId` có trong `patients`;
  - `manifest.counts` khớp số dòng thật.
- **Trần số dòng**: 20.000 bệnh nhân, 200.000 ghi chú, 20.000 việc.

**Phiên bản**: `format.ts` giữ một bảng `upgraders[v]` đưa dữ liệu bản `v` lên `v + 1`. Hiện chỉ có bản 1, nên bảng rỗng.

- `formatVersion` lớn hơn `BACKUP_FORMAT_VERSION` thì báo "Vui lòng cập nhật app".
- Thiếu `app: "doctor-handbook"` hay sai cấu trúc thì báo file hỏng.
- Server chỉ nhận bản hiện tại: trình duyệt nâng cấp file cũ trước khi gửi, server vẫn kiểm lại toàn bộ.

**Tên file**: `backupFileName(username, exportedAt, suffix?)`, ngày theo giờ Việt Nam. Bản tự sao lưu trước khi nhập có đuôi `_truoc-khi-nhap`, để bác sĩ phân biệt trong thư mục Tải xuống.

### 3. Xuất: `GET /api/backup` → `.zip` trên trình duyệt

**Phương án đã cân nhắc:**

- **Server tạo luôn file `.zip`**: đơn giản hơn bây giờ. Nhưng khi có ảnh, function phải tải ảnh từ Storage về, và dính giới hạn 4,5 MB. teckstack §4.10 đã chốt đóng gói trên trình duyệt.
- **Trả JSON thường**: dễ vượt 4,5 MB với sổ tay lớn, vì một ghi chú có thể dài 5.000 ký tự. Vercel tự nén câu trả lời, nhưng giới hạn tính trên phần function trả ra, trước khi nén.
- **Chia trang**: cần nhiều request, và bệnh nhân bị xoá giữa hai trang sẽ để lại ghi chú mồ côi.

**Đã chọn:** route trả **JSON đã nén gzip** (`Content-Type: application/gzip`, nén bằng `node:zlib`). Dữ liệu chữ nén được khoảng 5–10 lần, nên 4 MB nén đủ cho hàng chục MB chữ. Nếu bản nén vẫn vượt 4 MB thì route trả `VALIDATION_FAILED` kèm thông báo "Dữ liệu quá lớn để sao lưu bằng một file.". Trường hợp này được log số dòng, không có nội dung.

Các bước ở trình duyệt (`downloadBackup`):

1. `fetch("/api/backup")` với `cache: "no-store"`. Server chỉ cho bác sĩ. Header `Sec-Fetch-Site`, nếu có, phải là `same-origin` (hoặc `none`: bác sĩ tự mở địa chỉ). GET không có body, nên không cần kiểm `Origin`; trang khác không đọc được câu trả lời vì không có CORS.
2. Server (`getBackupSnapshot`) đọc trong **một transaction `REPEATABLE READ`**, nên bệnh nhân và ghi chú khớp nhau:
   - bệnh nhân `deleted_at IS NULL OR trashIsLive()`;
   - ghi chú của những bệnh nhân đó;
   - mọi việc;
   - `now()` làm `exportedAt`.

   Server dựng `{ manifest, data }`, với `appVersion` lấy từ `NEXT_PUBLIC_APP_VERSION`.

3. Trình duyệt `gunzip` rồi kiểm bằng `backupFileSchema`. Dữ liệu không qua được thì không tạo file, coi như lỗi máy chủ: không bao giờ đưa cho bác sĩ một file sau này không nhập được.
4. `zipSync` hai file `manifest.json`, `data.json` (deflate). Tạo Blob, gắn vào `<a download>` để tải, rồi thu hồi URL sau 1 phút.
5. Gọi `recordBackupAction()`. Server ghi `last_backup_at = now()`. Action không nhận tham số: thời điểm do server quyết định, không tin client. Ghi chậm hơn GET một hai giây; thay đổi lọt vào khoảng đó thì lần nhắc sau mới tính. Chấp nhận được.
6. Trả `{ fileName }` để giao diện báo "Đã tải file …".

Lỗi mạng ở bước 1 hoặc 5 sẽ ném `TypeError`. Giao diện báo "Không tạo được file vì mất mạng…". Nếu bước 4 đã tải xong mà bước 5 lỗi, app vẫn báo đã tải, vì file nằm trên máy rồi, nhưng ngày sao lưu chưa đổi. Lần sao lưu sau sẽ ghi.

### 4. Nhập: giải nén trên trình duyệt → `PUT /api/backup`

**Phương án đã cân nhắc:**

- **Server Action**: giới hạn body mặc định 1 MB. Muốn nới phải sửa cấu hình cho mọi action. Server Action cũng chạy tuần tự theo tab, và không huỷ được.
- **Bảng tạm và gửi nhiều lần** (teckstack §4.10 nêu khi vượt giới hạn): cần schema mới, dọn rác, và nhiều request.
- **Gửi `.zip` lên server**: function phải giải nén, và trái bất biến "file sao lưu không qua function".

**Đã chọn:** Route Handler `PUT /api/backup`, body là **JSON `{ manifest, data }` nén gzip** do trình duyệt dựng lại sau khi kiểm và nâng cấp.

Các bước ở trình duyệt (`import-panel.tsx`):

1. **Chọn file**. File lớn hơn 4 MB (`BACKUP_LIMITS.fileBytes`) bị từ chối ngay.
2. **Đọc file** bằng `unpackBackup`:
   - đọc đúng hai mục `manifest.json`, `data.json`;
   - kích thước giải nén vượt 64 MB thì từ chối, chống file nén bất thường;
   - `JSON.parse`, kiểm manifest, nâng cấp, rồi kiểm `backupFileSchema`.
3. **Tóm tắt**: ngày của file theo giờ Việt Nam và các số đếm. Tên đăng nhập trong file khác tài khoản hiện tại thì thêm cảnh báo.
4. **Xác nhận**. Trang biết số dòng hiện có (`getBackupStatus`, server render). Có dữ liệu thì mở `ConfirmDialog`; không có thì nhập luôn.
5. **Tự sao lưu**, chỉ khi có dữ liệu: `downloadBackup({ suffix: "_truoc-khi-nhap" })`. Lỗi thì dừng, không nhập.
6. **Gửi**: `PUT /api/backup` với `Content-Type: application/gzip` và `AbortController` (60 giây).
7. **Thành công**: báo "Đã nhập …", gọi `router.refresh()`, và có liên kết "Xem danh sách bệnh nhân".
8. **Lỗi mạng**: báo kèm "Thử lại". Thử lại chỉ làm lại bước 6, vì bản tự sao lưu đã nằm trên máy.

Các bước ở server (route `PUT`, rồi `replaceAllData`):

1. **Kiểm yêu cầu**:
   - cùng nguồn gốc (`Origin` khớp host, như route tìm kiếm);
   - `requireAccess("doctor")`;
   - `Content-Type: application/gzip`;
   - đọc body tối đa 4 MB, vượt thì `VALIDATION_FAILED` "File quá lớn…";
   - `gunzipSync(..., { maxOutputLength: 64 MB })`;
   - `JSON.parse`, rồi `backupFileSchema` với `formatVersion` đúng bản hiện tại.

   Sai bất kỳ bước nào thì `VALIDATION_FAILED` với thông báo file hỏng, không đổi gì.

2. **Một transaction**:
   - `DELETE FROM todos` và `DELETE FROM patients` của `auth.account.id`. Ghi chú đi theo nhờ `CASCADE`.
   - `INSERT` bệnh nhân, ghi chú, việc theo lô 500 dòng, với **id mới** (`crypto.randomUUID()`, ánh xạ id cũ sang id mới ở server). `note.patientId` được ánh xạ sang id mới, `account_id` lấy từ session, `search_text` tính lại bằng `buildSearchText`.
   - Giữ nguyên `created_at`, `updated_at`, `deleted_at` của file.
   - `UPDATE accounts SET last_backup_at = GREATEST(last_backup_at, LEAST(exportedAt, now()))`. `GREATEST` bỏ qua null.

   Lỗi bất kỳ thì rollback toàn bộ.

3. **Trả kết quả**: `{ patients, notes, todos }` là số dòng đã ghi. Log chỉ có số dòng.

**Vì sao đổi id**: file của tài khoản khác (bác sĩ đổi tài khoản) hay của chính tài khoản này trên cùng server sẽ có id trùng với dòng còn sống của tài khoản kia. Giữ id thì nhập bị lỗi khoá chính. Tệ hơn, lỗi đó cho biết id ấy đang tồn tại ở tài khoản khác. Đổi id thì luôn nhập được và không lộ gì. Mất mát duy nhất là URL cũ của bệnh nhân không còn dùng được; không ai đánh dấu URL này. Nháp ghi chú cũ trên máy bị server từ chối (`NOT_FOUND`) như nháp của bệnh nhân đã xoá.

**Thời gian chạy**: 300 bệnh nhân và 3.000 ghi chú là 7 lệnh `INSERT` theo lô, dưới một giây. Route khai `maxDuration = 60`.

### 5. Ngày sao lưu và thanh nhắc

`getBackupStatus(auth)` chạy một truy vấn, trả `BackupStatus`:

```ts
{
  lastBackupAt: string | null; // accounts.last_backup_at
  accountCreatedAt: string;
  lastChangeAt: string | null; // GREATEST của MAX(updated_at, deleted_at) trên patients,
  // MAX(updated_at) trên notes, MAX(updated_at, completed_at) trên todos
  counts: {
    patients;
    notes;
    todos;
  } // patients gồm cả thùng rác còn hạn
}
```

`shouldRemind(status, now)` là hàm thuần, có unit test:

```
có dữ liệu
∧ now − (lastBackupAt ?? accountCreatedAt) > 7 ngày
∧ (lastBackupAt = null ∨ lastChangeAt > lastBackupAt)
```

`describeLastBackup` trả chữ theo **ngày lịch Việt Nam**: "hôm nay", "hôm qua", "N ngày trước", hoặc "Chưa sao lưu lần nào". "Đã N ngày chưa sao lưu dữ liệu." dùng cùng cách đếm.

Chuyển vào thùng rác không đổi `updated_at` nhưng có đặt `deleted_at`, nên vẫn tính là thay đổi. Xoá hẳn không để lại dấu vết (xem proposal, "Ngoài phạm vi").

**Ẩn trong 1 ngày** ("Để mai"):

- **Chỗ lưu**: `localStorage` khoá `doctor-handbook:backup-reminder:<accountId>`, giá trị là thời điểm bấm, kiểm bằng Zod. Đây là tiện ích theo từng máy, không cần server; lỗi đọc thì coi như chưa ẩn.
- **Cách hiện**: page (server) tính `remind` và số ngày, rồi truyền xuống `BackupReminder` (client). Component chỉ hiện sau khi đọc xong `localStorage`, nên không bị nháy khi bác sĩ đã bấm "Để mai".
- **Khi bấm "Sao lưu ngay"**: tải xong thì ẩn thanh nhắc ngay ở client, rồi gọi `router.refresh()`.

### 6. Lỗi

| Tình huống                                   | Ở đâu       | Mã / thông báo                                                                               |
| -------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| Chưa đăng nhập / Admin (GET, PUT, action)    | server      | `UNAUTHENTICATED` 401 / `FORBIDDEN` 403                                                      |
| PUT khác nguồn gốc, sai `Content-Type`       | server      | `FORBIDDEN` / `VALIDATION_FAILED`                                                            |
| File hỏng, sai cấu trúc, dữ liệu sai quy tắc | trình duyệt | "File này không phải file sao lưu của Doctor Handbook, hoặc đã bị hỏng."                     |
| Như trên nhưng trình duyệt bị sửa            | server      | `VALIDATION_FAILED`, cùng thông báo, không đổi gì                                            |
| Phiên bản mới hơn                            | trình duyệt | "File được tạo từ phiên bản app mới hơn. Vui lòng cập nhật app (tải lại trang) rồi thử lại." |
| File > 4 MB                                  | cả hai      | "File quá lớn. Dung lượng tối đa 4 MB."                                                      |
| Mất mạng khi xuất                            | trình duyệt | "Không tạo được file vì mất mạng. Thử lại khi có mạng."                                      |
| Mất mạng khi nhập                            | trình duyệt | "Không nhập được vì mất mạng. Dữ liệu chưa thay đổi." + "Thử lại"                            |
| Tự sao lưu trước khi nhập lỗi                | trình duyệt | "Chưa sao lưu được dữ liệu hiện tại nên chưa nhập. Thử lại khi có mạng."                     |
| Lỗi DB khi nhập                              | server      | `INTERNAL` (rollback), "Đã có lỗi xảy ra. Dữ liệu chưa thay đổi."                            |

Mất mạng khi nhập có thể xảy ra **sau** khi server đã ghi xong. Khi đó "Thử lại" thay toàn bộ thêm một lần bằng cùng file, kết quả vẫn y như vậy. Thông báo "chưa thay đổi" vì thế không bao giờ làm bác sĩ mất dữ liệu.

### 7. Giao diện (theo mockup)

Mockup: `openspec/changes/add-data-backup/mockup/index.html`, file local, mở trực tiếp bằng trình duyệt.

**Hướng hình ảnh**: bảng màu A, không thêm token. Điểm nhấn duy nhất là **thẻ tóm tắt file** khi nhập: ngày của file in đậm, các số đếm dạng chữ số đều. Đó là lúc bác sĩ phải chắc mình chọn đúng file. Còn lại giữ yên:

- thanh nhắc dùng tông cảnh báo (`warning` trên nền `warning-bg`), có icon và chữ, không chỉ dựa vào màu;
- nút nhập là nút đỏ (`destructive`) khi sẽ thay dữ liệu đang có.

**Bố cục điện thoại (390 px):**

- **Cài đặt**: dòng "Sao lưu và nhập dữ liệu" đặt **trên** dòng Thùng rác, vì quan trọng hơn. Chữ phụ "Lần sao lưu gần nhất: 3 ngày trước" ở dòng thứ hai. Dòng "đang được xây dựng" bị bỏ.
- **`/settings/backup`**, thanh trên có "← Cài đặt", h1 "Sao lưu dữ liệu", và một câu giới thiệu ngắn. Sau đó là hai thẻ:
  1. **"Sao lưu"**:
     - "Lần sao lưu gần nhất: 3 ngày trước (16/11/2026)";
     - "Đang có 132 bệnh nhân (3 trong thùng rác), 845 ghi chú, 0 việc";
     - nút chính "Tải file sao lưu", rộng hết thẻ, cao 48 px;
     - lời nhắc giữ file có icon khiên.
  2. **"Nhập dữ liệu"**: một câu "Thay toàn bộ dữ liệu trong sổ bằng dữ liệu của một file sao lưu." và nút viền "Chọn file sao lưu" (`<input type="file" accept=".zip,application/zip">` ẩn sau nhãn). Chọn file xong, thẻ chuyển thành tóm tắt.
- **Màn hình chính**: thanh nhắc nằm trên ô tìm. Có icon, một dòng chính, một dòng phụ "Dữ liệu trên server có thể bị mất.", rồi hai nút "Sao lưu ngay" (nút chính nhỏ, 44 px) và "Để mai" (nút chữ, 44 px).

**Máy tính (1280 px)**: cùng cột 672 px như các trang khác; hai thẻ xếp dọc.

**Trạng thái:**

- **Trang sao lưu**:
  - bình thường;
  - chưa sao lưu lần nào;
  - đang tạo file (nút "Đang tạo file…" có spinner, `aria-busy`);
  - vừa tải xong (khối `role="status"` có tên file và lời nhắc);
  - lỗi mất mạng (`role="alert"`);
  - tài khoản trống: nút vẫn dùng được, file có 0 dòng.
- **Nhập**:
  - đang đọc file;
  - tóm tắt khi tài khoản trống (nút chính "Nhập dữ liệu");
  - tóm tắt khi sẽ thay thế, kèm cảnh báo tài khoản khác (nút đỏ "Nhập dữ liệu", "Chọn file khác");
  - hộp thoại "Thay thế toàn bộ dữ liệu?";
  - đang nhập, theo hai bước có thứ tự thật: "Sao lưu dữ liệu hiện tại" → "Nhập dữ liệu từ file";
  - xong;
  - lỗi: file hỏng, phiên bản mới hơn, quá lớn, mất mạng kèm "Thử lại".
- **Thanh nhắc**: quá N ngày, chưa sao lưu lần nào, đang tạo file, đã tải (thanh biến mất, thông báo nổi không có dữ liệu bệnh nhân).
- **Đang tải trang**: `loading.tsx` của `/settings/backup` hiện khung xám hai thẻ.

**Tiếp cận**:

- mọi trạng thái đổi được báo bằng `role="status"`, lỗi bằng `role="alert"`;
- `ConfirmDialog` là `alertdialog`;
- nút chọn file là nhãn bấm được bằng bàn phím;
- spinner có nhánh `motion-reduce`.

**Trạng thái duyệt**: người dùng duyệt mockup ngày 19/11/2026, nguyên trạng, cùng sáu quyết định nêu khi trình duyệt (gộp một change, gzip qua `/api/backup`, id mới khi nhập, đuôi `_truoc-khi-nhap`, bỏ sót lần chỉ xoá hẳn, `fflate@0.8.3`).

### 8. Thư viện

| Thư viện | Phiên bản | Phát hành                                                        | Lý do                                                                                                                                                       |
| -------- | --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fflate` | 0.8.3     | 16/05/2026 (hơn 6 tháng, qua chính sách tuổi phiên bản của pnpm) | Đã chọn ở teckstack.md §4.10–4.11. Zip, unzip và gzip thuần JS, không phụ thuộc, không có script cài đặt; chỉ những hàm dùng tới vào bundle (khoảng 10 KB). |

Không cần thêm ngoại lệ `minimumReleaseAgeExclude` hay `allowBuilds`. Server dùng `node:zlib` có sẵn.

## Risks / Trade-offs

- **iPhone ở chế độ PWA tải file khác Safari thường**: có thể mở file thay vì lưu (teckstack §4.10). → Kiểm trên iPhone thật trước khi phát hành (rủi ro R8, chung với tìm bằng giọng nói); nếu cần thì thêm Web Share API ở change sau.
- **Bác sĩ đóng tab lúc đang nhập**: request có thể đã tới server. → Transaction bảo đảm tất cả hoặc không; mở lại trang là thấy trạng thái thật.
- **Hai máy cùng nhập một lúc**: transaction đầu tiên khoá dòng `accounts` của bác sĩ (`SELECT … FOR UPDATE`), nên hai lần nhập chạy nối nhau, cái sau thắng. Không khoá thì ở READ COMMITTED, lệnh `DELETE` của lần sau không thấy dòng chưa commit của lần trước, và hai file bị trộn (review).
- **Trang cũ hiện tài khoản trống** (nút Back, thiết bị khác): trình duyệt chỉ gửi header `x-replace-existing: 1` khi đã hỏi và tự sao lưu. Thiếu header mà tài khoản có dữ liệu thì server trả `CONFLICT`, không xoá gì; trang tải lại số liệu (review).
- **Bệnh nhân quá hạn thùng rác trong file cũ**: không nhập (cùng ghi chú), vì thùng rác đã không còn hiện họ.
- **Đồng hồ máy sai**: bộ kiểm tra file không có luật "không ở tương lai" (năm sinh, ngày sinh), vì trình duyệt dùng giờ của máy; form vẫn kiểm luật đó khi gõ.
- **File sao lưu bị lộ**: file không mật khẩu (D18). → Lời nhắc ở mọi lần tải; tên file không có dữ liệu bệnh nhân.
- **Nhận biết thay đổi bỏ sót lần xoá hẳn**: xem proposal. → Chấp nhận; lần sửa sau sẽ bật thanh nhắc.
- **Dữ liệu cũ không qua được bộ kiểm tra mới**: ví dụ một cột ngày sau này siết luật. → Mỗi lần siết luật phải đi kèm hàm nâng cấp hoặc nới luật cho bản cũ. Ghi vào README `backup`.

## Migration Plan

Không có migration: chỉ ghi vào cột `accounts.last_backup_at` có sẵn.

Triển khai một lần. Rollback bằng revert code; cột đó được ghi thêm cũng không ảnh hưởng bản cũ.
