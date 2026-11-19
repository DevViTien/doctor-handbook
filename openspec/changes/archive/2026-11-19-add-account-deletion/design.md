# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Khoá ngoại**: mọi bảng chứa dữ liệu của một tài khoản đều `ON DELETE CASCADE` theo `accounts.id`: `sessions`, `patients`, `notes` (cả khoá ngoại ghép `(patient_id, account_id)`), `todos`, `access_codes.account_id`. `access_codes.created_by_id` là `SET NULL`, nhưng chỉ tài khoản Admin tạo mã. Vậy một câu `DELETE FROM accounts` đã xoá hết dữ liệu trong database, không cần migration.
- **Ảnh**: bucket private `avatars`. Mọi object nằm phẳng dưới `<accountId>/<32 hex>.(webp|jpg)` (`newAvatarObjectPath`). Bucket `imports` có khai trong `STORAGE_BUCKETS` nhưng chưa code nào ghi vào. `removeObjects(bucket, paths)` đã có. Supabase `storage.from(b).list(prefix, { limit, offset })` liệt kê theo thư mục; `tests/e2e/fake-storage.mjs` đã giả lập `POST /object/list/:bucket` và `DELETE /object/:bucket`.
- **Module `admin`**:
  - `setDoctorAccountStatus` và `doctorAccountById` (chỉ khớp `role = 'doctor'`).
  - `useConfirmedRowAction`: lỗi giữ trong hộp thoại; khi đóng thì `router.refresh()`.
  - `ConfirmDialog` có sẵn `children`, ghi chú "e.g. a type the username to confirm field".
  - `AccountList` xếp nút dưới phần thông tin trên điện thoại.
- **`accounts.last_backup_at`** đã được ghi mỗi lần bác sĩ tải sao lưu (spec `data-backup`).
- **`createAction`**: `AppError` giữ nguyên `code` và `message` khi về client. Lỗi khác bị log và đổi thành `INTERNAL` chung.
- **Fixture E2E**: `bs.lan`, `bs.minh` đang hoạt động; `bs.khoa` bị khoá. Có `setAccountStatus`; fake storage có `/__fake/objects` để đọc danh sách object.

## Goals / Non-Goals

**Goals:**

- Xoá hết dữ liệu của một tài khoản, cả ảnh trong kho, bằng một thao tác có xác nhận chắc chắn.
- Lỗi giữa chừng không để lại tài khoản "nửa còn nửa mất" trong database.
- Code admin không đọc một dòng bệnh nhân, ghi chú hay việc cần làm nào (N6).

**Non-Goals:** xem proposal, mục Ngoài phạm vi.

## Decisions

### 1. Cấu trúc thư mục

```
src/server/storage/objects.ts          + removeAccountObjects(bucket, accountId): Promise<number>
src/modules/admin/
├── schemas.ts                         + deleteAccountSchema ({ id: uuid, username: string })
├── constants.ts                       + ACCOUNT_MESSAGES.{usernameMismatch, activeNoDelete, deleteFailed, deleted}
├── account-deletion.ts                + usernameMatches(typed, username), dùng chung client và server
├── server/
│   ├── queries.ts                     listDoctorAccounts + patientCount, lastBackupAt
│   ├── mutations.ts                   + deleteDoctorAccount(id, username)
│   └── actions.ts                     + deleteAccountAction (createAction, access "admin")
└── components/
    ├── account-list.tsx               thêm dòng "N bệnh nhân · Sao lưu …"; nút Xoá ở dòng đã khoá
    └── delete-account-button.tsx      "use client": nút "Xoá" + ConfirmDialog có ô gõ tên đăng nhập
```

Chiều phụ thuộc vẫn đúng: `app → modules/admin → server/{storage,db}, components/common`. Không có import ngược.

### 2. Thứ tự xoá: khoá dòng, xoá ảnh, rồi xoá tài khoản, trong một transaction

`deleteDoctorAccount(id, username)` chạy trong `db.transaction`:

1. `SELECT username, status FROM accounts WHERE id = $id AND role = 'doctor' FOR UPDATE`.
   - Không có dòng → `{ status: "not-found" }`.
   - `status <> 'locked'` → `{ status: "active" }`.
   - `!usernameMatches(input, row.username)` → `{ status: "mismatch" }`.
   - `FOR UPDATE` chặn "Mở khoá" chạy chen giữa: `setDoctorAccountStatus` phải chờ transaction này xong.
2. `removeAccountObjects("avatars", id)`: liệt kê `<id>/` theo trang 1000, xoá theo lô. Lỗi thì ném, transaction rollback, database không đổi gì.
3. `DELETE FROM accounts WHERE id = $id` (vẫn `AND role = 'doctor'`). Cascade xoá phiên, bệnh nhân, ghi chú, việc cần làm, mã.
4. Trả `{ status: "deleted", username, removedObjects }`.

Action đổi kết quả thành lỗi như sau:

| Kết quả DAL     | `AppError`          | Thông báo                                                          |
| --------------- | ------------------- | ------------------------------------------------------------------ |
| `not-found`     | `NOT_FOUND`         | "Không tìm thấy tài khoản."                                        |
| `active`        | `CONFLICT`          | "Tài khoản đang hoạt động. Khoá trước khi xoá."                    |
| `mismatch`      | `VALIDATION_FAILED` | "Tên đăng nhập không khớp."                                        |
| storage ném lỗi | `INTERNAL`          | "Chưa xoá được tài khoản. Tài khoản vẫn bị khoá, hãy thử lại sau." |

Sau khi xoá thành công, action gọi `revalidatePath(routes.admin.accounts)` và `revalidatePath(routes.admin.accessCodes)`, ghi `logger.info("Doctor account deleted", { accountId, removedObjects })` (chỉ id và số), rồi trả `{ username }`.

Các phương án đã cân nhắc:

- **Xoá database trước, ảnh sau, lỗi ảnh thì bỏ qua** (giống `removeAvatarsQuietly` khi xoá bệnh nhân). Bị loại: tài khoản đã mất, không còn cách nào để thử xoá ảnh lại, và ảnh bệnh nhân là dữ liệu nhạy cảm (S5). Với bệnh nhân lẻ, ảnh mồ côi chấp nhận được. Với cả một tài khoản thì không.
- **Xoá ảnh ngoài transaction, trước khi mở transaction.** Bị loại: có khe để "Mở khoá" chen vào. Bác sĩ vào lại app với bệnh nhân còn nguyên nhưng mất hết ảnh.
- **Đọc `patients.avatar_path` để biết ảnh nào cần xoá.** Bị loại: code admin sẽ phải đọc bảng bệnh nhân (N6). Liệt kê theo tiền tố còn dọn được cả ảnh mồ côi cũ của tài khoản đó.
- **Giữ transaction trong lúc gọi Storage qua mạng.** Chấp nhận: dòng tài khoản đã khoá không ai dùng, transaction chỉ giữ khoá của đúng một dòng, vài trăm ảnh xoá trong vài giây. Kết nối DB qua pooler 6543 ở chế độ transaction, nên giữ kết nối lâu hơn một chút không làm cạn pool của nhóm nhỏ.
- **Rollback khi ảnh đã xoá được một phần.** Chấp nhận: tài khoản vẫn khoá, Admin bấm lại thì xoá nốt. Nếu Admin mở khoá thay vì xoá, vài ảnh có thể đã mất. Hộp thoại lỗi nói rõ "Tài khoản vẫn bị khoá, hãy thử lại sau" để hướng Admin thử lại.

### 3. Bắt buộc khoá trước khi xoá

Nút "Xoá" chỉ hiện ở dòng "Đã khoá", và server từ chối tài khoản đang hoạt động (`CONFLICT`).

- **Lý do**: D21 nói "thông thường chỉ cần khoá". Hai bước tách biệt (khoá, rồi xoá có gõ tên) khó bấm nhầm hơn.
- **Lợi về kỹ thuật**: tài khoản đã khoá thì không còn phiên nào (khoá xoá phiên, `createSession` từ chối tài khoản khoá). Vì vậy không có request nào của bác sĩ ghi thêm bệnh nhân hay xin link tải ảnh mới trong lúc đang xoá.
- **Phương án cân nhắc**: một nút "Xoá" cho mọi dòng, action tự khoá trước. Bị loại vì điện thoại sẽ có ba nút một dòng, và một tài khoản đang dùng chỉ còn cách xoá đúng một hộp thoại.
- **Bố cục**: mỗi dòng vẫn chỉ có hai nút. Đang hoạt động: "Cấp mã đặt lại mật khẩu" và "Khoá". Đã khoá: "Mở khoá" và "Xoá".

### 4. Xác nhận bằng tên đăng nhập: client chặn, server quyết định

- `usernameMatches(typed, username)` = `typed.trim().toLowerCase() === username`. Tên đăng nhập luôn lưu chữ thường, có CHECK trong DB.
  - Hàm thuần, đặt ở `src/modules/admin/account-deletion.ts`, không import server.
  - Hộp thoại dùng nó để bật nút; DAL dùng lại để kiểm.
- `deleteAccountSchema`: `{ id: z.uuid(), username: z.string().max(64) }`. Chuỗi rỗng vẫn qua schema và rơi vào `mismatch`, để thông báo luôn là "Tên đăng nhập không khớp." chứ không phải lỗi chung.
- **Ô nhập**:
  - `autoComplete="off"`, `autoCapitalize="none"`, `spellCheck={false}`, `translate="no"`, chữ 16 px;
  - nhãn "Gõ tên đăng nhập để xác nhận";
  - tên đăng nhập hiện ngay trên ô để Admin chép theo. Không có nút dán sẵn, vì chép tay mới là xác nhận.
- Nhấn Enter trong ô khi đã khớp sẽ xác nhận. Khi chưa khớp thì không làm gì.

### 5. Số bệnh nhân và lần sao lưu (P3-3)

`listDoctorAccounts` thêm:

```ts
patientCount: sql<number>`(
  select count(*)::int from ${patients}
  where ${patients.accountId} = ${accounts.id} and ${patients.deletedAt} is null
)`,
lastBackupAt: accounts.lastBackupAt,
```

- Truy vấn con dùng index `patients_account_id_deleted_at_idx`. Chỉ trả về một số nguyên: đúng "chỉ được đếm" của N6.
- Hộp thoại xoá lấy số và ngày từ chính dòng đó (props), không gọi thêm action.
- Số bệnh nhân **không** tính thùng rác, khớp con số bác sĩ thấy ở danh sách của mình. Hộp thoại nói thêm là thùng rác cũng bị xoá.
- **Phương án cân nhắc**: thêm cả số ghi chú và số việc. Bị loại: idea.md P3-3 chỉ nêu số bệnh nhân và ngày sao lưu, và thêm hai truy vấn con mỗi dòng mà không giúp Admin quyết định gì hơn.

### 6. Sau khi xoá

- Hộp thoại đóng; dòng biến mất sau `revalidatePath`.
- Toast `"Đã xoá tài khoản bs.khoa."` qua `sonner`; `Toaster` đã gắn ở `AppProviders` cho mọi trang. Toast hiện ở trên giữa màn hình như mọi toast của trang Admin (mockup vẽ ở dưới; giữ một vị trí chung cho cả app).
  - Tên đăng nhập không phải dữ liệu bệnh nhân, nên toast không vi phạm S7.
  - Không có hoàn tác, nên toast không có nút.
- Focus trở về tiêu đề danh sách "Bác sĩ" (`tabIndex={-1}`), vì nút vừa bấm đã biến mất cùng dòng.
- Xoá dòng cuối cùng thì trang hiện trạng thái rỗng sẵn có.
- **Thiết bị của bác sĩ bị xoá**: đã bị đăng xuất từ lúc khoá. Cookie cũ không khớp phiên nào, nên `access-gate` chuyển tới `/login`. Đăng nhập lại thì nhận thông báo chung "Tên đăng nhập hoặc mật khẩu không đúng.".
- **Nháp ghi chú trong IndexedDB** trên máy bác sĩ: đã gắn với tài khoản (spec `patient-notes` "Nháp gắn với tài khoản"), nên không lộ sang tài khoản khác dùng cùng máy. Server không xoá được dữ liệu trên máy bác sĩ; điều này nằm ngoài phạm vi.

### 7. Dữ liệu tách theo bác sĩ và quyền

- Mọi thao tác dựng bằng `createAction({ access: "admin" })`. Bác sĩ nhận `FORBIDDEN`, người chưa đăng nhập nhận `UNAUTHENTICATED`. Trang vẫn kiểm `requirePageAccess("admin")`.
- Id tài khoản đến từ client nhưng chỉ khớp được `role = 'doctor'`. Id của Admin trả `NOT_FOUND`, giống id không tồn tại.
- Xoá ảnh theo tiền tố chỉ nhận UUID đã kiểm. `removeAccountObjects` gọi `accountObjectPath(accountId, name)` cho từng tên được liệt kê, nên một tên lạ (`..`, thư mục con) bị từ chối thay vì xoá nhầm. Nó không bao giờ liệt kê tiền tố rỗng (toàn bucket).

### 8. Giao diện

- **Mockup**: `openspec/changes/add-account-deletion/mockup/index.html` (file local, mở trực tiếp bằng trình duyệt). **Ngày duyệt: 19/11/2026**, nguyên trạng, không điều chỉnh. Người dùng chốt luôn các quyết định: phải khoá trước khi xoá, gõ tên đăng nhập để xác nhận, gộp P3-3, và dòng mã kích hoạt mất theo tài khoản.
- **Hướng hình ảnh**: giữ nguyên bảng màu A "Mực bút bi" đã chốt và kiểu dòng của danh sách hiện có. Không thêm token.
  - Điểm nhấn duy nhất là hộp thoại xoá: tiêu đề nêu tên bác sĩ, một khối "Sẽ mất vĩnh viễn" trên nền `destructive` nhạt, ô gõ tên đăng nhập, và nút đỏ đặc "Xoá vĩnh viễn" chỉ sáng lên khi gõ khớp.
  - Màu chữ và nền dùng `--destructive` trên `--card`. Cặp này đã được đo ≥ 4.5:1 ở cả sáng và tối trong change trước, nên không có tỉ số tương phản mới phải đo.
- **Dòng tài khoản**: thêm một dòng meta, ví dụ "132 bệnh nhân · Sao lưu 15/11/2026" hoặc "0 bệnh nhân · Chưa sao lưu", cỡ 0.8 rem, màu `muted-foreground` như dòng "Tạo … · Đăng nhập …". "Chưa sao lưu" không tô màu cảnh báo: với Admin đây chỉ là thông tin.
- **Nút "Xoá"**: kiểu outline như "Mở khoá", chữ và icon `Trash2` màu `destructive`, cao 44 px.
  - Điện thoại 390 px: hai nút chia đôi chiều ngang dưới phần thông tin, như hiện nay.
  - Máy tính: nút nằm bên phải dòng.
- **Hộp thoại** (`ConfirmDialog`, `destructive`):
  - Tiêu đề: "Xoá tài khoản của Lê Văn Khoa?"
  - Mô tả: "Không hoàn tác được. Nếu bác sĩ còn cần dữ liệu, mở khoá để bác sĩ tự sao lưu trước."
  - Khối "Sẽ mất vĩnh viễn":
    - "12 bệnh nhân, cả thùng rác";
    - "Mọi ghi chú và ảnh đại diện";
    - "Việc cần làm";
    - và dòng "Lần sao lưu gần nhất: 15/11/2026" hoặc "Chưa sao lưu lần nào" (khớp chữ "Chưa sao lưu" của spec).
  - Ô "Gõ tên đăng nhập để xác nhận", với gợi ý "Gõ `bs.khoa`".
  - Hai nút: "Không xoá", và "Xoá vĩnh viễn" (đỏ đặc, `disabled` khi chưa khớp).
- **Trạng thái**:
  - Danh sách có dòng đã khoá kèm nút Xoá.
  - Hộp thoại khi ô trống: nút tắt.
  - Gõ chưa khớp: nút vẫn tắt, không hiện lỗi đỏ khi đang gõ.
  - Gõ khớp: nút bật.
  - Đang xoá: spinner trên nút; ô và nút "Không xoá" bị khoá; không đóng được hộp thoại.
  - Lỗi trong hộp thoại (`FormAlert`) cho bốn trường hợp: không khớp, đang hoạt động, không tìm thấy, kho ảnh lỗi. Khi có lỗi chỉ còn nút "Đóng"; đóng xong trang refresh.
  - Sau khi xoá: dòng mất, có toast.
  - Xoá dòng cuối: trạng thái rỗng sẵn có.
  - Đang tải: `loading.tsx` sẵn có, thêm một dòng skeleton cho meta.
- **Kiểm tra**: xem 390 px và 1280 px, sáng và tối, so với mockup. Rà bằng `web-design-guidelines`. E2E chạy trên Pixel 7 và iPhone 14 (riêng các test cần đăng nhập Admin thì theo cách `loginAs` đang làm).

### 9. Test

- **Unit**:
  - `usernameMatches`: hoa thường, khoảng trắng, chuỗi rỗng.
  - `deleteAccountSchema`.
  - `removeAccountObjects`, với storage giả: phân trang, lô 1000, tên lạ bị từ chối, lỗi bị ném lên.
  - `deleteAccountAction` với DAL giả: bảng ánh xạ lỗi ở §2; `access`.
- **DAL** (`mutations.test.ts`, mock `getDb` và transaction như các test hiện có):
  - `not-found`, `active`, `mismatch` thì không gọi storage, không `DELETE`;
  - storage ném lỗi thì không `DELETE` và lỗi đi ra khỏi transaction, tức là rollback;
  - câu `DELETE` chỉ khớp `role = 'doctor'`.
- **E2E** (`account-management.spec.ts`, DB E2E thật + fake storage): theo từng scenario trong delta spec.
  - Cascade xoá hết dữ liệu của `bs.khoa` mà không đụng `bs.lan`: kiểm bằng truy vấn đếm trên DB E2E và `/__fake/objects`.
  - "Kho ảnh lỗi": thêm vào `tests/e2e/fake-storage.mjs` một công tắc chỉ dùng khi test, `POST /__fake/fail { route: "list" }`. Khi bật, route liệt kê trả 500 cho tới lần `reset` sau.

## Risks / Trade-offs

- **[Link tải ảnh lên cấp trước lúc khoá vẫn còn hạn]** → Supabase cấp link tải lên có hạn ngắn. Nếu bác sĩ đang tải ảnh đúng lúc bị khoá rồi xoá, một object có thể xuất hiện lại dưới `<id>/` sau khi xoá. Object đó không có dòng nào trỏ tới, tên ngẫu nhiên, bucket private: không ai mở được. Chấp nhận. Muốn dọn định kỳ thì làm change sau.
- **[Ảnh đã xoá một phần khi rollback]** → xem §2. Thông báo lỗi hướng Admin thử lại, không mở khoá.
- **[Xoá nhầm]** → có ba lớp chặn: phải khoá trước, phải gõ đúng tên đăng nhập, và server kiểm lại. Không có thùng rác cho tài khoản: đúng D21 ("xóa luôn dữ liệu").
- **[Mất dòng mã kích hoạt đã dùng]** → dòng mã của tài khoản biến mất khỏi `/admin/access-codes` do cascade. Ghi trong proposal, mục Ngoài phạm vi.
- **[Giữ transaction qua lời gọi mạng]** → giới hạn bằng lô 1000 object mỗi lần gọi. Một bác sĩ có vài trăm ảnh thì xong trong vài giây, còn trong `maxDuration` của Vercel Function.
