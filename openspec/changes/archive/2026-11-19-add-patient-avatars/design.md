# Design

## Context

Lý do làm change: xem proposal.md (mục Why). Những gì code đã có:

- **Database**: `patients.avatar_path` (text, null), luôn null cho tới nay. Sao lưu bản 1 cố ý bỏ cột này ra.
- **Storage**: `src/server/storage/`
  - client Supabase dùng service-role key, chỉ cho Storage;
  - `STORAGE_BUCKETS` gồm `avatars` và `imports`;
  - `accountObjectPath(accountId, …segments)` trả kiểu có gắn nhãn, nên một chuỗi tuỳ ý không lọt vào hàm Storage được;
  - các hàm `createSignedReadUrl`, `createSignedUploadUrl`, `removeObjects`.
- **CSP**: `img-src` và `connect-src` cho phép `https://*.supabase.co`.
- **Giao diện**: `InitialsAvatar` đã có prop `src`, nhưng chưa ai truyền. `PersonRow` dùng cho danh sách, kết quả tìm và thùng rác; gợi ý trùng tên và trang chi tiết dùng `InitialsAvatar` trực tiếp.
- **Sao lưu**: định dạng bản 1 có `UPGRADERS`, giới hạn 4 MB cho file `.zip` và cho phần dữ liệu gửi lên.
- **E2E**: `SUPABASE_URL` của server test là `http://127.0.0.1:54321`, nhưng không có gì chạy ở địa chỉ đó.
- **API storage-js 2.119** (đọc trong `node_modules`), base `${SUPABASE_URL}/storage/v1`:

  | Việc                 | Request                                                     | Trả về                         |
  | -------------------- | ----------------------------------------------------------- | ------------------------------ |
  | Tạo URL tải lên      | `POST /object/upload/sign/{bucket}/{path}`                  | `{ url }`, có `?token=`        |
  | Tải lên              | `PUT /object/upload/sign/{bucket}/{path}?token=…`, body thô |                                |
  | Ký URL đọc một ảnh   | `POST /object/sign/{bucket}/{path}` `{ expiresIn }`         | `{ signedURL }`                |
  | Ký URL đọc nhiều ảnh | `POST /object/sign/{bucket}` `{ expiresIn, paths }`         | `[{ path, signedURL, error }]` |
  | Đọc ảnh              | `GET /object/sign/{bucket}/{path}?token=…`                  |                                |
  | Xoá                  | `DELETE /object/{bucket}` `{ prefixes }`                    |                                |

## Goals / Non-Goals

**Goals:**

- Đặt ảnh trong vài giây ngay trên điện thoại, kể cả ảnh chụp 12 MP.
- Ảnh không bao giờ đi qua Vercel Function, không có link công khai, không đọc được chéo tài khoản.
- Sao lưu và nhập giữ nguyên ảnh; file cũ không có ảnh vẫn nhập được.
- Băng thông Storage nằm trong gói miễn phí (5 GB/tháng).

**Non-Goals:** cắt hay xoay ảnh bằng tay, ảnh ở form thêm, đính kèm ảnh vào ghi chú (xem proposal, "Ngoài phạm vi").

## Decisions

### 1. Cấu trúc

```
src/server/storage/objects.ts        + newAvatarObjectName(), createSignedReadUrls(), isAvatarPathOf()
src/modules/patients/
├── avatar-image.ts                  (client) toAvatarWebp(file) → Blob 384×384
├── avatar-client.ts                 (client) uploadAvatar(patientId, file): xin URL → PUT → gắn
├── constants.ts                     + AVATAR_LIMITS (inputBytes 25 MB, size 384, quality 0.8), AVATAR_MESSAGES
├── format.ts                        + avatarUrl(patientId, avatarPath)
├── server/queries.ts                + getAvatarPath; listPatients/getPatient/listTrash trả avatarPath
├── server/mutations.ts              + setAvatar, clearAvatar; deletePermanently/purge trả avatarPath
├── server/actions.ts                + prepareAvatarUploadAction, setAvatarAction, removeAvatarAction;
│                                      deletePermanentlyAction xoá object
└── components/patient-avatar.tsx    nút ảnh + bảng chọn + đang lưu + xem + xoá (trang chi tiết)

src/app/api/patients/[id]/avatar/route.ts   GET → 307 tới URL ký
src/components/common/initials-avatar.tsx   ảnh lazy, quay về chữ cái đầu khi lỗi
src/components/common/person-row.tsx        + avatarSrc
src/modules/search (SearchablePatient)      + avatarSrc
src/modules/backup                          định dạng v2 (§5)
src/app/api/cron/daily-maintenance          xoá ảnh của bệnh nhân bị purge
next.config.ts                              CSP lấy origin của SUPABASE_URL
tests/e2e/fake-storage.mjs                  server Storage giả lập (§7)
```

**Chiều phụ thuộc:**

- `patients` → `@/server/storage`, tầng dùng chung.
- `backup` → `@/server/storage`, và đọc `avatar_path` trong DAL của chính nó, như đã đọc mọi bảng.
- `search` chỉ nhận `avatarSrc`, một chuỗi do trang tạo sẵn, nên không import `patients`.

### 2. Nén ảnh trên máy (`avatar-image.ts`)

1. **Kiểm file**: `file.type` bắt đầu bằng `image/` và `file.size` ≤ 25 MB. Sai thì báo lỗi, không gửi gì.
2. **Đọc ảnh**: `createImageBitmap(file, { imageOrientation: "from-image" })`, để ảnh chụp dọc trên iPhone không bị xoay ngang. Đọc lỗi (HEIC trên trình duyệt không hỗ trợ, file hỏng) thì báo "Không đọc được ảnh này.".
3. **Cắt và thu nhỏ**: lấy hình vuông lớn nhất ở giữa, vẽ lên canvas 384 × 384 với `imageSmoothingQuality = "high"`.
4. **Nén**: `canvas.toBlob(…, "image/webp", 0.8)`. Trình duyệt không xuất được WebP (Safari cũ trả PNG) thì xuất `image/jpeg` 0.85. Ảnh ra khoảng 20–40 KB.

**Phương án đã cân nhắc:** `browser-image-compression` (teckstack §4.11). Thư viện này không cắt vuông, nên vẫn phải tự vẽ canvas. Thêm một dependency chỉ để nén là thừa, vì `createImageBitmap` và `canvas.toBlob` có ở mọi trình duyệt app hỗ trợ.

### 3. Tải lên và gắn ảnh

```
trình duyệt                          server (action)                       Storage
toAvatarWebp(file) ──► prepareAvatarUploadAction({patientId})
                       kiểm bệnh nhân thuộc session, chưa ở thùng rác
                       path = accountObjectPath(account, <32 hex ngẫu nhiên>.webp)
                       createSignedUploadUrl(avatars, path) ─────────────────► ký
                 ◄──── { uploadUrl, path }
PUT uploadUrl (body = Blob, content-type, cache-control max-age=31536000) ─────► lưu
setAvatarAction({patientId, path}) ──► isAvatarPathOf(account, path)?
                       UPDATE patients SET avatar_path = path, updated_at = now()
                         WHERE id AND account AND deleted_at IS NULL RETURNING ảnh cũ
                       removeObjects(avatars, [ảnh cũ])  (lỗi chỉ log, không chặn)
                 ◄──── { avatarUrl }
```

- **Tên file ngẫu nhiên, mới mỗi lần đổi**: không lộ id bệnh nhân, và URL đổi theo ảnh, nên trình duyệt không bao giờ hiện ảnh cũ từ cache.
- **`isAvatarPathOf(accountId, path)`**: kiểm đúng mẫu `^<accountId>/[0-9a-f]{32}\.(webp|jpg)$`. Đường dẫn của tài khoản khác, có `..`, hay thư mục con đều bị từ chối (`VALIDATION_FAILED`).
- **Không kiểm ảnh đã thật sự tải lên chưa**: trình duyệt bị sửa có thể gắn một đường dẫn trống trong thư mục của chính mình, khi đó chỉ hiện chữ cái đầu. Không lộ gì và không ảnh hưởng ai khác.
- **Xoá ảnh** (`removeAvatarAction`): `UPDATE … SET avatar_path = NULL … RETURNING` ảnh cũ, rồi xoá object.
- **Thử lại sau mất mạng**: làm lại từ bước xin URL với chính Blob đã nén, không nén lại.

### 4. Hiển thị và cache

**Đã chọn:** route `GET /api/patients/[id]/avatar?v=<tên file>`.

1. `requireAccess("doctor")`.
2. `getAvatarPath(auth, id)`: bệnh nhân của session, chưa xoá hoặc còn trong thùng rác.
3. Không có ảnh thì trả 404, còn lại `createSignedReadUrl(avatars, path, 24 giờ)`.
4. Trả **307** tới URL ký, kèm `Cache-Control: private, max-age=82800`.

`InitialsAvatar` render `<img loading="lazy" decoding="async" alt="">`, lỗi thì quay về chữ cái đầu.

**Phương án đã cân nhắc:**

- **Ký sẵn URL cho cả danh sách khi render trang**: URL ký đổi mỗi lần tải trang, nên cache trình duyệt luôn trượt. 300 ảnh × 30 KB cho mỗi lần mở danh sách là quá tốn băng thông.
- **Proxy trả thẳng bytes ảnh qua function**: cache được mãi, nhưng trái K4 (ảnh không qua function).

**Hệ quả:**

- Trong khoảng 23 giờ, trình duyệt dùng lại chuyển hướng đã nhớ và ảnh đã nhớ.
- Ảnh chỉ tải khi dòng hiện ra.
- Băng thông xấp xỉ "mỗi ảnh nhìn thấy, mỗi máy, mỗi ngày một lần": 20 bác sĩ × 50 ảnh × 30 KB × 30 ngày ≈ 0,9 GB/tháng, dưới 5 GB.
- `?v=` là tên file, nên đổi ảnh là đổi URL.

**DTO:** `PatientListItem`, `PatientDetail` và `TrashedPatient` có thêm `avatarUrl: string | null`, tính bằng `avatarUrl(id, avatarPath)` ở server. Không bao giờ gửi `avatarPath` thô xuống trình duyệt.

**CSP:** `img-src` và `connect-src` thêm origin của `SUPABASE_URL` (đọc lúc build trong `next.config.ts`). Mặc định vẫn là `https://*.supabase.co`, còn E2E là `http://127.0.0.1:54321`.

### 5. Sao lưu và nhập, định dạng bản 2

```
backup.zip
├── manifest.json   formatVersion 2, counts.images
├── data.json       như bản 1 (không có đường dẫn ảnh)
└── images/<patientId>.webp|jpg
```

- **Nâng cấp v1 → v2**: thêm `counts.images = 0`. Server chỉ nhận bản 2.
- **Kiểm ảnh**:
  - tên file `images/<uuid>.(webp|jpg)`, uuid phải là một bệnh nhân trong `data.json`;
  - mỗi ảnh ≤ 512 KB và có đúng chữ ký đầu file WebP/JPEG;
  - ảnh không khớp bệnh nhân nào thì bỏ qua;
  - tổng dung lượng giải nén vẫn ≤ 64 MB.
- **Xuất**:
  - `GET /api/backup` trả thêm `images: [{ patientId, url }]` (URL ký 1 giờ). Trường này nằm **ngoài** `{ manifest, data }` nên không vào file;
  - trình duyệt tải ảnh, 4 ảnh cùng lúc, đóng gói với `level: 0` (ảnh đã nén sẵn), và hiện "Đang tải ảnh N/M…";
  - một ảnh lỗi thì dừng: không lưu file thiếu ảnh và không ghi ngày sao lưu.
- **Nhập**:
  1. `prepareImportUploadsAction({ count })`: server trả `count` URL tải lên `avatars` với đường dẫn ngẫu nhiên `<accountId>/<hex>.webp` (tối đa 20.000).
  2. Trình duyệt tải lên, 4 ảnh cùng lúc, hiện "Đang tải ảnh lên N/M…". Một ảnh lỗi thì dừng, xoá các ảnh đã tải (`discardImportUploadsAction`), và báo "Thử lại".
  3. `PUT /api/backup` gửi thêm `images: { <patientId cũ>: <path> }`. Server kiểm mọi path bằng `isAvatarPathOf`.
  4. Trong transaction: ghi `avatar_path` cho bệnh nhân mới, lấy danh sách ảnh cũ trước khi xoá dữ liệu cũ.
  5. Sau khi commit: xoá ảnh cũ trong kho. Lỗi xoá chỉ log, không chặn.
  6. PUT thất bại thì trình duyệt gọi `discardImportUploadsAction(paths)`, best effort.

  **Phương án đã cân nhắc:** teckstack §4.10 dùng bucket tạm `imports` rồi chuyển sang `avatars`. Supabase không chuyển object giữa hai bucket trong một lệnh. Tải thẳng vào `avatars` với tên ngẫu nhiên, rồi chỉ gắn trong transaction, cho cùng tính chất tất cả hoặc không: ảnh chưa gắn không hiện ở đâu và được dọn khi thất bại. Bucket `imports` vì vậy không dùng nữa.

- **Giới hạn**:
  - file `.zip` khi nhập ≤ 50 MB (300 bệnh nhân × 40 KB ≈ 12 MB);
  - body PUT (gzip của `{ manifest, data, images }`, không có bytes ảnh) vẫn ≤ 4 MB.

### 6. Xoá theo bệnh nhân

- **`deletePermanently`**: trả về `avatarPath`, rồi action xoá object.
- **`purgeExpiredTrash`**: trả về danh sách path, rồi cron xoá theo lô 1.000.
- **Lỗi Storage**: chỉ log số lượng, không chặn việc xoá dữ liệu. Một ảnh mồ côi không lộ gì, vì không còn bản ghi nào trỏ tới nó và tên của nó là ngẫu nhiên.
- **Chuyển vào thùng rác và khôi phục**: không đụng ảnh.

### 7. Server Storage giả lập cho E2E (`tests/e2e/fake-storage.mjs`)

- **Cách chạy**: một Node `http` server, khoảng 150 dòng, không dependency, nghe `127.0.0.1:54321`. Nó nằm trong `webServer` (mảng) của `playwright.config.ts`.
- **Lưu trữ**: object giữ trong bộ nhớ, theo khoá `bucket/path`.
- **API**: chỉ các route ở mục Context:
  - token ký là HMAC của path và hạn, nên đường dẫn sai token bị trả 400;
  - có CORS cho `PUT` và `GET` từ origin của app.
- **Route riêng cho test**:
  - `GET /__fake/objects?prefix=` để test kiểm ảnh còn hay đã bị xoá;
  - `DELETE /__fake/objects` để reset, gọi trong `resetDatabase`.
- **Phạm vi**: chỉ dùng khi chạy test, không bao giờ nằm trong bundle của app.

### 8. Lỗi

| Tình huống                            | Hiển thị                                         |
| ------------------------------------- | ------------------------------------------------ |
| Không phải ảnh / đọc lỗi              | "Không đọc được ảnh này."                        |
| Ảnh > 25 MB                           | "Ảnh quá lớn. Dung lượng tối đa 25 MB."          |
| Mất mạng khi xin URL / tải lên / gắn  | "Chưa lưu được ảnh vì mất mạng." + "Thử lại"     |
| Bệnh nhân không còn / của người khác  | `NOT_FOUND` "Không tìm thấy bệnh nhân."          |
| Đường dẫn ảnh ngoài thư mục tài khoản | `VALIDATION_FAILED`                              |
| Storage lỗi khi ký                    | `INTERNAL` "Đã có lỗi xảy ra. Vui lòng thử lại." |
| Xoá ảnh mất mạng                      | Lỗi trong hộp thoại, ảnh giữ nguyên              |

Không thông báo nào chứa tên bệnh nhân.

### 9. Giao diện (theo mockup)

Mockup: `openspec/changes/add-patient-avatars/mockup/index.html`, file local, mở trực tiếp bằng trình duyệt.

**Hướng hình ảnh**: bảng màu A, không thêm token.

- **Điểm nhấn** là ảnh đại diện 72 px trên trang chi tiết, kèm huy hiệu máy ảnh tròn 28 px ở góc dưới phải. Huy hiệu nói rõ "chạm vào đây để đặt ảnh"; vùng chạm của nút là cả ảnh, 72 px.
- **Danh sách**: không đổi bố cục, ảnh thay chữ cái đầu trong vòng tròn 40 px.

**Trang chi tiết (390 px):**

- Ảnh tăng từ 56 lên 72 px để nhìn rõ mặt; tên và dòng phụ giữ nguyên.
- **Bảng chọn** là bottom sheet, gồm "Chụp ảnh" (`<input type="file" accept="image/*" capture="environment">`), "Chọn ảnh có sẵn" (`accept="image/*"`), và khi có ảnh thì "Xem ảnh", "Xoá ảnh" (chữ đỏ).
- **Đang lưu**: ảnh mới hiện ngay ở dạng mờ 50% kèm vòng xoay, và dòng "Đang lưu ảnh…" (`role="status"`) dưới tên.
- **Lỗi**: dòng lỗi đỏ có icon dưới tên, kèm nút "Thử lại".
- **Xem ảnh**: hộp thoại ảnh vuông, rộng tối đa 360 px, có nút "Đóng".
- **Xoá ảnh**: `ConfirmDialog` "Xoá ảnh đại diện?" — "Ảnh sẽ bị xoá hẳn. Trang sẽ hiện lại chữ cái đầu." kèm "Xoá ảnh" và "Không xoá".

**Máy tính (1280 px)**: bảng chọn là menu thả xuống dưới ảnh (`DropdownMenu`), xem ảnh là hộp thoại giữa màn hình.

**Sao lưu, nhập**:

- nút tải hiện "Đang tải ảnh 5/12…";
- thẻ tóm tắt file có thêm ô "ảnh";
- danh sách bước nhập có thêm bước "Tải ảnh lên (5/12)" trước "Nhập dữ liệu từ file".

**Tiếp cận**:

- nút ảnh có `aria-label="Ảnh đại diện"` và `aria-haspopup`;
- ảnh trong danh sách có `alt=""` (tên đã ở bên cạnh);
- ảnh xem lớn có `alt="Ảnh đại diện"`, không chứa tên;
- vòng xoay có nhánh `motion-reduce`.

**Trạng thái duyệt**: người dùng duyệt mockup ngày 19/11/2026, nguyên trạng, cùng năm quyết định nêu khi trình duyệt.

## Risks / Trade-offs

- **iPhone ở chế độ PWA và `capture`**: một số bản iOS mở máy ảnh khác nhau. → "Chọn ảnh có sẵn" luôn có; kiểm trên iPhone thật (rủi ro R8).
- **HEIC trên Chrome máy tính** không đọc được. → Báo "Không đọc được ảnh này."; điện thoại tự chuyển sang JPEG khi chọn qua `<input>`.
- **Server giả lập lệch Supabase thật** → Các route và kiểu trả về được chép từ storage-js 2.119 đang dùng. Trước khi phát hành, thử một lần trên môi trường Preview (đã ghi trong Migration Plan).
- **URL ký 24 giờ dài hơn mức "~1 giờ" của teckstack** → Chỉ server mới tạo được, chỉ cho bác sĩ sở hữu, đường dẫn ngẫu nhiên, và URL chỉ nằm trong cache của chính máy đó. Đổi lại băng thông nằm trong gói miễn phí. teckstack §4.6 được cập nhật theo.
- **Ảnh mồ côi** (thất bại giữa chừng, lỗi xoá) → Không lộ gì; dung lượng nhỏ.
- **Nhập bị quá thời gian hay mất mạng sau khi gửi** (review) → server có thể vẫn đang ghi; trình duyệt chỉ xoá ảnh vừa tải lên khi server trả lời từ chối rõ ràng, không bao giờ khi mất mạng.
- **Một ảnh trong kho hỏng hay quá lớn khi xuất** (review) → ảnh đó bị bỏ khỏi file (bệnh nhân hiện chữ cái đầu khi nhập), để file vẫn nhập lại được.
- **Đổi ảnh có đổi `updated_at`** (review) → thanh nhắc sao lưu tính cả lần đổi ảnh; form sửa đang mở ở máy khác sẽ báo "vừa được sửa", đúng là có thay đổi.

## Migration Plan

1. Tạo bucket **private** `avatars` trên Supabase (Preview và Production): giới hạn 1 MB mỗi file, MIME `image/webp`, `image/jpeg`.
2. Deploy. Không có migration database.
3. Trên Preview: đặt ảnh, xem trong danh sách, sao lưu có ảnh rồi nhập lại.
4. Rollback: revert code. Ảnh đã tải lên nằm yên trong bucket; bản cũ không đọc `avatar_path`, nên không ảnh hưởng.
